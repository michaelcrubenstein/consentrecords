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
    
    def __str__(self):
        return str(self.creation_time)
    
    def createTransaction(user):
        if not user.is_authenticated():
            raise RuntimeError('current user is not authenticated')
        if not user.is_active:
            raise RuntimeError('current user is not active')
        return Transaction.objects.create(user=user)
        
class TransactionState:
    mutex = Lock()
    
    def __init__(self, user):
        self.currentTransaction = None
        self.user = user
            
    @property    
    def transaction(self):
        if self.currentTransaction == None:
            self.currentTransaction = Transaction.createTransaction(self.user)

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
    transaction = dbmodels.ForeignKey(Transaction, db_index=True, editable=False)
    deleteTransaction = dbmodels.ForeignKey(Transaction, related_name='deletedInstance', db_index=True, null=True, editable=True)
        
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
        if parent:
            Containment.objects.bulk_create([Containment(ancestor=j.ancestor, descendent=i) for j in parent.ancestors.all()])
        Containment.objects.create(ancestor=i, descendent=i)
        return i
    
    def getDataType(self, field):
        try:
            configuration = self.typeID.children.filter(typeID=terms.configuration,deleteTransaction__isnull=True)[0]
            fields = configuration.children.filter(typeID=terms.field,deleteTransaction__isnull=True)
            f = fields.get(value__field=terms.name,
                              value__referenceValue=field,
                              value__deleteTransaction__isnull=True)
            v = f.value_set.filter(field=terms.dataType,deleteTransaction__isnull=True)[0]
            return v.referenceValue
        except Instance.DoesNotExist:
            raise Instance.DoesNotExist('field "%s" does not exist in configuration of %s'%(field, self.typeID))
    
    # addValue ensures that the value can be found for object values. 
    # addValue does not validate that self is writable.           
    def addValue(self, field, value, position, transactionState):
        if value == None:
            raise ValueError("value is not specified")
        
        dt = self.getDataType(field)
        if dt==terms.objectEnum:
            if isinstance(value, Instance):
                if value._canFind(transactionState.user):
                    return self.addReferenceValue(field, value, position, transactionState)
                else:
                    raise Instance.DoesNotExist()
            elif isinstance(value, dict) and "instanceID" in value:
                f = list(UserInfo(transactionState.user).findFilter(Instance.objects.filter(pk=value["instanceID"])))
                if len(f) == 0:
                    raise Value.DoesNotExist("specified primary key for instance does not exist")
                value = f[0]
                return self.addReferenceValue(field, value, position, transactionState)
            else:
                raise RuntimeError("specified value is not an Instance or a dictionary with an instanceID")
        elif dt==terms.translationEnum:
            return self.addTranslationValue(field, value, position, transactionState)
        else:
            return self.addStringValue(field, value["text"], position, transactionState)

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

    # Returns a newly created value contained by self with the specified referenceValue
    def addReferenceValue(self, field, instance, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid" % position)
        if not instance:
            raise ValueError("the instance is null")
            
        # If the field is special access, then make this and all of its children sourced to self.
        if field == terms.specialAccess and instance == terms.customAccessEnum:
            descendents = self._descendents()
            n = AccessRecord.objects.filter(id__in=descendents).delete()
            AccessRecord.objects.bulk_create(map(lambda i: AccessRecord(id=i,source=self), descendents))
            
        return Value.objects.create(id=uuid.uuid4().hex, instance=self, field=field, referenceValue=instance, position=position, transaction=transactionState.transaction)

    def createMissingSubValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
            
        dt = self.getDataType(field)
        if dt==terms.objectEnum:
            if not Value.objects.filter(instance=self,field=field,referenceValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding object %s(%s)" % (str(self), str(field), str(value)))
                self.addReferenceValue(field, value, position, transactionState)
        elif dt==terms.translationEnum:
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
            if v.field not in terms.securityFields or cache.value:
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
        configuration = self.getSubInstance(terms.configuration)
        results = []
        if configuration:
            elementIDs = [terms.name, terms.dataType]
            for fieldObject in configuration._getSubInstances(terms.field):
                r = fieldObject.getSubInstance(terms.descriptorType)
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
            if descriptorType == terms.textEnum:
                vs = self.value_set.filter(field=field, deleteTransaction__isnull=True).order_by('position')
                if dataType == terms.objectEnum:
                    for v in vs:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.field), v.stringValue))
                            r.append(v.referenceValue.description.text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                else:
                    r.extend([v.stringValue for v in filter(lambda v: v.stringValue, vs)])
            elif descriptorType == terms.firstTextEnum:
                vs = self.value_set.filter(field=field, deleteTransaction__isnull=True).order_by('position')
                if vs.count() > 0:
                    v = vs[0]
                    if dataType == terms.objectEnum:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.field), v.stringValue))
                            r.append(v.referenceValue.description.text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                    else:
                        if v.stringValue:
                            r.append(v.stringValue)
            elif descriptorType == terms.countEnum:
                vs = self.value_set.filter(field=field, deleteTransaction__isnull=True)
                r.append(str(vs.count()))
            else:
                raise ValueError("unrecognized descriptorType: %s ('%s' or '%s')" % (str(descriptorType), str(terms.textEnum), str(terms.countEnum)))
                    
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

    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, userInfo, language=None):
        d = {'id': None, 
             'instanceID': self.id, 
             'description': self.getDescription(language),
             'parentID': self.parent and self.parent.id,
             'typeName': self.typeID.getDescription()}
        privilege = self.getPrivilege(userInfo)
        if privilege:
            d["privilege"] = privilege.getDescription()
        return d
    
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
    # Self is an instance of type field.
    def _getSubValueReferences(self):
        vs2 = Value.objects.filter(field=terms.name,
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
                     "dataType" : TermNames.objectEnum,
                     "dataTypeID" : terms.objectEnum.id,
                     "capacity" : TermNames.uniqueValueEnum,
                     "ofKind" : name,
                     "ofKindID" : self.id}
        return fieldData
    
    # Returns a dictionary of information about a field with this configuration.
    def getFieldDataByName(self, name, language=None):
        if terms.isUUID(name):
            # The key may be the key of a field object or the key of a term that is 
            # the name of a field object in the configuration.
            fieldObject = Instance.objects.get(pk=name)
            if fieldObject.typeID != terms.field:
                fieldObject = self.getFieldByReferenceValue(name)
            elif fieldObject.parent != self:
                raise RuntimeError("the specified field is not contained within the configuration of this type")
        else:
            fieldObject = self._getValueByName(name)
        return fieldObject.getFieldData(language)

    # Returns a dictionary of information about a field instance.                 
    def getFieldData(self, language=None):
        return self._getFieldDataFromValues(self._getSubValueReferences(), language)
    
    def _getFieldDataFromValues(self, values, language):
        fieldData = None
        if terms.name in values and terms.dataType in values:
            nameReference = values[terms.name]
            dataTypeReference = values[terms.dataType]
            fieldData = {"id" : self.id, 
                         "name" : nameReference[0],
                         "nameID" : nameReference[1],
                         "dataType" : dataTypeReference[0],
                         "dataTypeID" : dataTypeReference[1]}
            if terms.maxCapacity in values:
                fieldData["capacity"] = values[terms.maxCapacity][0]
            else:
                fieldData["capacity"] = TermNames.multipleValuesEnum
                
            if terms.descriptorType in values:
                fieldData["descriptorType"] = values[terms.descriptorType][0]
            
            if terms.addObjectRule in values:
                fieldData["objectAddRule"] = values[terms.addObjectRule][0]
            
            if fieldData["dataTypeID"] == terms.objectEnum.id:
                if terms.ofKind in values:
                    ofKindReference = values[terms.ofKind]
                    fieldData["ofKind"] = ofKindReference[0]
                    fieldData["ofKindID"] = ofKindReference[1]
                if terms.pickObjectPath in values:
                    fieldData["pickObjectPath"] = values[terms.pickObjectPath]
        else:
            raise ValueError("values does not contain name or dataType: %s" % values)
            
        return fieldData
    
    # Returns the fieldsData from the database for self, which is a term.
    def getFieldsData(self, language=None):
        vs2 = Value.objects.filter(field=terms.name,
                            deleteTransaction__isnull=True)

        vs1 = Value.objects.filter(deleteTransaction__isnull=True)\
                            .select_related('field')\
                            .select_related('referenceValue')\
                            .prefetch_related(Prefetch('referenceValue__value_set',
                                                       queryset=vs2,
                                                       to_attr='name_values'))

        fields = Instance.objects.filter(typeID=terms.field, deleteTransaction__isnull=True)\
                                 .filter(parent__parent=self)\
                                 .prefetch_related(Prefetch('value_set', queryset=vs1, to_attr='values'))\
                                 .order_by('parentValue__position')
        return [field._getFieldDataFromValues(Instance._sortValueDataByField(field.values), language) for field in fields]

    def _getCellValues(dataTypeID, values, userInfo, language=None):
        if dataTypeID == terms.objectEnum.id:
            return [{ "id": v.id,
                      "instanceID" : v.referenceValue.id, 
                      "description": v.referenceValue._description,
                      'privilege': v.referenceValue.getPrivilege(userInfo).getDescription(),
                      "position": v.position } for v in values]
        elif dataTypeID == terms.translationEnum.id:
            return [{"id": v.id, "text": v.stringValue, "languageCode": v.languageCode} for v in values]
        else:
            # Default case is that each datum in this cell contains a unique value.
            return [{"id": v.id, "text": v.stringValue} for v in values]
            
    def getReadableSubValues(self, field, userInfo):
        return userInfo.readValueFilter(self.value_set.filter(field=field, deleteTransaction__isnull=True)) \
            .order_by('position')\
            .select_related('referenceValue')\
            .select_related('referenceValue__typeID')\
            .select_related('referenceValue__typeID__description__text')
    
    
    def _getCellData(self, fieldData, values, userInfo, language=None):
        if not fieldData:
            raise ValueError("fieldData is null")
        cell = {"field": fieldData}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        else:
            cell["data"] = Instance._getCellValues(fieldData["dataTypeID"], values[fieldID], userInfo, language)
        return cell
                
    # Returns an array of arrays.
    def getData(self, vs, fieldsData, userInfo, language=None):
        values = self._groupValuesByField(vs, userInfo)
        return [self._getCellData(fieldData, values, userInfo, language) for fieldData in fieldsData]

    # self should be a configuration object with fields.
    def getConfiguration(self):
        return [{"field": fieldObject.getFieldData()} for fieldObject in self._getSubInstances(terms.field)]

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
                
    # Return a filter of all of the instances of this type that exactly match the specified name.
    def getInstanceByName(self, nameField, name, userInfo):
        f = userInfo.findFilter(self.typeInstances.filter(deleteTransaction__isnull=True,
                                         value__deleteTransaction__isnull=True,
                                         value__field=nameField,
                                         value__stringValue__iexact=name))
        return f[0] if len(f) else None
                                            
    # Return the Value for the specified configuration. If it doesn't exist, raise a Value.DoesNotExist.   
    # Self is of type configuration.
    def _getValueByName(self, name):
        try:
            return self.value_set.select_related('referenceValue')\
                                 .get(deleteTransaction__isnull=True,
                                      field=terms.field,
                                      referenceValue__value__deleteTransaction__isnull=True,
                                      referenceValue__value__field=terms.name,
                                      referenceValue__value__referenceValue__typeID=terms.term,
                                      referenceValue__value__referenceValue__value__deleteTransaction__isnull=True,
                                      referenceValue__value__referenceValue__value__field=terms.name,
                                      referenceValue__value__referenceValue__value__stringValue=name)\
                                 .referenceValue
        except Value.DoesNotExist:
            raise Value.DoesNotExist('the field name "%s" is not recognized for "%s" configuration' % (name, self))

    # Return the Value for the specified configuration. If it doesn't exist, raise a Value.DoesNotExist.   
    # Self is of type configuration.
    def getFieldByReferenceValue(self, key):
        return self.value_set.select_related('referenceValue')\
                             .get(deleteTransaction__isnull=True,
                                  field=terms.field,
                                  referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=terms.name,
                                  referenceValue__value__referenceValue__id=key)\
                             .referenceValue

    @property
    def inheritsSecurity(self):
        return True
        
    def comparePrivileges(a, b):
        if a == b:
            return a
        elif not a:
            return b
                
        privileges = [terms.findPrivilegeEnum, terms.readPrivilegeEnum, terms.registerPrivilegeEnum, 
                      terms.writePrivilegeEnum, terms.administerPrivilegeEnum]
                      
        aIndex = privileges.index(a)
        return b if b in privileges[(aIndex+1):] else a
        
    # returns the privilege level that the specified user instance has for this instance. 
    def getPrivilege(self, userInfo):
        if userInfo.is_administrator:
            return terms.administerPrivilegeEnum
            
        try:
            source = self.accessrecord.source
        except AccessRecord.DoesNotExist:
            return terms.readPrivilegeEnum
            
        minPrivilege = None
        minPrivilegeFilter = source.value_set.filter(field=terms.publicAccess, deleteTransaction__isnull=True)\
                                   .select_related('referenceValue__description__text')
        if minPrivilegeFilter.exists():
            minPrivilege=minPrivilegeFilter[0].referenceValue
        
        if not userInfo.instance:
            return minPrivilege
        
        if source.value_set.filter(field=terms.primaryAdministrator, deleteTransaction__isnull=True).count():
            if source.value_set.filter(field=terms.primaryAdministrator, deleteTransaction__isnull=True)[0].referenceValue == userInfo.instance:
                return terms.administerPrivilegeEnum
                
        f = source.children.filter(typeID=terms.accessRecord, deleteTransaction__isnull=True)\
            .filter(Q(value__referenceValue=userInfo.instance,
                      value__deleteTransaction__isnull=True)|
                    (Q(value__deleteTransaction__isnull=True,
                       value__referenceValue__value__referenceValue=userInfo.instance,
                       value__referenceValue__value__deleteTransaction__isnull=True)))
                      
        p = map(lambda i: i.value_set.filter(field=terms.privilege, deleteTransaction__isnull=True)\
                           .select_related('referenceValue__description__text')[0].referenceValue, f)
        
        return reduce(Instance.comparePrivileges, p, minPrivilege)
    
    ### For the specified self user, return a filter of values indicating which access records are accessible to this user.   
    def _getPrivilegeValues(self, privilegeIDs):
        return Value.objects.filter(Q(referenceValue=self)|\
                                       (Q(referenceValue__value__referenceValue=self)\
                                        &Q(referenceValue__value__deleteTransaction__isnull=True)\
                                       ),\
                                       instance__typeID=terms.accessRecord,
                                       deleteTransaction__isnull=True
                                       ) \
            .annotate(pField=F('instance__value__field'),privilege=F('instance__value__referenceValue'),
                      pDeleted=F('instance__value__deleteTransaction')
                     ) \
            .filter(pField=terms.privilege.id, privilege__in=privilegeIDs,pDeleted=None)
    
    ### Returns True if this user (self) is the primary administrator of the specified instance
    def isPrimaryAdministrator(self, instance):
        try:
            return instance.accessrecord.source.value_set.filter(field=terms.primaryAdministrator,
                referenceValue=self,
                deleteTransaction__isnull=True).exists()
        except AccessRecord.DoesNotExist:
            return False
    
    def _securityFilter(self, f, privilegeIDs, accessRecordOptional=True):
        sourceValues = self._getPrivilegeValues(privilegeIDs)
        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=terms.accessRecord)&
                         Q(children__value__in=sourceValues))
                        |
                        (((Q(value__field=terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__field=terms.primaryAdministrator.id)\
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
        privilegeIDs = [terms.findPrivilegeEnum.id, terms.readPrivilegeEnum.id, terms.registerPrivilegeEnum.id, 
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def readFilter(self, f):
        privilegeIDs = [terms.readPrivilegeEnum.id,
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def administerFilter(self, f):
        privilegeIDs = [terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs, accessRecordOptional=False)
    
    def _canUse(self, user, publicAccessPrivileges, accessRecordPrivilegeIDs):
        if user.is_staff:
            return True

        userInstance = Instance.getUserInstance(user)
        if user.is_authenticated():
            if userInstance and userInstance.isPrimaryAdministrator(self):
                return True
                            
        try:
            if self.accessrecord.source.value_set.filter(field=terms.publicAccess, 
                                                         referenceValue__in=publicAccessPrivileges,
                                                         deleteTransaction__isnull=True).exists():
                return True
            return userInstance and \
                   self.accessrecord.source.children.filter(typeID=terms.accessRecord, 
                        value__in=userInstance._getPrivilegeValues(accessRecordPrivilegeIDs))\
                        .exists()
        except AccessRecord.DoesNotExist:
            return False

    ## Instances can be read if the specified user is a super user or there is no accessRecord
    ## associated with this instance.
    ## Otherwise, the user must have a permission, public access set to read or be the primary administrator.
    def _canFind(self, user):
        publicAccessPrivileges = [terms.findPrivilegeEnum, terms.registerPrivilegeEnum, 
                                  terms.readPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.findPrivilegeEnum.id,
                                    terms.registerPrivilegeEnum.id,
                                    terms.readPrivilegeEnum.id, 
                                    terms.writePrivilegeEnum.id, 
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    def _canRead(self, user):
        publicAccessPrivileges = [terms.readPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.readPrivilegeEnum.id, 
                                    terms.writePrivilegeEnum.id, 
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canRegister(self, user):
        publicAccessPrivileges = [terms.registerPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.registerPrivilegeEnum.id,
                                    terms.writePrivilegeEnum.id,
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canWrite(self, user):
        publicAccessPrivileges = [terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.writePrivilegeEnum.id,
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be administered if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has administer privilege on the instance.                        
    def _canAdminister(self, user, userInstance=None):
        publicAccessPrivileges = []
        accessRecordPrivilegeIDs = [terms.administerPrivilegeEnum.id]
        return self._canUse(user, publicAccessPrivileges, accessRecordPrivilegeIDs)
            
    def checkWriteAccess(self, user, field=None):
        if self.typeID==terms.accessRecord:
            if not self._canAdminister(user):
                raise RuntimeError("administer permission failed")
        elif field in terms.securityFields:
            if not self._canAdminister(user):
                raise RuntimeError("administer permission failed")
        else:
            if not self._canWrite(user):
                raise RuntimeError("write permission failed")
    
    # Raises an error unless the specified user can write the specified value to the specified field of self.
    # This handles the special case of register permission if the value is a user.
    # This also handles the special case of submitting an access request to another user.
    def checkWriteValueAccess(self, user, field, value):
        if value:
            if isinstance(value, str) and terms.isUUID(value):
                value = Instance.objects.get(pk=value, deleteTransaction__isnull=True)
            if isinstance(value, Instance) and \
                value.typeID == terms.user and \
                value._canAdminister(user) and \
                field not in terms.securityFields and \
                self._canRegister(user):
                return
            if isinstance(value, Instance) and \
                value.typeID == terms.user and \
                field == terms.accessRequest and \
                self.typeID == terms.user:
                return
        self.checkWriteAccess(user, field)
            
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.findPrivilegeEnum, terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(accessrecord__isnull=True)|
                        Q(accessrecord__source__in=sources))
        
    def securityValueFilter(self, privilegeIDs):
        sourceValues = self._getPrivilegeValues(privilegeIDs)
        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=terms.accessRecord)&
                         Q(children__value__in=sourceValues))
                        |
                        (((Q(value__field=terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__field=terms.primaryAdministrator.id)\
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
        privilegeIDs = [terms.findPrivilegeEnum.id, terms.readPrivilegeEnum.id, terms.registerPrivilegeEnum.id,
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be read by self. 
    @property   
    def readValueFilter(self):
        privilegeIDs = [terms.readPrivilegeEnum.id, terms.registerPrivilegeEnum.id,
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    
    @property                
    def defaultCustomAccess(self):
        return self.value_set.filter(field=terms.defaultAccess, deleteTransaction__isnull=True).exists()
                    
    def getUserInstance(user):
        field = terms[TermNames.userID]
        userID = user.id
        if isinstance(userID, uuid.UUID):
            userID = userID.hex
        qs = Value.objects.filter(field=field, stringValue=userID,
            deleteTransaction__isnull=True)
        return qs[0].instance if len(qs) else None
    
    @property    
    def user(self):
        field = terms[TermNames.userID]
        id = self.value_set.get(field=field, deleteTransaction__isnull=True).stringValue
        return AuthUser.objects.get(pk=id)

    # The following functions are used for loading scraped data into the system.
    def getOrCreateTextValue(self, field, value, fieldData, transactionState):
        children = self.value_set.filter(field=field,
                                           stringValue=value['text'],
                                           deleteTransaction__isnull=True)
        if len(children):
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self.value_set.filter(field=field,
                                                 deleteTransaction__isnull=True)
                if len(children):
                    return children[0].updateValue(value, transactionState)
                    
            return self.addValue(field, value, self.getNextElementIndex(field), transactionState)
        
    def getOrCreateTranslationValue(self, field, text, languageCode, fieldData, transactionState):
        children = self.value_set.filter(field=field,
                                           stringValue=text,
                                           languageCode=languageCode,
                                           deleteTransaction__isnull=True)
        if len(children):
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self.value_set.filter(field=field,
                                                 deleteTransaction__isnull=True)
                if len(children):
                    return children[0].updateValue({'text': text, 'languageCode': languageCode}, transactionState)
                    
            return self.addValue(field, {'text': text, 'languageCode': languageCode}, self.getNextElementIndex(field), transactionState)
        
    def getOrCreateReferenceValue(self, field, referenceValue, fieldData, transactionState):
        children = self.value_set.filter(field=field,
                                           referenceValue=referenceValue,
                                           deleteTransaction__isnull=True)
        if children.count():
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self.value_set.filter(field=field,
                                                 deleteTransaction__isnull=True)
                if len(children):
                    return children[0].updateValue(referenceValue, transactionState)
                    
            return self.addReferenceValue(field, referenceValue, self.getNextElementIndex(field), transactionState)
        
    # returns the querySet of values within self that are in the specified object field and named using
    # a string within the referenceValue of the value.
    def getChildrenByName(self, field, nameField, name):
        return self.value_set.filter(deleteTransaction__isnull=True,
                                        field=field,
                                        referenceValue__value__deleteTransaction__isnull=True,
                                        referenceValue__value__field=nameField,
                                        referenceValue__value__stringValue__iexact=name)
    
    # returns the querySet of values within self that are in the specified object field and named using
    # a referenceValue within the referenceValue of the value.
    def getChildrenByReferenceName(self, field, nameField, name):
        return self.value_set.filter(deleteTransaction__isnull=True,
                                        field=field,
                                        referenceValue__value__deleteTransaction__isnull=True,
                                        referenceValue__value__field=nameField,
                                        referenceValue__value__referenceValue=name)
    def getValueByReference(self, field, r):
        return self.value_set.filter(deleteTransaction__isnull=True,
                                        field=field,
                                        referenceValue=r)
    # The previous functions are used for loading scraped data into the system.

    
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
    
class Value(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey(Instance, db_index=True, editable=False)
    field = dbmodels.ForeignKey(Instance, related_name='fieldValues', db_column='fieldid', db_index=True, editable=False)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    referenceValue = dbmodels.ForeignKey(Instance, related_name='referenceValues', db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey(Transaction, db_index=True, editable=False)
    deleteTransaction = dbmodels.ForeignKey(Transaction, related_name='deletedValue', db_index=True, null=True, editable=True)
    
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
        return Instance.objects.filter(parent__parent=self.instance.typeID, typeID=terms.field) \
            .filter(deleteTransaction__isnull=True)\
            .filter(value__field=terms.name,\
                    value__referenceValue=self.field,
                    value__deleteTransaction__isnull=True)\
            .filter(value__field=terms.descriptorType,
                    value__deleteTransaction__isnull=True)\
            .exists()

    @property
    def isOriginalReference(self):
        # If it is not an id, then return false.
        if not self.referenceValue:
            return False
        return self.referenceValue.parent == self.instance
        
    def getReferenceData(self, userInfo, language=None):
        d = { 'id': self.id,
              'instanceID' : self.referenceValue.id, 
              'description': self.referenceValue.getDescription(language),
              'position': self.position,
              'typeName': self.referenceValue.typeID.getDescription() }
        privilege = self.referenceValue.getPrivilege(userInfo)
        if privilege:
            d['privilege'] = privilege.getDescription()
        return d
            
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
        if self.field == terms.specialAccess:
            descendents = self.instance._descendents()
            n = AccessRecord.objects.filter(id__in=descendents).delete()
            if self.instance.parent and self.instance.parent.accessrecord:
                AccessRecord.objects.bulk_create(\
                    map(lambda i: AccessRecord(id=i,source=self.instance.parent.accessrecord.source), descendents))
            
        if self.isOriginalReference:
            self.referenceValue.deepDelete(transactionState)
        self.markAsDeleted(transactionState)
    
    @property    
    def dataType(self):
        f = Instance.objects.get(typeID=terms.field,
                                 value__field=terms.name,
                                 value__referenceValue=self.field,
                                 value__deleteTransaction__isnull=True,
                                 parent__parent=self.instance.typeID)
        v = f.value_set.filter(field=terms.dataType,deleteTransaction__isnull=True)[0]
        return v.referenceValue
    
    # returns whether or not c has data to update self.
    # The analysis of c varies based on the data type of self's field.           
    def hasNewValue(self, c):
        if c == None:
            raise ValueError("c is not specified")
        
        dt = self.dataType
        if dt==terms.objectEnum:
            return "instanceID" in c
        elif dt==terms.translationEnum:
            return 'text' in c and 'languageCode' in c
        else:
            return 'text' in c

    def checkWriteAccess(self, user):
        self.instance.checkWriteValueAccess(user, self.field, self.referenceValue)
        
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.findPrivilegeEnum, terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessrecord__isnull=True)|
                        Q(referenceValue__accessrecord__source__in=sources))

    def anonymousReadFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return Q(referenceValue__isnull=True)|\
               Q(referenceValue__accessrecord__isnull=True)|\
               Q(referenceValue__accessrecord__source__in=sources)

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
        
class Containment(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ancestor = dbmodels.ForeignKey('consentrecords.Instance', related_name='descendents', db_index=True, editable=False)
    descendent = dbmodels.ForeignKey('consentrecords.Instance', related_name='ancestors', db_index=True, editable=False)
    
    def __str__(self):
        return "%s -> %s" % (self.ancestor, self.descendent)
        
class TermNames():
    # These verbs are associated with field IDs of values.
    term = '_term'
    configuration = '_configuration'
    field = '_field'
    boolean = '_boolean'
    name = '_name'
    dataType = '_data type'
    stringEnum = '_string'
    number = '_number'
    datestamp = '_datestamp'
    datestampDayOptional = '_datestamp (day optional)'
    translationEnum = '_translation'
    objectEnum = '_object'
    ofKind = '_of kind'
    pickObjectPath = '_pick object path'
    enumerator = 'enumerator'
    maxCapacity = '_max capacity'
    uniqueValueEnum = '_unique value'
    multipleValuesEnum = '_multiple values'
    addObjectRule = '_object add rule'
    pickObjectRuleEnum = '_pick one'
    createObjectRuleEnum = '_create one'
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
    firstTextEnum = '_by first text'
    countEnum = '_by count'
    accessRecord = '_access record'
    accessRequest = '_access request'
    systemAccess = '_system access'
    privilege = '_privilege'
    findPrivilegeEnum = '_find'
    readPrivilegeEnum = '_read'
    writePrivilegeEnum = '_write'
    administerPrivilegeEnum = '_administer'
    registerPrivilegeEnum = '_register'
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
        accessRequest,      # identifies an access request for an instance
        privilege,          # identifies a privilege associated with an access record
        group,              # identifies a group associated with an access record
        defaultAccess,
        specialAccess,
        publicAccess,
        primaryAdministrator,
        ]

class Terms():
#     uuName = None
#     configuration = None                # identifies a configuration instance (contained by a uuName)
#     field = None                        # identifies a field instance (contained by a configuration)
#     boolean = None                      # identifies an instance of type Boolean
#     name = None
#     ofKind = None
#     pickObjectPath = None
#     enumerator = None
#     dataType = None
#     maxCapacity = None
#     addObjectRule = None
#     descriptorType = None
#     user = None
#     userID = None
#     email = None
#     firstName = None
#     lastName = None
#     translation = None
#     text = None
#     accessRecord = None
#     accessRequest = None
#     systemAccess = None
#     privilege = None
#     group = None
#     defaultAccess = None
#     specialAccess = None
#     publicAccess=None                   # Identifies fields used to determine what privileges the public has with regard to an instance.
#     primaryAdministrator=None           # Identifies fields that contain the primary administrator for an instance.
#     
#     textEnum = None                     # Identifies fields where instances of the containing type
#                                         # are described by the text of values of this field type
#                                         # contained within the instance.
#     countEnum = None                    # Identifies fields where instances of the containing type 
#                                         # are described by the number of values of this field type
#                                         # contained within the instance. 
#     
#     objectEnum = None                   # Identifies fields whose values are other instances.
#     stringEnum = None                   # Identifies fields whose values are strings.
#     translationEnum = None              # Identifies fields whose values are translations.
#     
#     uniqueValueEnum = None              # Identifies fields that can have a single value
#     multipleValuesEnum = None           # Identifies fields that can have 0 or more values
#     
#     pickObjectRuleEnum = None           # Identifies object fields that pick an existing object when adding a value
#     createObjectRuleEnum = None         # Identifies object fields that create a new object when adding a value
#     
#     findPrivilegeEnum = None            # Identifies access records that give find access to an instance.
#     readPrivilegeEnum = None            # Identifies access records that give read access to an instance.
#     writePrivilegeEnum = None           # Identifies access records that give write access to an instance.
#     administerPrivilegeEnum = None      # Identifies access records that give administer access to an instance.
#     registerPrivilegeEnum = None        # Identifies access records that give register access to an instance.
#     
#     # Enumeration values of the default secure term.
#     defaultCustomEnum = None            # Identifies instance types that have customized access by default.
#     
#     customAccessEnum = None             # Identifies instances that have customized access as a user setting.
#     
#     securityFields = None
    
    def initialize(self, transactionState=None):
        try:
            self.term = Terms.getUUName()
            self.name = Terms.getName()
            self.configuration = Terms.getOrCreateTerm(TermNames.configuration,  transactionState)
            self.field = Terms.getOrCreateTerm(TermNames.field,  transactionState)
            self.boolean = Terms.getOrCreateTerm(TermNames.boolean,  transactionState)
            self.ofKind = Terms.getOrCreateTerm(TermNames.ofKind,  transactionState)
            self.pickObjectPath = Terms.getOrCreateTerm(TermNames.pickObjectPath,  transactionState)
            self.enumerator = Terms.getOrCreateTerm(TermNames.enumerator,  transactionState)
            self.dataType = Terms.getOrCreateTerm(TermNames.dataType,  transactionState)
            self.maxCapacity = Terms.getOrCreateTerm(TermNames.maxCapacity,  transactionState)
            self.addObjectRule = Terms.getOrCreateTerm(TermNames.addObjectRule,  transactionState)
            self.descriptorType = Terms.getOrCreateTerm(TermNames.descriptorType,  transactionState)
            self.user = Terms.getOrCreateTerm(TermNames.user, transactionState)
            self.userID = Terms.getOrCreateTerm(TermNames.userID, transactionState)
            self.email = Terms.getOrCreateTerm(TermNames.email, transactionState)
            self.firstName = Terms.getOrCreateTerm(TermNames.firstName, transactionState)
            self.lastName = Terms.getOrCreateTerm(TermNames.lastName, transactionState)
            self.translation = Terms.getOrCreateTerm(TermNames.translationEnum, transactionState)
            self.accessRecord = Terms.getOrCreateTerm(TermNames.accessRecord, transactionState)
            self.accessRequest = Terms.getOrCreateTerm(TermNames.accessRequest, transactionState)
            self.systemAccess = Terms.getOrCreateTerm(TermNames.systemAccess, transactionState)
            self.privilege = Terms.getOrCreateTerm(TermNames.privilege, transactionState)
            self.group = Terms.getOrCreateTerm(TermNames.group, transactionState)
            self.defaultAccess = Terms.getOrCreateTerm(TermNames.defaultAccess, transactionState)
            self.specialAccess = Terms.getOrCreateTerm(TermNames.specialAccess, transactionState)
            self.publicAccess = Terms.getOrCreateTerm(TermNames.publicAccess, transactionState)
            self.primaryAdministrator = Terms.getOrCreateTerm(TermNames.primaryAdministrator, transactionState)
            self.securityFields = [self.accessRecord, self.systemAccess, self.defaultAccess, self.specialAccess, self.publicAccess, self.primaryAdministrator, self.accessRequest]
        except Instance.DoesNotExist: pass
        except Value.DoesNotExist: pass
    
        try: self.textEnum = Terms.getNamedEnumerator(self.descriptorType, TermNames.textEnum)
        except Value.DoesNotExist: pass
        try: self.firstTextEnum = Terms.getNamedEnumerator(self.descriptorType, TermNames.firstTextEnum)
        except Value.DoesNotExist: pass
        try: self.countEnum = Terms.getNamedEnumerator(self.descriptorType, TermNames.countEnum);
        except Value.DoesNotExist: pass
    
        try: self.objectEnum = Terms.getNamedEnumerator(self.dataType, TermNames.objectEnum);
        except Value.DoesNotExist: pass
        try: self.stringEnum = Terms.getNamedEnumerator(self.dataType, TermNames.stringEnum);
        except Value.DoesNotExist: pass
        try: self.translationEnum = Terms.getNamedEnumerator(self.dataType, TermNames.translationEnum);
        except Value.DoesNotExist: pass
    
        try: self.uniqueValueEnum = Terms.getNamedEnumerator(self.maxCapacity, TermNames.uniqueValueEnum);
        except Value.DoesNotExist: pass
        try: self.multipleValuesEnum = Terms.getNamedEnumerator(self.maxCapacity, TermNames.multipleValuesEnum);
        except Value.DoesNotExist: pass
        
        try: self.pickObjectRuleEnum = Terms.getNamedEnumerator(self.addObjectRule, TermNames.pickObjectRuleEnum);
        except Value.DoesNotExist: pass
        try: self.createObjectRuleEnum = Terms.getNamedEnumerator(self.addObjectRule, TermNames.createObjectRuleEnum);
        except Value.DoesNotExist: pass
        
        try: self.findPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.findPrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.readPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.readPrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.writePrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.writePrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.administerPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.administerPrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.registerPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.registerPrivilegeEnum);
        except Value.DoesNotExist: pass
            
        try: self.defaultCustomEnum = Terms.getNamedEnumerator(self.defaultAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
        try: self.customAccessEnum = Terms.getNamedEnumerator(self.specialAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
    def getUUName():
        return Instance.objects.get(typeID=F('id'),
            value__deleteTransaction__isnull=True,
            value__stringValue=TermNames.term)

    def getName():
        return Instance.objects.get(typeID=terms.term,
            value__deleteTransaction__isnull=True,
            value__field=F('id'),
            value__stringValue=TermNames.name)

    # If name is a 32 character hex string, then it is considered that ID. Otherwise,
    # it is looked up by name.
    def __getitem__(self, name):
        try:
            if terms.isUUID(name):
                return Instance.objects.get(pk=name, deleteTransaction__isnull=True);
            else:
                return Instance.objects.get(typeID=terms.term,
                    value__deleteTransaction__isnull=True,
                    value__field = terms.name,
                    value__stringValue=name)
        except Instance.DoesNotExist:
            raise Instance.DoesNotExist('the term "%s" is not recognized' % name)
            
    def __getattr__(self, name):
        if name == 'term':
            x = Terms.getUUName()
        elif name == 'name':
            x = Terms.getName()
        elif name == 'securityFields': 
            x = [self.accessRecord, self.systemAccess, self.defaultAccess, self.specialAccess, self.publicAccess, self.primaryAdministrator, self.accessRequest]
        elif name in ['textEnum', 'firstTextEnum', 'countEnum']:
            x = Terms.getNamedEnumerator(self.descriptorType, type.__getattribute__(TermNames, name))
        elif name in ['objectEnum', 'stringEnum', 'translationEnum']:
            x = Terms.getNamedEnumerator(self.dataType, type.__getattribute__(TermNames, name))
        elif name in ['uniqueValueEnum', 'multipleValuesEnum']:
            x = Terms.getNamedEnumerator(self.maxCapacity, type.__getattribute__(TermNames, name))
        elif name in ['pickObjectRuleEnum', 'createObjectRuleEnum']:
            x = Terms.getNamedEnumerator(self.addObjectRule, type.__getattribute__(TermNames, name))
        elif name in ['findPrivilegeEnum', 'readPrivilegeEnum', 'writePrivilegeEnum', 'administerPrivilegeEnum', 'registerPrivilegeEnum']:
            x = Terms.getNamedEnumerator(self.privilege, type.__getattribute__(TermNames, name))
        elif name == 'defaultCustomEnum':
            x = Terms.getNamedEnumerator(self.defaultAccess, TermNames.custom);
        elif name == 'customAccessEnum':
            x = Terms.getNamedEnumerator(self.specialAccess, TermNames.custom);
        else:
            x = self[type.__getattribute__(TermNames, name)]
        self.__setattr__(name, x)
        return x
        
    def getOrCreateTerm(name, transactionState):
        try:
            return terms[name]
        except Instance.DoesNotExist:
            print('new term: %s' % name)
            i = terms.term.createEmptyInstance(None, transactionState)
            i.addStringValue(terms.name, name, 0, transactionState)
            return i
            
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getNamedEnumerator(term, stringValue):
        if not term:
            raise ValueError("term is null")
        v = Value.objects.get(instance=term, field=terms.enumerator,
                          deleteTransaction__isnull=True,
                          referenceValue__value__field=terms.name,
                          referenceValue__value__deleteTransaction__isnull=True,
                          referenceValue__value__stringValue=stringValue)
        return v.referenceValue
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getTranslationNamedEnumerator(term, stringValue, languageCode):
        v = Value.objects.get(instance=term, field = terms.enumerator,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.translation,
                              referenceValue__value__stringValue=stringValue,
                              referenceValue__value__languageCode=languageCode)
        return v.referenceValue
        
    def isUUID(self, s):
        return re.search('^[a-fA-F0-9]{32}$', s)
                
terms = Terms()

class FieldsDataDictionary:
    def __init__(self, typeInstances=[], language=None):
        self.language = language
        self._dict = dict((t, t.getFieldsData(language)) for t in typeInstances)
    
    def __getitem__(self, typeInstance):
        if isinstance(typeInstance, str):
            typeInstance = next((key for key in self._dict.keys() if key.id == typeInstance),
            					Instance.objects.get(pk=typeInstance))
                            
        if typeInstance in self._dict:
            return self._dict[typeInstance]
        else:
            self._dict[typeInstance] = typeInstance.getFieldsData(self.language)
            return self._dict[typeInstance]

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

