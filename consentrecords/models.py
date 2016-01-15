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
            raise ValueError('current user is not authenticated')
        if not user.is_active:
            raise ValueError('current user is not active')
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
        
class Instance(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    typeID = dbmodels.ForeignKey('consentrecords.Instance', related_name='typeInstances', db_column='typeid', db_index=True, editable=False)
    parent = dbmodels.ForeignKey('consentrecords.Instance', related_name='children', db_column='parentid', db_index=True, null=True, editable=False)
    parentValue = dbmodels.OneToOneField('consentrecords.Value', related_name='valueChild', db_index=True, null=True)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    deleteTransaction = dbmodels.ForeignKey('consentrecords.Transaction', related_name='deletedInstance', db_index=True, null=True, editable=True)
        
    def __str__(self):
        try:
            d = self.description_set.get(language__isnull=True)
            if d:
                return d.text
            else:
                return "Deleted"
        except Description.DoesNotExist:
            return "Deleted"
    
    @property    
    def _parentDescription(self):
        return self.parent and str(self.parent)
        
    def _fieldName(fieldID):            #Previously verbString
        return fieldID.getSubValue(Terms.uuName).stringValue or str(fieldID)
    
    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, parent, transactionState):
        id = uuid.uuid4().hex
        i = Instance.objects.create(id=id, typeID=self, parent=parent,
                                    transaction=transactionState.transaction)
        return i
    
    def getDataType(self, fieldID):
        configuration = self.typeID.children.filter(typeID=Terms.configuration,deleteTransaction__isnull=True)[0]
        fields = configuration.children.filter(typeID=Terms.field,deleteTransaction__isnull=True)
        f = fields.get(value__fieldID=Terms.name,
                          value__referenceValue=fieldID,
                          value__deleteTransaction__isnull=True)
        v = f.value_set.filter(fieldID=Terms.dataType,deleteTransaction__isnull=True)[0]
        return v.referenceValue
    
    # addValue ensures that the value can be found for object values. 
    # addValue does not validate that self is writable.           
    def addValue(self, fieldID, value, position, transactionState):
        if self.getDataType(fieldID)==Terms.objectEnum:
            if not isinstance(value, Instance):
                f = list(UserInfo(transactionState.user).findFilter(Instance.objects.filter(pk=value)))
                if len(f) == 0:
                    raise Value.DoesNotExist()
                value = f[0]
            elif not value.canFind(transactionState.user):
                raise Value.DoesNotExist()
            return self.addReferenceValue(fieldID, value, position, transactionState)
        elif self.getDataType(fieldID)==Terms.translationEnum:
            return self.addTranslationValue(fieldID, value, position, transactionState)
        else:
            return self.addStringValue(fieldID, value, position, transactionState)

    def addStringValue(self, fieldID, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        return Value.objects.create(instance=self, fieldID=fieldID, stringValue = value, position=position, transaction=transactionState.transaction)

    def addTranslationValue(self, fieldID, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        if not isinstance(value, dict):
            raise ValueError("the value(%s) is not a dictionary" % str(value))
        return Value.objects.create(instance=self, fieldID=fieldID, 
                                    stringValue = value["text"], languageCode = value["languageCode"],
                                    position=position, transaction=transactionState.transaction)

    def _descendents(self):
        d = [self]
        i = 0
        while i < len(d):
            d.extend(d[i].children.filter(deleteTransaction__isnull=True))
            i += 1
        return d

    def addReferenceValue(self, fieldID, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        if not value:
            raise ValueError("the value is null")
            
        # If the fieldID is special access, then make this and all of its children sourced to self.
        if fieldID == Terms.specialAccess and value == Terms.customAccessEnum:
            descendents = self._descendents()
            n = AccessRecord.objects.filter(id__in=descendents).delete()
            AccessRecord.objects.bulk_create(map(lambda i: AccessRecord(id=i,source=self), descendents))
            
        return Value.objects.create(instance=self, fieldID=fieldID, referenceValue=value, position=position, transaction=transactionState.transaction)

    def createMissingSubValue(self, fieldID, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        if self.getDataType(fieldID)==Terms.objectEnum:
            if not Value.objects.filter(instance=self,fieldID=fieldID,referenceValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding object %s(%s)" % (str(self), str(fieldID), str(value)))
                self.addReferenceValue(fieldID, value, position, transactionState)
        elif self.getDataType(fieldID)==Terms.translationEnum:
            if not Value.objects.filter(instance=self,fieldID=fieldID,stringValue=value["text"],
                                    languageCode=value["languageCode"],
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding translation %s(%s)" % (str(self), str(fieldID), str(value)))
                self.addTranslationValue(fieldID, value, position, transactionState)
        else:
            if not Value.objects.filter(instance=self,fieldID=fieldID,stringValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding string %s(%s)" % (str(self), str(fieldID), str(value)))
                self.addStringValue(fieldID, value, position, transactionState)
        
    def _getSubValues(self, fieldID):
        vs = self.value_set.filter(fieldID=fieldID, deleteTransaction__isnull=True).order_by('position');
        return list(vs)
    
    # Returns a list of all of the values of self, aggregated by fieldID.id
    def _getValues(self, userInfo):
        vs = userInfo.findValueFilter(self.value_set.filter(deleteTransaction__isnull=True)).order_by('fieldID', 'position');
        values = {}
        for v in vs:
            if v.fieldID.id not in values:
                    values[v.fieldID.id] = []
            values[v.fieldID.id].append(v)
        return values
    
    def _getSubInstances(self, field): # Previously _getSubValueObjects
        return [v.referenceValue for v in self._getSubValues(field)]
        
    # Returns a unique value of the specified id.
    def getSubValue(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        try:
            return self.value_set.get(deleteTransaction__isnull=True, fieldID=field)
        except Value.DoesNotExist:
            return None
            
    def getSubInstance(self, field):
        if not field:
            raise ValueError("field is not specified")
            
        v = self.getSubValue(field)
        return v and v.referenceValue
     
    # Returns an iterable of the values within self associated with the specified field.       
    def findValues(self, field, value):
        return self.value_set.filter(Q(stringValue=value)|Q(referenceValue_id=value),deleteTransaction__isnull=True, fieldID=field)
        
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
    def _getDescription(self, verbs):
        r = []
        for fieldID, dataType, descriptorType in verbs:
            if descriptorType == Terms.textEnum:
                vs = self.value_set.filter(fieldID=fieldID, deleteTransaction__isnull=True).order_by('position')
                if dataType == Terms.objectEnum:
                    for v in vs:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.fieldID), v.stringValue))
                            r.append(v.referenceValue.description_set.get(language__isnull=True).text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                else:
                    r.extend([v.stringValue for v in vs])
            elif descriptorType == Terms.countEnum:
                vs = self.value_set.filter(fieldID=fieldID, deleteTransaction__isnull=True)
                r.append(str(vs.count()))
            else:
                raise ValueError("unrecognized descriptorType: %s ('%s' or '%s')" % (str(descriptorType), str(Terms.textEnum), str(Terms.countEnum)));
                    
        return " ".join(r)
        
    def cacheDescription(self, nameLists):
        s = self._getDescription(nameLists.getNameUUIDs(self.typeID))
        Description.objects.update_or_create(instance = self, 
                                             language = None, 
                                             defaults={'text': s})
        return s
    
    # Return a list of the instances for which this instance contributes
    # to the description.
    @property
    def _descriptionReferences(self):
        values = self.referenceValues.filter(deleteTransaction__isnull=True)
        return [v.instance for v in filter(lambda v: v.isDescriptor, values)]

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
        d = Description.objects.filter(instance=self, language__isnull=True)
        if d.exists(): 
            return d[0].text
        else:
            return "Deleted"

    # Get the cached description of this Instance.        
    def description(self, language=None):
        if language:
            return Description.objects.get(instance=self, language=language).text
        else:
            return Description.objects.get(instance=self, language__isnull=True).text
    
    @property    
    def _allInstances(self):    # was _getAllInstances()
        return self.typeInstances.filter(deleteTransaction__isnull=True);
            
    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, language=None):
        return {'id': None, 'value': {'id': self.id, 'description': self.description(language)}}
        
    # Returns a dictionary by field where each value is
    # a duple containing the value containing the name and 
    # the instance referenced by self from the key field.
    def _getSubValueReferences(self):
        vs2 = Value.objects.filter(fieldID__in=[Terms.name, Terms.uuName],
                                   deleteTransaction__isnull=True)
        vs1 = self.value_set.filter(deleteTransaction__isnull=True)\
                            .prefetch_related(Prefetch('referenceValue__value_set',
                                                       queryset=vs2,
                                                       to_attr='name_values'));
        d = {}
        for v1 in vs1:
            # Ensure there is a referenceValue, because some properties of a field may
            # not be an object (such as pickValuePath).
            if v1.referenceValue:
                d[v1.fieldID] = (v1.referenceValue.name_values[0], v1.referenceValue)
        return d
    
    # For a parent field when getting data, construct this special field record
    # that can be used to display this field data.
    def getParentReferenceFieldData(self):
        name = self.getSubValue(Terms.uuName).stringValue
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
        d = self._getSubValueReferences()
        fieldData = None
        if Terms.name in d and Terms.dataType in d:
            nameReference = d[Terms.name]
            dataTypeReference = d[Terms.dataType]
            fieldData = {"id" : self.id, 
                         "name" : nameReference[0].stringValue,
                         "nameID" : nameReference[1].id,
                         "dataType" : dataTypeReference[0].stringValue,
                         "dataTypeID" : dataTypeReference[1].id}
            if Terms.maxCapacity in d:
                fieldData["capacity"] = d[Terms.maxCapacity][0].stringValue
            else:
                fieldData["capacity"] = TermNames.multipleValues
                
            if Terms.descriptorType in d:
                fieldData["descriptorType"] = d[Terms.descriptorType][0].stringValue
            
            if Terms.addObjectRule in d:
                fieldData["objectAddRule"] = d[Terms.addObjectRule][0].stringValue
            
            if fieldData["dataTypeID"] == Terms.objectEnum.id:
                if Terms.ofKind in d:
                    ofKindReference = d[Terms.ofKind]
                    fieldData["ofKind"] = ofKindReference[0].stringValue
                    fieldData["ofKindID"] = ofKindReference[1].id
                v = self.getSubValue(Terms.pickObjectPath)
                if v:
                    fieldData["pickObjectPath"] = v.stringValue;
        
        return fieldData
    
    # Return an array where each element contains the id and description for an object that
    # is contained by self.
    def _getSubReferences(self, field, language=None):
        return [v.getReferenceData(language) for v in self._getSubValues(field)]
    
    def _getCellData(self, fieldData, values, language=None):
        cell = {"field": fieldData}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        elif fieldData["dataTypeID"] == Terms.objectEnum.id:
            cell["data"] = [v.getReferenceData(language) for v in values[fieldID]]
        elif fieldData["dataTypeID"] == Terms.translationEnum.id:
            cell["data"] = [{"id": v.id, "value": {"text": v.stringValue, "languageCode": v.languageCode}} for v in values[fieldID]]
        else:
            # Default case is that each datum in this cell contains a unique value.
            cell["data"] = [{"id": v.id, "value": v.stringValue} for v in values[fieldID]]
        return cell
                
    # Returns an array of arrays.
    def getData(self, fieldsData, language=None, userInfo=None):
        values = self._getValues(userInfo)
        return [self._getCellData(fieldData, values, language) for fieldData in fieldsData]

    # self should be a configuration object with fields.
    def getConfiguration(self):
        return [{"field": fieldObject.getFieldData()} for fieldObject in self._getSubInstances(Terms.field)]

    def getMaxElementIndex(self, field):
        maxElementIndex = reduce(lambda x,y: max(x, y), 
                                 [e.position for e in self._getSubValues(field)],
                                 -1)
        if maxElementIndex < 0:
            return None
        else:
            return maxElementIndex

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
        #DeletedInstance.objects.create(id=self, transaction=transactionState.transaction)

    def deepDelete(self, transactionState):
        queue = [self]
        self.deleteTransaction = transactionState.transaction
        self.save()
        while len(queue) > 0:
            next = queue[0]
            queue = queue[1:]
            instances = next.children.filter(deleteTransaction__isnull=True).only('id')
            values = next.value_set.filter(deleteTransaction__isnull=True).only('id')
            queue.extend(instances)
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
                              fieldID=Terms.field)\
                              .select_related('referenceValue')
        for v in vs:
            vs2 = v.referenceValue.value_set.filter(deleteTransaction__isnull=True,
                              fieldID=Terms.name)\
                              .select_related('referenceValue')
            for v2 in vs2:
                vs3 = v2.referenceValue.value_set.filter(deleteTransaction__isnull=True,
                              fieldID=Terms.uuName,
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
                
        privileges = [Terms.findPrivilegeEnum, Terms.readPrivilegeEnum,
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
        
        if source.value_set.filter(fieldID=Terms.primaryAdministrator, deleteTransaction__isnull=True).count():
            if source.value_set.filter(fieldID=Terms.primaryAdministrator, deleteTransaction__isnull=True)[0].referenceValue == userInfo.instance:
                return Terms.administerPrivilegeEnum
                
        minPrivilege = None
        if source.value_set.filter(fieldID=Terms.publicAccess, deleteTransaction__isnull=True).count():
            minPrivilege=source.value_set.filter(fieldID=Terms.publicAccess, deleteTransaction__isnull=True)[0].referenceValue
        
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
            .annotate(pField=F('instance__value__fieldID'),privilege=F('instance__value__referenceValue'),
                      pDeleted=F('instance__value__deleteTransaction')
                     ) \
            .filter(pField=Terms.privilege.id, privilege__in=privilegeIDs,pDeleted=None)
    
    ### Returns True if this user (self) is the primary administrator of the specified instance
    def isPrimaryAdministrator(self, instance):
        try:
            return instance.accessrecord.source.value_set.filter(fieldID=Terms.primaryAdministrator,
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
                        (((Q(value__fieldID=Terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__fieldID=Terms.primaryAdministrator.id)\
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
        privilegeIDs = [Terms.findPrivilegeEnum.id, Terms.readPrivilegeEnum.id,
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
    
    ## Instances can be read if the specified user is a super user or there is no accessRecord
    ## associated with this instance.
    ## Otherwise, the user must have a permission, public access set to read or be the primary administrator.
    def canFind(self, user):
        if user.is_staff:
            return True

        userInstance = Instance.getUserInstance(user)
        if user.is_authenticated and \
           userInstance.isPrimaryAdministrator(self):
            return True
                            
        try:
            return self.accessrecord.source.value_set.filter(fieldID=Terms.publicAccess, 
                                                         referenceValue__in=[Terms.findPrivilegeEnum, Terms.readPrivilegeEnum, Terms.writePrivilegeEnum],
                                                         deleteTransaction__isnull=True).exists() or \
                   self.accessrecord.source.filter(children__typeID=Terms.accessRecord, 
                        children__value__in=userInstance._getPrivilegeValues([Terms.findPrivilegeEnum.id, 
                                                                              Terms.readPrivilegeEnum.id, 
                                                                              Terms.writePrivilegeEnum.id, 
                                                                              Terms.administerPrivilegeEnum.id]))\
                        .exists()
        except AccessRecord.DoesNotExist:
            return False
    
    def canRead(self, user):
        if user.is_staff:
            return True

        userInstance = Instance.getUserInstance(user)
        if user.is_authenticated and \
           userInstance.isPrimaryAdministrator(self):
            return True
                            
        try:
            return self.accessrecord.source.value_set.filter(fieldID=Terms.publicAccess, 
                                                         referenceValue__in=[Terms.readPrivilegeEnum, Terms.writePrivilegeEnum],
                                                         deleteTransaction__isnull=True).exists() or \
                   self.accessrecord.source.filter(children__typeID=Terms.accessRecord, 
                        children__value__in=userInstance._getPrivilegeValues([Terms.readPrivilegeEnum.id, Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]))\
                        .exists()
        except AccessRecord.DoesNotExist:
            return False
    
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def canWrite(self, user):
        if user.is_staff:
            return True
        
        userInstance = Instance.getUserInstance(user)
        if user.is_authenticated and \
           userInstance.isPrimaryAdministrator(self):
            return True
                
        try:
            return self.accessrecord.source.value_set.filter(fieldID=Terms.publicAccess, 
                                                         referenceValue=Terms.writePrivilegeEnum,
                                                         deleteTransaction__isnull=True).exists() or \
                   self.accessrecord.source.children.filter(typeID=Terms.accessRecord, 
                value__in=userInstance._getPrivilegeValues([Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]))\
                .exists()
        except AccessRecord.DoesNotExist:
            return False
        
    ## Instances can be administered if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has administer privilege on the instance.                        
    def canAdminister(self, user):
        if user.is_staff:
            return True

        userInstance = Instance.getUserInstance(user)
        if user.is_authenticated and \
           userInstance.isPrimaryAdministrator(self):
            return True
                
        try:
            return self.accessrecord.source.children.filter(typeID=Terms.accessRecord, 
                value__in=userInstance._getPrivilegeValues([Terms.administerPrivilegeEnum.id]))\
                .exists()
        except AccessRecord.DoesNotExist:
            return False
        
    def anonymousFindFilter(f):
        sources=Instance.objects.filter(\
                          Q(value__fieldID=Terms.publicAccess.id)&
                          Q(value__referenceValue__in=[Terms.findPrivilegeEnum, Terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return f.filter(Q(accessrecord__isnull=True)|
                        Q(accessrecord__source__in=sources))
        
    def securityValueFilter(self, f, privilegeIDs):
        sourceValues = self._getPrivilegeValues(privilegeIDs)
        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=Terms.accessRecord)&
                         Q(children__value__in=sourceValues))
                        |
                        (((Q(value__fieldID=Terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__fieldID=Terms.primaryAdministrator.id)\
                           &Q(value__referenceValue=self)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                         )\
                        )\
                       )
        
        return f.filter(Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessrecord__isnull=True)|
                        Q(referenceValue__accessrecord__source__in=sources))
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def findValueFilter(self, f):
        privilegeIDs = [Terms.findPrivilegeEnum.id, Terms.readPrivilegeEnum.id,
                      Terms.writePrivilegeEnum.id, Terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(f, privilegeIDs)
    
    
    @property                
    def defaultCustomAccess(self):
        return self.value_set.filter(fieldID=Terms.defaultAccess, deleteTransaction__isnull=True).exists()
                    
    def getUserInstance(user):
        fieldID = Terms.getNamedInstance(TermNames.userID)
        userID = user.id
        if isinstance(userID, uuid.UUID):
            userID = userID.hex
        qs = Value.objects.filter(fieldID=fieldID, stringValue=userID,
            deleteTransaction__isnull=True)
        return qs[0].instance if len(qs) else None
    
    @property    
    def user(self):
        fieldID = Terms.getNamedInstance(TermNames.userID)
        id = self.value_set.get(fieldID=fieldID, deleteTransaction__isnull=True).stringValue
        return AuthUser.objects.get(pk=id)
    
class DeletedInstance(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Instance', primary_key=True, db_column='id', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(self.id)
        
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
        return reduce(lambda a, b: a if a else b if v.fieldID == b[0] else None, fields) 
    
class Value(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    fieldID = dbmodels.ForeignKey('consentrecords.Instance', related_name='fieldValues', db_column='fieldid', db_index=True, editable=False)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    referenceValue = dbmodels.ForeignKey('consentrecords.Instance', related_name='referenceValues', db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    deleteTransaction = dbmodels.ForeignKey('consentrecords.Transaction', related_name='deletedValue', db_index=True, null=True, editable=True)
    
    def __str__(self):
        d = str(self.referenceValue) if self.referenceValue else self.stringValue
        return "%s[%s:%s]@%s" % (str(self.instance), 
                                 str(self.fieldID), 
                                 d, 
                                 str(self.position))
    
    @property
    def field(self):
        return self.fieldID
        
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
            .filter(value__fieldID=Terms.name,\
                    value__referenceValue=self.fieldID,
                    value__deleteTransaction__isnull=True)\
            .filter(value__fieldID=Terms.descriptorType,
                    value__deleteTransaction__isnull=True)
        return fields.count() > 0

    @property
    def isOriginalReference(self):
        # If it is not an id, then return false.
        if not self.referenceValue:
            return False
        return self.referenceValue.parent == self.instance
        
    def getReferenceData(self, language=None):
        description = Description.objects.get(instance=self.referenceValue, language__isnull=True)
        return { "id": self.id,
              "value": {"id" : self.referenceValue.id, "description": description.text },
              "position": self.position }
            
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newValue, transactionState):
        self.markAsDeleted(transactionState)
        return self.instance.addValue(self.fieldID, newValue, self.position, transactionState);
    
    # Updates the position of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateIndex(self, newIndex, transactionState):
        self.markAsDeleted(transactionState)
        return Value.objects.create(instance=self.instance, 
            fieldID=self.fieldID, 
            stringValue = self.stringValue, 
            referenceValue = self.referenceValue, 
            position=newIndex, 
            transaction=transactionState.transaction)
    
    def markAsDeleted(self, transactionState):
        self.deleteTransaction = transactionState.transaction
        self.save()
        #DeletedValue.objects.create(id=self.id, transaction=transactionState.transaction)
    
    def deepDelete(self, transactionState):
        # If the fieldID is special access, then make this and all of its children 
        # sourced to the same source as the parent of self.
        if self.fieldID == Terms.specialAccess:
            descendents = self.instance._descendents()
            n = AccessRecord.objects.filter(id__in=descendents).delete()
            if self.instance.parent and self.instance.parent.accessrecord:
                AccessRecord.objects.bulk_create(\
                    map(lambda i: AccessRecord(id=i,source=self.instance.parent.accessrecord.source), descendents))
            
        if self.isOriginalReference:
            self.referenceValue.deepDelete(transactionState)
        self.markAsDeleted(transactionState)
        
    def anonymousFindFilter(f):
        sources=Instance.objects.filter(\
                          Q(value__fieldID=Terms.publicAccess.id)&
                          Q(value__referenceValue__in=[Terms.findPrivilegeEnum, Terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return f.filter(Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessrecord__isnull=True)|
                        Q(referenceValue__accessrecord__source__in=sources))

class DeletedValue(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Value', primary_key=True, db_column='id', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(self.id)
        
class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    language = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=True)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)

    def __str__(self):
        return "%s - %s" % (self.language, self.text)
        
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
    
    # Enumeration values of the default secure term.
    defaultCustomEnum = None            # Identifies instance types that have customized access by default.
    
    customAccessEnum = None             # Identifies instances that have customized access as a user setting.
    
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
            
        try: Terms.defaultCustomEnum = Terms.getNamedEnumerator(Terms.defaultAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
        try: Terms.customAccessEnum = Terms.getNamedEnumerator(Terms.specialAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
    def getUUName():
        try:
            return Instance.objects.get(value__deleteTransaction__isnull=True,
                value__stringValue=TermNames.uuName,\
                value__fieldID=F("id"))
        except Instance.DoesNotExist:
            return Terms.createUUName()

    def getNamedInstance(uuname):
        try:
            return Instance.objects.get(deleteTransaction__isnull=True,
                value__deleteTransaction__isnull=True,
                value__fieldID = Terms.uuName,
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
        v = Value.objects.get(instance=uuname, fieldID=Terms.enumerator,
                          deleteTransaction__isnull=True,
                          referenceValue__value__fieldID=Terms.name,
                          referenceValue__value__deleteTransaction__isnull=True,
                          referenceValue__value__stringValue=stringValue)
        return v.referenceValue
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getTranslationNamedEnumerator(uuname, stringValue, languageCode):
        v = Value.objects.get(instance=uuname, fieldID = Terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__fieldID=Terms.translation,
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
        self.instance = Instance.getUserInstance(authUser) if authUser.is_authenticated else None
    
    @property    
    def is_administrator(self):
        return self.authUser.is_staff
        
    @property
    def is_authenticated(self):
        return self.authUser.is_authenticated()

    def findFilter(self, resultSet):
        if not self.is_authenticated:
            return Instance.anonymousFindFilter(resultSet)
        elif self.is_administrator:
            return resultSet
        else:
            return self.instance.findFilter(resultSet)

    def findValueFilter(self, resultSet):
        if not self.is_authenticated:
            return Value.anonymousFindFilter(resultSet)
        elif self.is_administrator:
            return resultSet
        else:
            return self.instance.findValueFilter(resultSet)

    def readFilter(self, resultSet):
        if not self.is_authenticated:
            return Instance.anonymousFindFilter(resultSet)
        elif self.is_administrator:
            return resultSet
        else:
            return self.instance.readFilter(resultSet)

    def administerFilter(self, resultSet):
        if not self.is_authenticated:
            return []	# If not authenticated, then return an empty iterable.
        elif self.is_administrator:
            return resultSet
        else:
            return self.instance.administerFilter(resultSet)

