from django.db import connection
from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
import re
import string
from multiprocessing import Lock
from functools import reduce

from custom_user.models import AuthUser

class Transaction(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = dbmodels.ForeignKey('custom_user.AuthUser', db_index=True, editable=False)
    creation_time = dbmodels.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)
    time_zone_offset = dbmodels.SmallIntegerField(editable=False)
    
    def __str__(self):
        return str(self.creation_time)
    
    def createTransaction(user, timeZoneOffset):
        if not user.is_authenticated:
            raise RuntimeError('current user is not authenticated')
        if not user.is_active:
            raise RuntimeError('current user is not active')
        return Transaction.objects.create(user=user, time_zone_offset=timeZoneOffset)
        
class TransactionState:
    mutex = Lock()
    
    def __init__(self, user, timeZoneOffset):
        self.currentTransaction = None
        self.user = user
        self.timeZoneOffset = timeZoneOffset
            
    @property    
    def transaction(self):
        if self.currentTransaction == None:
            self.currentTransaction = Transaction.createTransaction(self.user, self.timeZoneOffset)

        return self.currentTransaction

class _deferred():
    def __init__(self, f):
        self._value = None
        self._isCached = False
        self._f = f
        
    @property
    def value(self):
        if not self._isCached:
            self._value = self._f()
            self._isCached = True
        return self._value
        
class Instance(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    typeID = dbmodels.ForeignKey('consentrecords.Instance', related_name='typeInstances', db_column='typeid', db_index=True, editable=False)
    parent = dbmodels.ForeignKey('consentrecords.Instance', related_name='children', db_column='parentid', db_index=True, null=True, editable=False)
    parentValue = dbmodels.OneToOneField('consentrecords.Value', related_name='valueChild', db_index=True, null=True)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    deleteTransaction = dbmodels.ForeignKey('consentrecords.Transaction', related_name='deletedInstance', db_index=True, null=True, editable=True)
        
    def __str__(self):
        try:
            d = self.description
            if d:
                return d.text
            else:
                return "Deleted"
        except Description.DoesNotExist:
            return "Deleted"
    
    @property    
    def _parentDescription(self):
        return self.parent and str(self.parent)
        
    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, parent, transactionState):
        id = uuid.uuid4().hex
        i = Instance.objects.create(id=id, typeID=self, parent=parent,
                                    transaction=transactionState.transaction)
        return i
    
    def getDataType(self, field):
        configuration = self.typeID.children.filter(typeID=Terms.configuration,deleteTransaction__isnull=True)[0]
        fields = configuration.children.filter(typeID=Terms.field,deleteTransaction__isnull=True)
        f = fields.get(value__field=Terms.name,
                          value__referenceValue=field,
                          value__deleteTransaction__isnull=True)
        v = f.value_set.filter(field=Terms.dataType,deleteTransaction__isnull=True)[0]
        return v.referenceValue
    
    # addValue ensures that the value can be found for object values. 
    # addValue does not validate that self is writable.           
    def addValue(self, field, value, position, transactionState):
        if value == None:
            raise ValueError("value is not specified")
        
        dt = self.getDataType(field)
        if dt==Terms.objectEnum:
            if not isinstance(value, Instance):
                f = list(UserInfo(transactionState.user).findFilter(Instance.objects.filter(pk=value)))
                if len(f) == 0:
                    raise Value.DoesNotExist("specified primary key for instance does not exist")
                value = f[0]
            elif not value._canFind(transactionState.user):
                raise Value.DoesNotExist()
            return self.addReferenceValue(field, value, position, transactionState)
        elif dt==Terms.translationEnum:
            return self.addTranslationValue(field, value, position, transactionState)
        else:
            return self.addStringValue(field, value, position, transactionState)

    def addStringValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        return Value.objects.create(id=uuid.uuid4().hex, instance=self, field=field, stringValue = value, position=position, transaction=transactionState.transaction)

    def addTranslationValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        if not isinstance(value, dict):
            raise ValueError("the value(%s) is not a dictionary" % str(value))
        return Value.objects.create(id=uuid.uuid4().hex, instance=self, field=field, 
                                    stringValue = value["text"], languageCode = value["languageCode"],
                                    position=position, transaction=transactionState.transaction)

    def _descendents(self):
        d = [self]
        i = 0
        while i < len(d):
            d.extend(d[i].children.filter(deleteTransaction__isnull=True))
            i += 1
        return d

    def addReferenceValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid" % position)
        if not value:
            raise ValueError("the value is null")
            
        # If the field is special access, then make this and all of its children sourced to self.
        if field == Terms.specialAccess and value == Terms.customAccessEnum:
            descendents = self._descendents()
            n = AccessRecord.objects.filter(id__in=descendents).delete()
            AccessRecord.objects.bulk_create(map(lambda i: AccessRecord(id=i,source=self), descendents))
            
        return Value.objects.create(id=uuid.uuid4().hex, instance=self, field=field, referenceValue=value, position=position, transaction=transactionState.transaction)

    def createMissingSubValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
            
        dt = self.getDataType(field)
        if dt==Terms.objectEnum:
            if not Value.objects.filter(instance=self,field=field,referenceValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding object %s(%s)" % (str(self), str(field), str(value)))
                self.addReferenceValue(field, value, position, transactionState)
        elif dt==Terms.translationEnum:
            if not Value.objects.filter(instance=self,field=field,stringValue=value["text"],
                                    languageCode=value["languageCode"],
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding translation %s(%s)" % (str(self), str(field), str(value)))
                self.addTranslationValue(field, value, position, transactionState)
        else:
            if not Value.objects.filter(instance=self,field=field,stringValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding string %s(%s)" % (str(self), str(field), str(value)))
                self.addStringValue(field, value, position, transactionState)
        
    def _getSubValues(self, field):
        return self.value_set.filter(field=field, deleteTransaction__isnull=True).order_by('position');
    
    def _groupValuesByField(self, vs, userInfo):
        values = {}
        # Do not allow a user to get security field data unless they can administer this instance.
        cache = _deferred(lambda: self._canAdminister(userInfo.authUser, userInfo.instance))
        for v in vs:
            if v.field not in Terms.securityFields or cache.value:
                fieldID = v.field.id
                if fieldID not in values:
                    values[fieldID] = [v]
                else:
                    values[fieldID].append(v)
        return values
    
    def _getSubInstances(self, field): # Previously _getSubValueObjects
        return [v.referenceValue for v in self._getSubValues(field)]
        
    # Returns a unique value of the specified id.
    def getSubValue(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        try:
            f = self.value_set.filter(deleteTransaction__isnull=True, field=field).select_related('referenceValue')
            return f[0] if f.count() else None
        except Value.DoesNotExist:
            return None
            
    def getSubInstance(self, field):
        if not field:
            raise ValueError("field is not specified")
            
        v = self.getSubValue(field)
        return v and v.referenceValue
     
    # Returns an iterable of the values within self associated with the specified field.       
    def findValues(self, field, value):
        return self.value_set.filter(Q(stringValue=value)|Q(referenceValue_id=value),deleteTransaction__isnull=True, field=field)
        
    # Returns a list of pairs of text that are used to generate the description of objects 
    # of this kind.
    # The first of the pair is the hex UUID of the name, the second is the hex UUID of the dataType
    @property
    def _descriptors(self):
        configuration = self.getSubInstance(Terms.configuration)
        results = []
        if configuration:
            elementIDs = [Terms.name, Terms.dataType]
            for fieldObject in configuration._getSubInstances(Terms.field):
                r = fieldObject.getSubInstance(Terms.descriptorType)
                if r:
                    n = [fieldObject.getSubValue(x) for x in elementIDs]
                    dataTypeInstance = n[1] and n[1].referenceValue
                    if n[0] and dataTypeInstance:
                        results.append([n[0].referenceValue, dataTypeInstance, r])
        return results
        
    # Returns a description of this object with these verbs. 
    # verbs is an array of pairs where the first of the pair is the field name and 
    # the second is the field dataType.
    # The string is directly attached to the verb (v1).       
    def cacheDescription(self, nameLists):
        verbs = nameLists.getNameUUIDs(self.typeID)
        r = []
        for field, dataType, descriptorType in verbs:
            if descriptorType == Terms.textEnum:
                vs = self.value_set.filter(field=field, deleteTransaction__isnull=True).order_by('position')
                if dataType == Terms.objectEnum:
                    for v in vs:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.field), v.stringValue))
                            r.append(v.referenceValue.description.text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                else:
                    r.extend([v.stringValue for v in filter(lambda v: v.stringValue, vs)])
            elif descriptorType == Terms.countEnum:
                vs = self.value_set.filter(field=field, deleteTransaction__isnull=True)
                r.append(str(vs.count()))
            else:
                raise ValueError("unrecognized descriptorType: %s ('%s' or '%s')" % (str(descriptorType), str(Terms.textEnum), str(Terms.countEnum)))
                    
        s = " ".join(r)
        Description.objects.update_or_create(instance = self, 
                                             defaults={'text': s})
        return s
    
    # Return a list of the instances for which this instance contributes
    # to the description.
    @property
    def _descriptionReferences(self):
        values = self.referenceValues.filter(deleteTransaction__isnull=True)
        return [v.instance for v in filter(lambda v: v.isDescriptor, values)]

    def getDescription(self, language=None):
        return self._description
        
    def updateDescriptions(queue, nameLists):
        queue = list(queue) # Make a local copy of the list.
        calculated = set()
        while len(queue) > 0:
            i = queue[0]
            queue = queue[1:]
            if i not in calculated:
                i.cacheDescription(nameLists)
                queue.extend(i._descriptionReferences)
                calculated.add(i)
    
    @property
    def _description(self):
        d = self.description
        return d.text if d else "Deleted"

    @property    
    def _allInstances(self):    # was _getAllInstances()
        return self.typeInstances.filter(deleteTransaction__isnull=True)
            
    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, language=None):
        return {'id': None, 'value': {'id': self.id, 'description': self.getDescription(language)}}
    
    # This code presumes that all fields have unique values.
    def _sortValueDataByField(values):
        d = {}
        for v in values:
            # If there is a reference value, put in a duple with the referenceValue name and id.
            # Otherwise, put in the string value.
            if v.referenceValue:
                d[v.field] = (v.referenceValue.name_values[0].stringValue, v.referenceValue.id)
            else:
                d[v.field] = v.stringValue
        return d
        
    # Returns a dictionary by field where each value is
    # a duple containing the value containing the name and 
    # the instance referenced by self from the key field.
    def _getSubValueReferences(self):
        vs2 = Value.objects.filter(field__in=[Terms.name, Terms.uuName],
                                   deleteTransaction__isnull=True)
        vs1 = self.value_set.filter(deleteTransaction__isnull=True)\
                            .select_related('referenceValue')\
                            .prefetch_related(Prefetch('referenceValue__value_set',
                                                       queryset=vs2,
                                                       to_attr='name_values'))
        return Instance._sortValueDataByField(vs1)                                               
    
    # For a parent field when getting data, construct this special field record
    # that can be used to display this field data.
    def getParentReferenceFieldData(self):
        name = self.description.text
        fieldData = {"name" : name,
                     "nameID" : self.id,
                     "dataType" : TermNames.object,
                     "dataTypeID" : Terms.objectEnum.id,
                     "capacity" : TermNames.uniqueValue,
                     "ofKind" : name,
                     "ofKindID" : self.id}
        return fieldData
    
    # Returns a dictionary of information about a field instance.                 
    def getFieldData(self, language=None):
        return self._getFieldDataFromValues(self._getSubValueReferences(), language)
    
    def _getFieldDataFromValues(self, values, language):
        fieldData = None
        if Terms.name in values and Terms.dataType in values:
            nameReference = values[Terms.name]
            dataTypeReference = values[Terms.dataType]
            fieldData = {"id" : self.id, 
                         "name" : nameReference[0],
                         "nameID" : nameReference[1],
                         "dataType" : dataTypeReference[0],
                         "dataTypeID" : dataTypeReference[1]}
            if Terms.maxCapacity in values:
                fieldData["capacity"] = values[Terms.maxCapacity][0]
            else:
                fieldData["capacity"] = TermNames.multipleValues
                
            if Terms.descriptorType in values:
                fieldData["descriptorType"] = values[Terms.descriptorType][0]
            
            if Terms.addObjectRule in values:
                fieldData["objectAddRule"] = values[Terms.addObjectRule][0]
            
            if fieldData["dataTypeID"] == Terms.objectEnum.id:
                if Terms.ofKind in values:
                    ofKindReference = values[Terms.ofKind]
                    fieldData["ofKind"] = ofKindReference[0]
                    fieldData["ofKindID"] = ofKindReference[1]
                if Terms.pickObjectPath in values:
                    fieldData["pickObjectPath"] = values[Terms.pickObjectPath]
        
        return fieldData
    
    def _getFieldsData(self, language=None):
        vs2 = Value.objects.filter(field__in=[Terms.name, Terms.uuName],
                            deleteTransaction__isnull=True)

        vs1 = Value.objects.filter(deleteTransaction__isnull=True)\
                            .select_related('field')\
                            .select_related('referenceValue')\
                            .prefetch_related(Prefetch('referenceValue__value_set',
                                                       queryset=vs2,
                                                       to_attr='name_values'))

        fields = Instance.objects.filter(typeID=Terms.field, deleteTransaction__isnull=True)\
                                 .filter(parent__parent=self.typeID)\
                                 .prefetch_related(Prefetch('value_set', queryset=vs1, to_attr='values'))\
                                 .order_by('parentValue__position')
        return [field._getFieldDataFromValues(Instance._sortValueDataByField(field.values), language) for field in fields]

    def getFieldsData(uuObject, fieldsDataDictionary, language=None):
        if uuObject.typeID in fieldsDataDictionary:
            return fieldsDataDictionary[uuObject.typeID]
        else:
            fieldsData = uuObject._getFieldsData(language)
            if not len(fieldsData):
                raise RuntimeError("the specified item is not configured")
            fieldsDataDictionary[uuObject.typeID] = fieldsData
            return fieldsData

    # Return an array where each element contains the id and description for an object that
    # is contained by self.
    def _getSubReferences(self, field, language=None):
        return [v.getReferenceData(language) for v in self._getSubValues(field)]
    
    def getValueReferenceData(v, language):
        return { "id": v.id,
              "value": {"id" : v.referenceValue.id, "description": v.referenceValue.getDescription(language) },
              "position": v.position }

    def _getCellValues(dataTypeID, values, language=None):
        if dataTypeID == Terms.objectEnum.id:
            return [v.getCachedReferenceData() for v in values]
        elif dataTypeID == Terms.translationEnum.id:
            return [{"id": v.id, "value": {"text": v.stringValue, "languageCode": v.languageCode}} for v in values]
        else:
            # Default case is that each datum in this cell contains a unique value.
            return [{"id": v.id, "value": v.stringValue} for v in values]
            
    def getReadableSubValues(self, field, userInfo):
        return userInfo.readValueFilter(self.value_set.filter(field=field, deleteTransaction__isnull=True)) \
            .order_by('position')\
            .select_related('referenceValue')
    
    
    def _getCellData(self, fieldData, values, language=None):
        cell = {"field": fieldData}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        else:
            cell["data"] = Instance._getCellValues(fieldData["dataTypeID"], values[fieldID], language)
        return cell
                
    # Returns an array of arrays.
    def getData(self, vs, fieldsData, language=None, userInfo=None):
        values = self._groupValuesByField(vs, userInfo)
        return [self._getCellData(fieldData, values, language) for fieldData in fieldsData]

    # self should be a configuration object with fields.
    def getConfiguration(self):
        return [{"field": fieldObject.getFieldData()} for fieldObject in self._getSubInstances(Terms.field)]

    def getNextElementIndex(self, field):
        maxElementIndex = reduce(lambda x,y: max(x, y), 
                                 [e.position for e in self._getSubValues(field)],
                                 -1)
        if maxElementIndex < 0:
            return 0
        else:
            return maxElementIndex + 1

    def updateElementIndexes(self, field, newIndex, transactionState):
        ids = {}
        
        for e in self._getSubValues(field):
            ids[e.position] = e
        if len(ids) == 0:
            return 0
        else:
            sortedIndexes = sorted(ids)
            if len(sortedIndexes) <= newIndex:
                return sortedIndexes[-1]+1
            elif newIndex == 0 and sortedIndexes[0] > 0:
                return 0
            elif sortedIndexes[newIndex] > sortedIndexes[newIndex-1] + 1:
                return sortedIndexes[newIndex-1] + 1
            else:
                movingIndexes = sortedIndexes[newIndex:]
                ids[movingIndexes[0]].updateIndex(movingIndexes[0] + 1, transactionState)
                lastIndex = movingIndexes[0]
                for i in movingIndexes[1:]:
                    if lastIndex + 1 < i:
                        break
                    ids[i].updateIndex(i + 1, transactionState)
                    lastIndex = movingIndexes[i]
                    
                return movingIndexes[0]
        
    def markAsDeleted(self, transactionState):
        self.deleteTransaction = transactionState.transaction
        self.save()

    def deepDelete(self, transactionState):
        queue = [self]
        
        AccessRecord.objects.filter(pk=self).delete()
        
        self.deleteTransaction = transactionState.transaction
        self.save()
        while len(queue) > 0:
            next = queue[0]
            queue = queue[1:]
            instances = next.children.filter(deleteTransaction__isnull=True).only('id')
            values = next.value_set.filter(deleteTransaction__isnull=True).only('id')
            queue.extend(instances)
            
            # Delete associated access records before marking the instances as deleted.
            AccessRecord.objects.filter(id__in=instances).delete()
            
            instances.update(deleteTransaction=transactionState.transaction)
            values.update(deleteTransaction=transactionState.transaction)

    def deleteOriginalReference(self, transactionState):
        if self.parent:
            for v in self.referenceValues.filter(instance=self.parent):
                v.markAsDeleted(transactionState) 
                
    # Return the Value for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    # Self is of type configuration.
    def getFieldByName(self, name):
        vs = self.value_set.filter(deleteTransaction__isnull=True,
                              field=Terms.field)\
                              .select_related('referenceValue')
        for v in vs:
            vs2 = v.referenceValue.value_set.filter(deleteTransaction__isnull=True,
                              field=Terms.name)\
                              .select_related('referenceValue')
            for v2 in vs2:
                vs3 = v2.referenceValue.value_set.filter(deleteTransaction__isnull=True,
                              field=Terms.uuName,
                              stringValue=name)
                for v3 in vs3:
                    return v.referenceValue
        raise Value.DoesNotExist('field "%s" does not exist' % name)

    @property
    def inheritsSecurity(self):
        return True
        
    def comparePrivileges(a, b):
        if a == b:
            return 0
        elif not a:
            return b
                
        privileges = [Terms.findPrivilegeEnum, Terms.readPrivilegeEnum, Terms.registerPrivilegeEnum, 
                      Terms.writePrivilegeEnum, Terms.administerPrivilegeEnum]
                      
        aIndex = privileges.index(a)
        return -1 if b in privileges[(aIndex+1):] else 1
        
    # returns the privilege level that the specified user instance has for this instance. 
    def getPrivilege(self, userInfo):
        instances = [self]
        
        if userInfo.is_administrator:
            return Terms.administerPrivilegeEnum
            
        try:
            source = self.accessrecord.source
        except AccessRecord.DoesNotExist:
            return Terms.readPrivilegeEnum
            
        if not userInfo.instance:
            return None
        
        if source.value_set.filter(field=Terms.primaryAdministrator, deleteTransaction__isnull=True).count():
            if source.value_set.filter(field=Terms.primaryAdministrator, deleteTransaction__isnull=True)[0].referenceValue == userInfo.instance:
                return Terms.administerPrivilegeEnum
                
        minPrivilege = None
        if source.value_set.filter(field=Terms.publicAccess, deleteTransaction__isnull=True).count():
            minPrivilege=source.value_set.filter(field=Terms.publicAccess, deleteTransaction__isnull=True)[0].referenceValue
        
        f = source.children.filter(typeID=Terms.accessRecord, deleteTransaction__isnull=True)\
            .filter(Q(value__referenceValue=userInfo.instance)|
                    (Q(value__referenceValue__value__referenceValue=userInfo.instance)&
                     Q(value__referenceValue__value__deleteTransaction__isnull=True)))
                      
        p = map(lambda i: i.value_set.filter(typeID=Terms.privilege, deleteTransaction__isnull=True).referenceValue, f)
        
        return reduce(Instance.comparePrivileges, p, minPrivilege)
    
    ### For the specified self user, return a filter of values indicating which access records are accessible to this user.   
    def _getPrivilegeValues(self, privilegeIDs):
        return Value.objects.filter(Q(referenceValue=self)|\
                                       (Q(referenceValue__value__referenceValue=self)\
                                        &Q(referenceValue__value__deleteTransaction__isnull=True)\
                                       ),\
                                       instance__typeID=Terms.accessRecord,
                                       deleteTransaction__isnull=True
                                       ) \
            .annotate(pField=F('instance__value__field'),privilege=F('instance__value__referenceValue'),
                      pDeleted=F('instance__value__deleteTransaction')
                     ) \
            .filter(pField=Terms.privilege.id, privilege__in=privilegeIDs,pDeleted=None)
    
    ### Returns True if this user (self) is the primary administrator of the specified instance
    def isPrimaryAdministrator(self, instance):
        try:
            return instance.accessrecord.source.value_set.filter(field=Terms.primaryAdministrator,
                referenceValue=self,
                deleteTransaction__isnull=True).exists()
        except AccessRecord.DoesNotExist:
            return False
    
    def _securityFilter(self, f, privilegeIDs, accessRecordOptional=True):
        sourceValues = self._getPrivilegeValues(privilegeIDs)
        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=Terms.accessRecord)&
                         Q(children__value__in=sourceValues))
                        |
                        (((Q(value__field=Terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__field=Terms.primaryAdministrator.id)\
                           &Q(value__referenceValue=self)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                         )\
                        )\
                       )
        
        if accessRecordOptional:
            return f.filter(Q(accessrecord__isnull=True)|
                            Q(accessrecord__source__in=sources))
        else:
            return f.filter(Q(accessrecord__source__in=sources))
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def findFilter(self, f):
        privilegeIDs = [Terms.findPrivilegeEnum.id, Terms.readPrivilegeEnum.id, Terms.registerPrivilegeEnum.id, 
                      Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def readFilter(self, f):
        privilegeIDs = [Terms.readPrivilegeEnum.id,
                      Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def administerFilter(self, f):
        privilegeIDs = [Terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs, accessRecordOptional=False)
    
    def _canUse(self, user, publicAccessPrivileges, accessRecordPrivilegeIDs):
        if user.is_staff:
            return True

        userInstance = Instance.getUserInstance(user)
        if user.is_authenticated and \
           userInstance.isPrimaryAdministrator(self):
            return True
                            
        try:
            return self.accessrecord.source.value_set.filter(field=Terms.publicAccess, 
                                                         referenceValue__in=publicAccessPrivileges,
                                                         deleteTransaction__isnull=True).exists() or \
                   self.accessrecord.source.children.filter(typeID=Terms.accessRecord, 
                        value__in=userInstance._getPrivilegeValues(accessRecordPrivilegeIDs))\
                        .exists()
        except AccessRecord.DoesNotExist:
            return False

    ## Instances can be read if the specified user is a super user or there is no accessRecord
    ## associated with this instance.
    ## Otherwise, the user must have a permission, public access set to read or be the primary administrator.
    def _canFind(self, user):
        publicAccessPrivileges = [Terms.findPrivilegeEnum, Terms.registerPrivilegeEnum, 
                                  Terms.readPrivilegeEnum, 
                                  Terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [Terms.findPrivilegeEnum.id,
                                    Terms.registerPrivilegeEnum.id,
                                    Terms.readPrivilegeEnum.id, 
                                    Terms.writePrivilegeEnum.id, 
                                    Terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    def _canRead(self, user):
        publicAccessPrivileges = [Terms.readPrivilegeEnum, 
                                  Terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [Terms.readPrivilegeEnum.id, 
                                    Terms.writePrivilegeEnum.id, 
                                    Terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canRegister(self, user):
        publicAccessPrivileges = [Terms.registerPrivilegeEnum, 
                                  Terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [Terms.registerPrivilegeEnum.id,
                                    Terms.writePrivilegeEnum.id,
                                    Terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canWrite(self, user):
        publicAccessPrivileges = [Terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [Terms.writePrivilegeEnum.id,
                                    Terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be administered if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has administer privilege on the instance.                        
    def _canAdminister(self, user, userInstance=None):
        publicAccessPrivileges = []
        accessRecordPrivilegeIDs = [Terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
            
    def checkWriteAccess(self, user, field=None):
        if self.typeID==Terms.accessRecord:
            if not self._canAdminister(user):
                raise RuntimeError("administer permission failed")
        elif field in Terms.securityFields:
            if not self._canAdminister(user):
                raise RuntimeError("administer permission failed")
        else:
            if not self._canWrite(user):
                raise RuntimeError("write permission failed")
    
    # Raises an error unless the specified user can write the specified value to the specified field of self.
    # This handles the special case of register permission if the value is a user.
    def checkWriteValueAccess(self, user, field, value):
        if value:
            if isinstance(value, str) and Terms.isUUID(value):
                value = Instance.objects.get(pk=value, deleteTransaction__isnull=True)
            if isinstance(value, Instance) and \
                value.typeID == Terms.user and \
                value._canAdminister(user) and \
                field not in Terms.securityFields and \
                self._canRegister(user):
                return
        self.checkWriteAccess(user, field)
            
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=Terms.publicAccess.id)&
                          Q(value__referenceValue__in=[Terms.findPrivilegeEnum, Terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(accessrecord__isnull=True)|
                        Q(accessrecord__source__in=sources))
        
    def securityValueFilter(self, privilegeIDs):
        sourceValues = self._getPrivilegeValues(privilegeIDs)
        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=Terms.accessRecord)&
                         Q(children__value__in=sourceValues))
                        |
                        (((Q(value__field=Terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__field=Terms.primaryAdministrator.id)\
                           &Q(value__referenceValue=self)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                         )\
                        )\
                       )
        
        return (Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessrecord__isnull=True)|
                        (Q(referenceValue__accessrecord__source__in=sources)))
    
    ### For the specified instance filter, filter only those instances that can be found by self. 
    @property   
    def findValueFilter(self):
        privilegeIDs = [Terms.findPrivilegeEnum.id, Terms.readPrivilegeEnum.id, Terms.registerPrivilegeEnum.id,
                      Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be read by self. 
    @property   
    def readValueFilter(self):
        privilegeIDs = [Terms.readPrivilegeEnum.id, Terms.registerPrivilegeEnum.id,
                      Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    
    @property                
    def defaultCustomAccess(self):
        return self.value_set.filter(field=Terms.defaultAccess, deleteTransaction__isnull=True).exists()
                    
    def getUserInstance(user):
        field = Terms.getNamedInstance(TermNames.userID)
        userID = user.id
        if isinstance(userID, uuid.UUID):
            userID = userID.hex
        qs = Value.objects.filter(field=field, stringValue=userID,
            deleteTransaction__isnull=True)
        return qs[0].instance if len(qs) else None
    
    @property    
    def user(self):
        field = Terms.getNamedInstance(TermNames.userID)
        id = self.value_set.get(field=field, deleteTransaction__isnull=True).stringValue
        return AuthUser.objects.get(pk=id)
    
class NameList():
    def __init__(self):
        self.items = {}
    
    def getNameUUIDs(self, typeID):
        if typeID in self.items:
            return self.items[typeID]
        else:
            nameFieldUUIDs = typeID._descriptors
            self.items[typeID] = nameFieldUUIDs
            return nameFieldUUIDs
    
    def descriptorField(self, v):
        container = v.instance
        fields = [None] + self.getNameUUIDs(container.typeID)
        return reduce(lambda a, b: a if a else b if v.field == b[0] else None, fields) 
    
class Value(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    field = dbmodels.ForeignKey('consentrecords.Instance', related_name='fieldValues', db_column='fieldid', db_index=True, editable=False)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    referenceValue = dbmodels.ForeignKey('consentrecords.Instance', related_name='referenceValues', db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    deleteTransaction = dbmodels.ForeignKey('consentrecords.Transaction', related_name='deletedValue', db_index=True, null=True, editable=True)
    
    def __str__(self):
        d = str(self.referenceValue) if self.referenceValue else self.stringValue
        return "%s[%s:%s]@%s" % (str(self.instance), 
                                 str(self.field), 
                                 d, 
                                 str(self.position))
    
    @property
    def objectValue(self):
        str(self.referenceValue) if self.referenceValue else self.stringValue
    
    @property
    def isDescriptor(self):
        container = self.instance
        configurationInstance = Instance.objects.filter(parent=container.typeID, typeID=Terms.configuration) \
            .get(deleteTransaction__isnull=True)
        fields = Instance.objects.filter(parent=configurationInstance, typeID=Terms.field) \
            .filter(deleteTransaction__isnull=True)\
            .filter(value__field=Terms.name,\
                    value__referenceValue=self.field,
                    value__deleteTransaction__isnull=True)\
            .filter(value__field=Terms.descriptorType,
                    value__deleteTransaction__isnull=True)
        return fields.count() > 0

    @property
    def isOriginalReference(self):
        # If it is not an id, then return false.
        if not self.referenceValue:
            return False
        return self.referenceValue.parent == self.instance
        
    def getReferenceData(self, language=None):
        return { "id": self.id,
              "value": {"id" : self.referenceValue.id, "description": self.referenceValue.getDescription(language) },
              "position": self.position }
            
    def getCachedReferenceData(self):
        return { "id": self.id,
              "value": {"id" : self.referenceValue.id, "description": self.referenceValue._description },
              "position": self.position }
            
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newValue, transactionState):
        self.markAsDeleted(transactionState)
        return self.instance.addValue(self.field, newValue, self.position, transactionState);
    
    # Updates the position of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateIndex(self, newIndex, transactionState):
        self.markAsDeleted(transactionState)
        return Value.objects.create(id=uuid.uuid4().hex, instance=self.instance, 
            field=self.field, 
            stringValue = self.stringValue, 
            referenceValue = self.referenceValue, 
            position=newIndex, 
            transaction=transactionState.transaction)
    
    def markAsDeleted(self, transactionState):
        self.deleteTransaction = transactionState.transaction
        self.save()
    
    def deepDelete(self, transactionState):
        # If the field is special access, then make this and all of its children 
        # sourced to the same source as the parent of self.
        if self.field == Terms.specialAccess:
            descendents = self.instance._descendents()
            n = AccessRecord.objects.filter(id__in=descendents).delete()
            if self.instance.parent and self.instance.parent.accessrecord:
                AccessRecord.objects.bulk_create(\
                    map(lambda i: AccessRecord(id=i,source=self.instance.parent.accessrecord.source), descendents))
            
        if self.isOriginalReference:
            self.referenceValue.deepDelete(transactionState)
        self.markAsDeleted(transactionState)
        
    def checkWriteAccess(self, user):
        self.instance.checkWriteValueAccess(user, self.field, self.referenceValue)
        
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=Terms.publicAccess.id)&
                          Q(value__referenceValue__in=[Terms.findPrivilegeEnum, Terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessrecord__isnull=True)|
                        Q(referenceValue__accessrecord__source__in=sources))

    def anonymousReadFilter(f):
        sources=Instance.objects.filter(\
                          Q(value__field=Terms.publicAccess.id)&
                          Q(value__referenceValue__in=[Terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return f.filter(Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessrecord__isnull=True)|
                        Q(referenceValue__accessrecord__source__in=sources))

class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.OneToOneField('consentrecords.Instance', db_index=True, editable=False)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)

    def __str__(self):
        return "%s" % (self.text)
        
# Security Sources are used on targets to determine which record contains the security rules for the target.    
class AccessRecord(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Instance', primary_key=True, db_column='id', db_index=True, editable=False)
    source = dbmodels.ForeignKey('consentrecords.Instance', related_name='sources', db_index=True, editable=True)
    
    def __str__(self):
        return str(self.id)
        
class TermNames():
    # These verbs are associated with field IDs of values.
    uuName = '_uuname'
    configuration = '_configuration'
    field = '_field'
    boolean = '_boolean'
    name = '_name'
    dataType = '_data type'
    string = '_string'
    number = '_number'
    datestamp = '_datestamp'
    datestampDayOptional = '_datestamp (day optional)'
    translation = '_translation'
    object = '_object'
    ofKind = '_of kind'
    pickObjectPath = '_pick object path'
    enumerator = 'enumerator'
    maxCapacity = '_max capacity'
    uniqueValue = '_unique value'
    multipleValues = '_multiple values'
    addObjectRule = '_object add rule'
    pickObjectRule = '_pick one'
    createObjectRule = '_create one'
    descriptorType = '_descriptor type'
    yes = '_yes'
    no = '_no'
    user = '_user'
    userID = '_userID'
    email = '_email'
    firstName = '_first name'
    lastName = '_last name'
    text = '_text'
    textEnum = '_by text'
    countEnum = '_by count'
    accessRecord = '_access record'
    privilege = '_privilege'
    findPrivilege = '_find'
    readPrivilege = '_read'
    writePrivilege = '_write'
    administerPrivilege = '_administer'
    registerPrivilege = '_register'
    group = '_group'
    defaultAccess = '_default access'
    specialAccess = '_special access'
    custom = '_custom'
    publicAccess='_public access'
    primaryAdministrator='_primary administrator'

    initialKinds = [
        configuration,      # identifies a configuration instance (contained by a uuName)
        field,              # identifies a field instance (contained by a configuration)
        boolean,            # identifies an instance of type Boolean
        name,               # Defines the proper name of an object.
        ofKind,             # identifies the type of object for a field of "object" data type.
        pickObjectPath,     # identifies the path to objects that are to be picked.
        enumerator,         # identifies an enumerator
        dataType,           # defines the data type of a property
        maxCapacity,        # defines the quantity relationship of a field within its container.
        addObjectRule,      # defines the rule for adding objects to a field that supports multiple objects
        descriptorType,     # defines how the data of this field is used to describe its instance.
        user,               # identifies an instance of a user.
        userID,             # identifies the user identifier for the user.
        email,              # identifies an email address.
        firstName,          # identifies the first name.
        lastName,           # identifies the last name.
        accessRecord,       # identifies an access record for an instance
        privilege,          # identifies a privilege associated with an access record
        group,              # identifies a group associated with an access record
        defaultAccess,
        specialAccess,
        publicAccess,
        primaryAdministrator,
        ]

class Terms():
    uuName = None
    configuration = None                # identifies a configuration instance (contained by a uuName)
    field = None                        # identifies a field instance (contained by a configuration)
    boolean = None                      # identifies an instance of type Boolean
    name = None
    ofKind = None
    pickObjectPath = None
    enumerator = None
    dataType = None
    maxCapacity = None
    addObjectRule = None
    descriptorType = None
    user = None
    userID = None
    email = None
    firstName = None
    lastName = None
    translation = None
    text = None
    accessRecord = None
    privilege = None
    group = None
    defaultAccess = None
    specialAccess = None
    publicAccess=None                   # Identifies fields used to determine what privileges the public has with regard to an instance.
    primaryAdministrator=None           # Identifies fields that contain the primary administrator for an instance.
    
    textEnum = None                     # Identifies fields where instances of the containing type
                                        # are described by the text of values of this field type
                                        # contained within the instance.
    countEnum = None                    # Identifies fields where instances of the containing type 
                                        # are described by the number of values of this field type
                                        # contained within the instance. 
    
    objectEnum = None                   # Identifies fields whose values are other instances.
    stringEnum = None                   # Identifies fields whose values are strings.
    translationEnum = None              # Identifies fields whose values are translations.
    
    uniqueValueEnum = None              # Identifies fields that can have a single value
    multipleValuesEnum = None           # Identifies fields that can have 0 or more values
    
    pickObjectRuleEnum = None           # Identifies object fields that pick an existing object when adding a value
    createObjectRuleEnum = None         # Identifies object fields that create a new object when adding a value
    
    findPrivilegeEnum = None            # Identifies access records that give find access to an instance.
    readPrivilegeEnum = None            # Identifies access records that give read access to an instance.
    writePrivilegeEnum = None           # Identifies access records that give write access to an instance.
    administerPrivilegeEnum = None      # Identifies access records that give administer access to an instance.
    registerPrivilegeEnum = None        # Identifies access records that give register access to an instance.
    
    # Enumeration values of the default secure term.
    defaultCustomEnum = None            # Identifies instance types that have customized access by default.
    
    customAccessEnum = None             # Identifies instances that have customized access as a user setting.
    
    securityFields = None
    
    def initialize(transactionState=None):
        try:
            Terms.uuName = Terms.getUUName()
            nameList = NameList()
            Terms.configuration = Terms.getOrCreateTerm(TermNames.configuration, nameList, transactionState)
            Terms.field = Terms.getOrCreateTerm(TermNames.field, nameList, transactionState)
            Terms.boolean = Terms.getOrCreateTerm(TermNames.boolean, nameList, transactionState)
            Terms.name = Terms.getOrCreateTerm(TermNames.name, nameList, transactionState)
            Terms.ofKind = Terms.getOrCreateTerm(TermNames.ofKind, nameList, transactionState)
            Terms.pickObjectPath = Terms.getOrCreateTerm(TermNames.pickObjectPath, nameList, transactionState)
            Terms.enumerator = Terms.getOrCreateTerm(TermNames.enumerator, nameList, transactionState)
            Terms.dataType = Terms.getOrCreateTerm(TermNames.dataType, nameList, transactionState)
            Terms.maxCapacity = Terms.getOrCreateTerm(TermNames.maxCapacity, nameList, transactionState)
            Terms.addObjectRule = Terms.getOrCreateTerm(TermNames.addObjectRule, nameList, transactionState)
            Terms.descriptorType = Terms.getOrCreateTerm(TermNames.descriptorType, nameList, transactionState)
            Terms.user = Terms.getOrCreateTerm(TermNames.user, nameList, transactionState)
            Terms.userID = Terms.getOrCreateTerm(TermNames.userID, nameList, transactionState)
            Terms.email = Terms.getOrCreateTerm(TermNames.email, nameList, transactionState)
            Terms.firstName = Terms.getOrCreateTerm(TermNames.firstName, nameList, transactionState)
            Terms.lastName = Terms.getOrCreateTerm(TermNames.lastName, nameList, transactionState)
            Terms.translation = Terms.getOrCreateTerm(TermNames.translation, nameList, transactionState)
            Terms.accessRecord = Terms.getOrCreateTerm(TermNames.accessRecord, nameList, transactionState)
            Terms.privilege = Terms.getOrCreateTerm(TermNames.privilege, nameList, transactionState)
            Terms.group = Terms.getOrCreateTerm(TermNames.group, nameList, transactionState)
            Terms.accessRecord = Terms.getOrCreateTerm(TermNames.accessRecord, nameList, transactionState)
            Terms.defaultAccess = Terms.getOrCreateTerm(TermNames.defaultAccess, nameList, transactionState)
            Terms.specialAccess = Terms.getOrCreateTerm(TermNames.specialAccess, nameList, transactionState)
            Terms.publicAccess = Terms.getOrCreateTerm(TermNames.publicAccess, nameList, transactionState)
            Terms.primaryAdministrator = Terms.getOrCreateTerm(TermNames.primaryAdministrator, nameList, transactionState)
            Terms.securityFields = [Terms.accessRecord, Terms.defaultAccess, Terms.specialAccess, Terms.publicAccess, Terms.primaryAdministrator, ]
        except Instance.DoesNotExist: pass
        except Value.DoesNotExist: pass
    
        try: Terms.textEnum = Terms.getNamedEnumerator(Terms.descriptorType, TermNames.textEnum)
        except Value.DoesNotExist: pass
        try: Terms.countEnum = Terms.getNamedEnumerator(Terms.descriptorType, TermNames.countEnum);
        except Value.DoesNotExist: pass
    
        try: Terms.objectEnum = Terms.getNamedEnumerator(Terms.dataType, TermNames.object);
        except Value.DoesNotExist: pass
        try: Terms.stringEnum = Terms.getNamedEnumerator(Terms.dataType, TermNames.string);
        except Value.DoesNotExist: pass
        try: Terms.translationEnum = Terms.getNamedEnumerator(Terms.dataType, TermNames.translation);
        except Value.DoesNotExist: pass
    
        try: Terms.uniqueValueEnum = Terms.getNamedEnumerator(Terms.maxCapacity, TermNames.uniqueValue);
        except Value.DoesNotExist: pass
        try: Terms.multipleValuesEnum = Terms.getNamedEnumerator(Terms.maxCapacity, TermNames.multipleValues);
        except Value.DoesNotExist: pass
        
        try: Terms.pickObjectRuleEnum = Terms.getNamedEnumerator(Terms.addObjectRule, TermNames.pickObjectRule);
        except Value.DoesNotExist: pass
        try: Terms.createObjectRuleEnum = Terms.getNamedEnumerator(Terms.addObjectRule, TermNames.createObjectRule);
        except Value.DoesNotExist: pass
        
        try: Terms.findPrivilegeEnum = Terms.getNamedEnumerator(Terms.privilege, TermNames.findPrivilege);
        except Value.DoesNotExist: pass
        try: Terms.readPrivilegeEnum = Terms.getNamedEnumerator(Terms.privilege, TermNames.readPrivilege);
        except Value.DoesNotExist: pass
        try: Terms.writePrivilegeEnum = Terms.getNamedEnumerator(Terms.privilege, TermNames.writePrivilege);
        except Value.DoesNotExist: pass
        try: Terms.administerPrivilegeEnum = Terms.getNamedEnumerator(Terms.privilege, TermNames.administerPrivilege);
        except Value.DoesNotExist: pass
        try: Terms.registerPrivilegeEnum = Terms.getNamedEnumerator(Terms.privilege, TermNames.registerPrivilege);
        except Value.DoesNotExist: pass
            
        try: Terms.defaultCustomEnum = Terms.getNamedEnumerator(Terms.defaultAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
        try: Terms.customAccessEnum = Terms.getNamedEnumerator(Terms.specialAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
    def getUUName():
        try:
            return Instance.objects.get(value__deleteTransaction__isnull=True,
                value__stringValue=TermNames.uuName,\
                value__field=F("id"))
        except Instance.DoesNotExist:
            return Terms.createUUName()

    def getNamedInstance(uuname):
        try:
            return Instance.objects.get(deleteTransaction__isnull=True,
                value__deleteTransaction__isnull=True,
                value__field = Terms.uuName,
                value__stringValue=uuname)
        except Instance.DoesNotExist:
            raise Instance.DoesNotExist('the term "%s" is not recognized' % uuname)
    
    def getOrCreateTerm(uuname, nameLists, transactionState):
        try:
            return Terms.getNamedInstance(uuname)
        except Instance.DoesNotExist:
            i = Instance.objects.create(typeID=Terms.uuName, parent=None, transaction=transactionState.transaction)
            i.addStringValue(Terms.uuName, uuname, 0, transactionState)
            return i
            
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getNamedEnumerator(uuname, stringValue):
        if not uuname:
            raise ValueError("uuname is null")
        v = Value.objects.get(instance=uuname, field=Terms.enumerator,
                          deleteTransaction__isnull=True,
                          referenceValue__value__field=Terms.name,
                          referenceValue__value__deleteTransaction__isnull=True,
                          referenceValue__value__stringValue=stringValue)
        return v.referenceValue
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getTranslationNamedEnumerator(uuname, stringValue, languageCode):
        v = Value.objects.get(instance=uuname, field = Terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=Terms.translation,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue=stringValue,
                              referenceValue__value__languageCode=languageCode)
        return v.referenceValue
        
    def isUUID(s):
        return re.search('^[a-fA-F0-9]{32}$', s)
    
    # Return a 32 character hex string which represents the ID of the specified universal name.
    # If the argument is a 32 character hex string, then it is considered that ID. Otherwise,
    # it is looked up by name.
    def getInstance(uuname):
        if Terms.isUUID(uuname):
            return Instance.objects.get(pk=uuname);
        else:
            return Terms.getNamedInstance(uuname)
            
class UserInfo:
    def __init__(self, authUser):
        self.authUser = authUser
        self.instance = Instance.getUserInstance(authUser) if authUser.is_authenticated() else None
        self._findValueFilter = None
        self._readValueFilter = None
    
    @property    
    def is_administrator(self):
        return self.authUser.is_staff
        
    @property
    def is_authenticated(self):
        return self.authUser.is_authenticated()

    def findFilter(self, resultSet):
        if not self.is_authenticated:
            return resultSet.filter(Instance.anonymousFindFilter())
        elif self.is_administrator:
            return resultSet
        elif self.instance:
            return self.instance.findFilter(resultSet)
        else:
            return resultSet.filter(Instance.anonymousFindFilter()) # This case occurs while setting up a user.

    def findValueFilter(self, resultSet):
        if self._findValueFilter:
            return resultSet.filter(self._findValueFilter)
        elif self.is_administrator:
            return resultSet
        else:
            if not self.is_authenticated:
                self._findValueFilter = Value.anonymousFindFilter()
            else:
                self._findValueFilter = self.instance.findValueFilter
            return resultSet.filter(self._findValueFilter)

    def readValueFilter(self, resultSet):
        if self._readValueFilter:
            return resultSet.filter(self._readValueFilter)
        elif self.is_administrator:
            return resultSet
        else:
            if not self.is_authenticated:
                self._readValueFilter = Value.anonymousReadFilter()
            else:
                self._readValueFilter = self.instance.readValueFilter
            return resultSet.filter(self._readValueFilter)

    def readFilter(self, resultSet):
        if not self.is_authenticated:
            return resultSet.filter(Instance.anonymousFindFilter())
        elif self.is_administrator:
            return resultSet
        else:
            return self.instance.readFilter(resultSet)

    def administerFilter(self, resultSet):
        if not self.is_authenticated:
            return []   # If not authenticated, then return an empty iterable.
        elif self.is_administrator:
            return resultSet
        else:
            return self.instance.administerFilter(resultSet)

