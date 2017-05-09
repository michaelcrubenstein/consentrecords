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
import itertools
from collections import defaultdict

from custom_user.models import AuthUser

# Returns a list containing the first argument. If t is None, then it is an empty list.
def forceToList(t):
    return [] if t is None else \
         t if isinstance(t, list) else \
         list(t) if isinstance(t, map) else \
         [t]

# Returns a list that concatenates the two arguments, converting each to a list as necessary.
def combineTerms(t1, t2):
    return forceToList(t1) + forceToList(t2)
    
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

    # The user is an instance of AuthUser    
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
    accessSource = dbmodels.ForeignKey('consentrecords.Instance', related_name='accessTargets', db_index=True, null=True, editable=True)
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
    def idString(self):
        return self.id.hex if isinstance(self.id, uuid.UUID) else self.id
    
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
    def addValue(self, field, value, position, userInfo, transactionState):
        if value == None:
            raise ValueError("value is not specified")
        
        dt = self.getDataType(field)
        if dt==terms.objectEnum:
            if isinstance(value, Instance):
                if value._canFind(userInfo):
                    return self.addReferenceValue(field, value, position, transactionState)
                else:
                    raise Instance.DoesNotExist()
            elif isinstance(value, dict) and "instanceID" in value:
                f = list(userInfo.findFilter(InstanceQuerySet(Instance.objects.filter(pk=value["instanceID"]))))
                if len(f) == 0:
                    raise Value.DoesNotExist("specified primary key (%s) for instance does not exist" % value["instanceID"])
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

    def updateDescendentAccessSources(self, accessSource):
        self.accessSource = accessSource
        self.save()
        items = [self]
        while len(items) > 0:
            item = items.pop(0)
            children = item.children.filter(deleteTransaction__isnull=True)
            children.update(accessSource=accessSource)
            items.extend(item.children.filter(deleteTransaction__isnull=True))
            
    # Returns a newly created value contained by self with the specified referenceValue
    def addReferenceValue(self, field, instance, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid" % position)
        if not instance:
            raise ValueError("the instance is null")
            
        # If the field is special access, then make this and all of its children sourced to self.
        if field == terms.specialAccess and instance == terms.customAccessEnum:
            self.updateDescendentAccessSources(self)
            
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
    
    # Returns a filter enumerating all of the values that match the specified field.
    def __getitem__(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        if isinstance(field, str):
            field = terms[field]
        return self.value_set.filter(field=field, deleteTransaction__isnull=True).order_by('position')
    
    # Returns a dictionary whose keys are field id strings and whose values are arrays of
    # values contained by self.
    # userInfo is used to determine if the dictionary includes security field data.  
    def _groupValuesByField(self, vs, userInfo):
        values = defaultdict(list)
        # Do not allow a user to get security field data unless they can administer this instance.
        cache = _deferred(lambda: self._canAdminister(userInfo))
        for v in vs:
            if v.field_id not in terms.securityFieldIDs or cache.value:
                values[v.field_id.hex].append(v)
        return values
    
    def _getSubInstances(self, field):
        return [v.referenceValue for v in self[field]]
        
    # Returns a unique value in the cell specified by the field.
    def getSubValue(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        try:
            f = self[field].select_related('referenceValue')
            return f[0] if f.exists() else None
        except Value.DoesNotExist:
            return None
    
    # Returns the instance associated with a unique value in the cell specified by the field.      
    def getSubInstance(self, field):
        v = self.getSubValue(field)
        return v and v.referenceValue
     
    # Returns the datum associated with a unique value in the cell specified by the field.      
    def getSubDatum(self, field):
        v = self.getSubValue(field)
        return v and v.stringValue
     
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
            vs = self[field]
            if descriptorType == terms.textEnum:
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
                if vs.exists():
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
        data = {'id': None, 
             'instanceID': self.idString, 
             'description': self.getDescription(language),
             'parentID': self.parent_id,
             'typeName': userInfo.getTypeName(self.typeID_id)}
        privilege = self.getPrivilege(userInfo)
        if privilege:
            data["privilege"] = privilege.getDescription()
        return data
    
    def getData(self, fields, fieldsDataDictionary, language, userInfo):
        data = self.getReferenceData(userInfo, language)
        if not 'none' in fields:
            data['cells'] = self.getCellsData(fields, fieldsDataDictionary, language, userInfo)
        return data;
    
    # This code presumes that all fields have unique values.
    def _sortValueDataByField(values):
        d = {}
        for v in values:
            # If there is a reference value, put in a duple with the referenceValue name and id.
            # Otherwise, put in the string value.
            if v.referenceValue:
                d[v.field] = (v.referenceValue.description.text, v.referenceValue.idString)
            else:
                d[v.field] = v.stringValue
        return d
        
    # Returns a dictionary by field where each value is
    # a duple containing the value containing the name and 
    # the instance referenced by self from the key field.
    # Self is an instance of type field.
    def _getSubValueReferences(self):
        vs1 = self.value_set.filter(deleteTransaction__isnull=True)\
                            .select_related('referenceValue')\
                            .select_related('referenceValue__description')
        return Instance._sortValueDataByField(vs1)                                               
    
    # For a parent field when getting data, construct this special field record
    # that can be used to display this field data.
    def getParentReferenceFieldData(userInfo, id):
        name = userInfo.getTypeName(id)
        fieldData = {"id": "parent/" + id,
                     "name" : name,
                     "nameID" : id,
                     "dataType" : TermNames.objectEnum,
                     "dataTypeID" : terms.objectEnum.idString,
                     "capacity" : TermNames.uniqueValueEnum,
                     "ofKind" : name,
                     "ofKindID" : id}
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
            fieldData = {"id" : self.idString, 
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
            
            if fieldData["dataTypeID"] == terms.objectEnum.idString:
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
        vs1 = Value.objects.filter(deleteTransaction__isnull=True)\
                            .select_related('field')\
                            .select_related('referenceValue')\
                            .select_related('referenceValue__description')

        configuration = self.children.filter(typeID=terms.configuration, deleteTransaction__isnull=True)[0]
        fields = configuration.children.filter(typeID=terms.field, deleteTransaction__isnull=True)\
                                 .prefetch_related(Prefetch('value_set', queryset=vs1, to_attr='values'))\
                                 .order_by('parentValue__position')
        return [field._getFieldDataFromValues(Instance._sortValueDataByField(field.values), language) for field in fields]

    def _getCellValues(dataTypeID, values, userInfo, language=None):
        if dataTypeID == terms.objectEnum.idString:
            return [v.getReferenceData(userInfo, language) for v in values]
        elif dataTypeID == terms.translationEnum.idString:
            return [{"id": v.idString, "text": v.stringValue, "languageCode": v.languageCode} for v in values]
        else:
            # Default case is that each datum in this cell contains a unique value.
            return [{"id": v.idString, "text": v.stringValue} for v in values]
            
    def _getCellData(self, fieldData, values, userInfo, language=None):
        if not fieldData:
            raise ValueError("fieldData is null")
        cell = {"field": fieldData["id"]}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        else:
            cell["data"] = Instance._getCellValues(fieldData["dataTypeID"], values[fieldID], userInfo, language)
        return cell
                
    # Returns an array data for each cell of this, with all of the data in vs.
    def _getChildCellsData(self, vs, fieldsData, userInfo, language=None):
        values = self._groupValuesByField(vs, userInfo)
        return [self._getCellData(fieldData, values, userInfo, language)\
                for fieldData in filter(lambda f: not f["id"].startswith("parent/"), fieldsData)]

    def getCellsData(self, fields, fieldsDataDictionary, language, userInfo):
        fieldsData = fieldsDataDictionary[self.typeID_id]
        cells = self._getChildCellsData(self.values, fieldsData, userInfo, language)
    
        if 'parents' in fields:
            p = self
            fp = p.parent_id and \
                 userInfo.readFilter(\
                    InstanceQuerySet(Instance.objects.filter(pk=p.parent_id))\
                        .select_related([], "", userInfo))
            while fp and fp.exists():
                p = fp[0]
                
                fieldData = next((field for field in fieldsData if field["id"] == "parent/" + p.typeID_id), None)
                if not fieldData:
                    fieldData = Instance.getParentReferenceFieldData(userInfo, p.typeID_id)
                    fieldsData.append(fieldData)
            
                parentData = p.getReferenceData(userInfo, language)
                parentData['position'] = 0
                if fieldData["name"] in fields:
                    parentData['cells'] = p._getChildCellsData(p.values, fieldsDataDictionary[p.typeID_id], userInfo, language)
                
                cells.append({"field": fieldData["id"], "data": [parentData]})
                
                fp = p.parent_id and \
                     userInfo.readFilter(\
                        InstanceQuerySet(Instance.objects.filter(pk=p.parent_id))\
                            .select_related([], "", userInfo))
        
        if TermNames.systemAccess in fields:
            if userInfo.authUser.is_superuser:
                saObject = terms.administerPrivilegeEnum
            elif userInfo.authUser.is_staff:
                saObject = terms.writePrivilegeEnum
            else:
                saObject = None
            if saObject:
                fieldData = next((field for field in fieldsData if field["id"] == terms.systemAccess.idString), None)
                if not fieldData:
                    fieldData = Instance.getParentReferenceFieldData(userInfo, terms.systemAccess.idString)
                    fieldsData.append(fieldData)
                parentData = [{'id': None, 
                              'instanceID' : saObject.idString,
                              'description': saObject.getDescription(language),
                              'position': 0,
                              'privilege': saObject.description.text}]
                cells.append({"field": fieldData["id"], "data": parentData})
                
        # For each of the cells, if the cell is in the field list explicitly, 
        # and the cell is in the fieldsData (and not the name of a parent type)
        # then get the subdata for all of the values in that cell.
        subValuesDict = None
        for cell in cells:
            fieldData = next((field for field in fieldsData if field["id"] == cell["field"]), None)
            if not fieldData:
                raise "fieldData is not found"
            
            if fieldData["name"] in fields and fieldData["name"] != TermNames.systemAccess \
                and "ofKindID" in fieldData \
                and next((field for field in fieldsData if field["nameID"] == fieldData["nameID"]), None):
                
                subFieldsData = fieldsDataDictionary[fieldData["ofKindID"]]
                subValuesDict = subValuesDict or \
                                dict((s.idString, s) for s in filter(lambda s: s, map(lambda v: v.referenceValue, self.values)))  
                
                for d in cell["data"]:
                    # d["instanceID"] won't be in subValuesDict if it is a parent.
                    if d["instanceID"] in subValuesDict:
                        i = subValuesDict[d["instanceID"]]
                        d['cells'] = i._getChildCellsData(i.subValues, subFieldsData, userInfo, language)
                        d['typeName'] = fieldData["ofKind"]
        return cells

    def getNextElementIndex(self, field):
        f = self[field]
        return 0 if not f.exists() else (f.reverse()[0].position + 1)

    def updateElementIndexes(self, field, newIndex, transactionState):
        ids = dict([(e.position, e) for e in self[field]])
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
        
        self.accessSource = None
        self.deleteTransaction = transactionState.transaction
        self.save()
        while len(queue) > 0:
            next = queue[0]
            queue = queue[1:]
            instances = next.children.filter(deleteTransaction__isnull=True).only('id')
            values = next.value_set.filter(deleteTransaction__isnull=True).only('id')
            queue.extend(instances)
            
            # Delete associated access sources before marking the instances as deleted.
            instances.update(accessSource=None, deleteTransaction=transactionState.transaction)
            values.update(deleteTransaction=transactionState.transaction)

    # Return a filter of all of the instances of this type that exactly match the specified name.
    def getInstanceByName(self, nameField, name, userInfo):
        f = userInfo.findFilter(InstanceQuerySet(self.typeInstances.filter(deleteTransaction__isnull=True,
                                         value__deleteTransaction__isnull=True,
                                         value__field=nameField,
                                         value__stringValue__iexact=name)))
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
            raise Value.DoesNotExist('the field name "%s" is not recognized for "%s" configuration of term "%s"' % (name, self, self.parent))

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
        
    ### Returns the privilege level that the specified user instance has for this instance. 
    def getPrivilege(self, userInfo):
        if userInfo.is_administrator:
            return terms.administerPrivilegeEnum
        
        if not self.accessSource_id:
            return terms.readPrivilegeEnum
        
        return userInfo.getPrivilege(self.accessSource_id)
    
    ### Returns True if this user (self) is the primary administrator of the specified instance
    def isPrimaryAdministrator(self, instance):
        if not instance.accessSource_id:
            return False

        return instance.accessSource.value_set.filter(field=terms.primaryAdministrator,
            referenceValue=self,
            deleteTransaction__isnull=True).exists()
    
    ### Returns a QuerySet that filters f according to the specified privileges.
    ### self is a user to whom the privileges apply.
    def _securityFilter(self, f, privilegeIDs, accessRecordOptional=True):        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=terms.accessRecord,
                           children__deleteTransaction__isnull=True,
                           children__value__referenceValue__in=privilegeIDs))
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
            return f.filter(Q(accessSource__isnull=True)|
                            Q(accessSource__in=sources))
        else:
            return f.filter(Q(accessSource__in=sources))
    
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
    
    def _canUse(self, userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs):
        if userInfo.is_administrator:
            return True

        if userInfo.isPrimaryAdministrator(self):
            return True
        
        if not self.accessSource_id:
            return False                    
        if len(publicAccessPrivileges) > 0 and \
           Value.objects.filter(instance=self.accessSource_id,
                                field=terms.publicAccess, 
                                referenceValue__in=publicAccessPrivileges,
                                deleteTransaction__isnull=True).exists():
            return True
        
        if not userInfo.instance:
            return False
        
        # create a query set of all of the access records that contain this instance.        
        f = Instance.objects.filter(parent=self.accessSource_id, typeID=terms.accessRecord)\
            .filter(Q(value__referenceValue=userInfo.instance,
                      value__deleteTransaction__isnull=True)|
                    Q(value__deleteTransaction__isnull=True,
                      value__referenceValue__value__referenceValue=userInfo.instance,
                      value__referenceValue__value__deleteTransaction__isnull=True))

        g = Value.objects.filter(instance__in=f, field=terms.privilege, 
                deleteTransaction__isnull=True,
                referenceValue__in=accessRecordPrivilegeIDs)
                
        return g.exists()

    ## Instances can be read if the specified user is a super user or there is no accessRecord
    ## associated with this instance.
    ## Otherwise, the user must have a permission, public access set to read or be the primary administrator.
    def _canFind(self, userInfo):
        publicAccessPrivileges = [terms.findPrivilegeEnum, terms.registerPrivilegeEnum, 
                                  terms.readPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.findPrivilegeEnum.id,
                                    terms.registerPrivilegeEnum.id,
                                    terms.readPrivilegeEnum.id, 
                                    terms.writePrivilegeEnum.id, 
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    def _canRead(self, userInfo):
        publicAccessPrivileges = [terms.readPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.readPrivilegeEnum.id, 
                                    terms.writePrivilegeEnum.id, 
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canRegister(self, userInfo):
        publicAccessPrivileges = [terms.registerPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.registerPrivilegeEnum.id,
                                    terms.writePrivilegeEnum.id,
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canWrite(self, userInfo):
        publicAccessPrivileges = [terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.writePrivilegeEnum.id,
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be administered if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has administer privilege on the instance.                        
    def _canAdminister(self, userInfo):
        publicAccessPrivileges = []
        accessRecordPrivilegeIDs = [terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
            
    def checkWriteAccess(self, userInfo, field=None):
        if self.typeID==terms.accessRecord:
            if not self._canAdminister(userInfo):
                raise RuntimeError("administer permission failed")
        elif field in terms.securityFields:
            if not self._canAdminister(userInfo):
                raise RuntimeError("administer permission failed")
        else:
            if not self._canWrite(userInfo):
                try:
                    s = "write permission failed for %s" % self.description.text
                except Exception:
                    s = "write permission failed for %s" % self.typeID.description.text
                if field:
                    s += " to %s field" % field.description.text
                raise RuntimeError(s)
    
    # Raises an error unless the specified user can write the specified value to the specified field of self.
    # This handles the special case of register permission if the value is a user.
    # This also handles the special case of submitting an access request to another user.
    def checkWriteValueAccess(self, userInfo, field, value):
        if value:
            if isinstance(value, str) and terms.isUUID(value):
                value = Instance.objects.get(pk=value, deleteTransaction__isnull=True)
            if isinstance(value, Instance) and \
                value.typeID == terms.user and \
                value._canAdminister(userInfo) and \
                field not in terms.securityFields and \
                self._canRegister(userInfo):
                return
            if isinstance(value, Instance) and \
                value.typeID == terms.user and \
                field == terms.accessRequest and \
                self.typeID == terms.user:
                return
        self.checkWriteAccess(userInfo, field)
            
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.findPrivilegeEnum, terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(accessSource__isnull=True)|
                        Q(accessSource__in=sources))
        
    def anonymousReadFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue=terms.readPrivilegeEnum)&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(accessSource__isnull=True)|
                        Q(accessSource__in=sources))
        
    def securityValueFilter(self, privilegeIDs):
        sources=Instance.objects.filter(\
                        Q(children__typeID=terms.accessRecord,
                          children__deleteTransaction__isnull=True,
                          children__value__referenceValue__in=privilegeIDs)
                        |
                        (Q(value__field=terms.publicAccess.id,
                           value__referenceValue__in=privilegeIDs,
                           value__deleteTransaction__isnull=True)\
                          |
                          Q(value__field=terms.primaryAdministrator.id,
                            value__referenceValue=self,
                            value__deleteTransaction__isnull=True)\
                        )\
                       )
        
        return Q(referenceValue__isnull=True)|\
               Q(referenceValue__accessSource__isnull=True)|\
               Q(referenceValue__accessSource__in=sources)
    
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
    
    ### For the specified instance filter, filter only those instances that can be administered by self. 
    @property   
    def administerValueFilter(self):
        privilegeIDs = [terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    @property                
    def defaultCustomAccess(self):
        return self.value_set.filter(field=terms.defaultAccess, deleteTransaction__isnull=True).exists()
                    
    def getUserInstance(user):
        field = terms.userID
        userID = user.id
        if isinstance(userID, uuid.UUID):
            userID = userID.hex
        qs = Value.objects.filter(field=field, stringValue=userID,
            deleteTransaction__isnull=True)
        return qs[0].instance if len(qs) else None
    
    @property    
    def user(self):
        id = self[TermNames.userID][0].stringValue
        return AuthUser.objects.get(pk=id)

    # The following functions are used for loading scraped data into the system.
    def getOrCreateTextValue(self, field, value, fieldData, userInfo, transactionState):
        children = self[field].filter(stringValue=value['text'])
        if len(children):
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self[field]
                if len(children):
                    return children[0].updateValue(value, userInfo, transactionState)
                    
            return self.addValue(field, value, self.getNextElementIndex(field), userInfo, transactionState)
        
    def getOrCreateTranslationValue(self, field, text, languageCode, fieldData, userInfo, transactionState):
        children = self[field].filter(stringValue=text, languageCode=languageCode)
        if len(children):
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self[field]
                if len(children):
                    return children[0].updateValue({'text': text, 'languageCode': languageCode}, userInfo, transactionState)
                    
            return self.addValue(field, {'text': text, 'languageCode': languageCode}, self.getNextElementIndex(field), userInfo, transactionState)
        
    def getOrCreateReferenceValue(self, field, referenceValue, fieldData, userInfo, transactionState):
        children = self[field].filter(referenceValue=referenceValue)
        if children.exists():
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self[field]
                if len(children):
                    return children[0].updateValue(referenceValue, userInfo, transactionState)
                    
            return self.addReferenceValue(field, referenceValue, self.getNextElementIndex(field), transactionState)
        
    # returns the querySet of values within self that are in the specified object field and named using
    # a string within the referenceValue of the value.
    def getChildrenByName(self, field, nameField, name):
        return self[field].filter(referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=nameField,
                                  referenceValue__value__stringValue__iexact=name)
    
    # returns the querySet of values within self that are in the specified object field and named using
    # a referenceValue within the referenceValue of the value.
    def getChildrenByReferenceName(self, field, nameField, name):
        return self[field].filter(referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=nameField,
                                  referenceValue__value__referenceValue=name)
    def getValueByReference(self, field, r):
        return self[field].filter(referenceValue=r)
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
    def idString(self):
        return self.id.hex if isinstance(self.id, uuid.UUID) else self.id
    
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
        data = self.referenceValue.getReferenceData(userInfo, language)
        data['id'] = self.idString
        data['position'] = self.position
        return data
    
    # Return the data associated with this value that references an object.        
    def getData(self, fields, fieldsDataDictionary, language, userInfo):
        data = self.getReferenceData(userInfo, language=language)
        if not 'none' in fields:
            data['cells'] = self.referenceValue.getCellsData(fields, fieldsDataDictionary, language, userInfo)
        return data
    
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newValue, userInfo, transactionState):
        self.markAsDeleted(transactionState)
        return self.instance.addValue(self.field, newValue, self.position, userInfo, transactionState);
    
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
            self.instance.updateDescendentAccessSources(self.instance.parent and self.instance.parent.accessSource)
            
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

    def checkWriteAccess(self, userInfo):
        self.instance.checkWriteValueAccess(userInfo, self.field, self.referenceValue)
        
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.findPrivilegeEnum, terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessSource__isnull=True)|
                        Q(referenceValue__accessSource__in=sources))

    def anonymousReadFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return Q(referenceValue__isnull=True)|\
               Q(referenceValue__accessSource__isnull=True)|\
               Q(referenceValue__accessSource__in=sources)

# The description of an instance.        
class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.OneToOneField('consentrecords.Instance', db_index=True, editable=False)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)

    def __str__(self):
        return "%s" % (self.text)
                
# A denormalization that identifies instances that descend through the parent node to 
# other instances.
class Containment(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ancestor = dbmodels.ForeignKey('consentrecords.Instance', related_name='descendents', db_index=True, editable=False)
    descendent = dbmodels.ForeignKey('consentrecords.Instance', related_name='ancestors', db_index=True, editable=False)
    
    def __str__(self):
        return "%s -> %s" % (self.ancestor, self.descendent)
        
class TermNames():
    # These verbs are associated with field IDs of values.
    term = 'term'
    name = 'name'
    configuration = 'configuration'
    field = 'field'
    boolean = 'boolean'
    dataType = 'data type'
    ofKind = 'of kind'
    pickObjectPath = 'pick object path'
    enumerator = 'enumerator'
    maxCapacity = 'max capacity'
    addObjectRule = 'object add rule'
    descriptorType = 'descriptor type'
    user = 'user'
    userID = 'userID'
    email = 'email'
    firstName = 'first name'
    lastName = 'last name'
    text = 'text'
    accessRecord = 'access record'
    accessRequest = 'access request'
    systemAccess = 'system access'
    privilege = 'privilege'
    group = 'group'
    defaultAccess = 'default access'
    specialAccess = 'special access'
    publicAccess='public access'
    primaryAdministrator='primary administrator'
    
    # enumerations for data type
    stringEnum = 'string'
    number = 'number'
    datestamp = 'datestamp'
    datestampDayOptional = 'datestamp (day optional)'
    translationEnum = 'translation'
    objectEnum = 'object'
    
    # enumerations for max capacity
    uniqueValueEnum = 'unique value'
    multipleValuesEnum = 'multiple values'
    
    # enumerations for addObjectRule
    pickObjectRuleEnum = 'pick one'
    createObjectRuleEnum = 'create one'
    
    # enumerations for boolean
    yesEnum = 'yes'
    noEnum = 'no'
    
    # enumerations for descriptor type
    textEnum = 'by text'
    firstTextEnum = 'by first text'
    countEnum = 'by count'
    
    # enumerations for privilege
    findPrivilegeEnum = 'find'
    readPrivilegeEnum = 'read'
    writePrivilegeEnum = 'write'
    administerPrivilegeEnum = 'administer'
    registerPrivilegeEnum = 'register'
    
    # enumerations for special access.
    custom = 'custom'

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
            self.securityFieldIDs = list(map(lambda f: f.id, self.securityFields))
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
        return Instance.objects.get(
            (Q(value__stringValue__iexact=TermNames.term)|Q(value__stringValue__iexact=('_'+TermNames.term))),
            typeID=F('id'),
            value__deleteTransaction__isnull=True)

    def getName():
        return Instance.objects.get(
            (Q(value__stringValue__iexact=TermNames.name)|Q(value__stringValue__iexact=('_'+TermNames.name))),
            typeID=terms.term,
            value__deleteTransaction__isnull=True,
            value__field=F('id'))

    # If name is a 32 character hex string, then it is considered that ID. 
    # Otherwise, it is looked up by case-insensitive name.
    def __getitem__(self, name):
        try:
            if terms.isUUID(name):
                return Instance.objects.get(pk=name, deleteTransaction__isnull=True);
            else:
                return Instance.objects.get(typeID=terms.term,
                    value__deleteTransaction__isnull=True,
                    value__field = terms.name,
                    value__stringValue__iexact=name)
        except Instance.DoesNotExist:
            if name.startswith('_'):
                try: 
                    return Instance.objects.get(typeID=terms.term,
                        value__deleteTransaction__isnull=True,
                        value__field = terms.name,
                        value__stringValue__iexact=name[1:])
                except Instance.DoesNotExist:
                    raise Instance.DoesNotExist('the term "%s" is not recognized' % name)
            else:
                try: 
                    return Instance.objects.get(typeID=terms.term,
                        value__deleteTransaction__isnull=True,
                        value__field = terms.name,
                        value__stringValue__iexact='_'+name)
                except Instance.DoesNotExist:
                    raise Instance.DoesNotExist('the term "%s" is not recognized' % name)
            
    def __getattr__(self, name):
        if name == 'term':
            x = Terms.getUUName()
        elif name == 'name':
            x = Terms.getName()
        elif name == 'securityFields': 
            x = [self.accessRecord, self.systemAccess, self.defaultAccess, self.specialAccess, self.publicAccess, self.primaryAdministrator, self.accessRequest]
        elif name == 'securityFieldIDs': 
            x = list(map(lambda t: t.id, self.securityFields))
        elif name in ['textEnum', 'firstTextEnum', 'countEnum']:
            x = Terms.getNamedEnumerator(self.descriptorType, type.__getattribute__(TermNames, name))
        elif name in ['objectEnum', 'stringEnum', 'translationEnum']:
            x = Terms.getNamedEnumerator(self.dataType, type.__getattribute__(TermNames, name))
        elif name in ['uniqueValueEnum', 'multipleValuesEnum']:
            x = Terms.getNamedEnumerator(self.maxCapacity, type.__getattribute__(TermNames, name))
        elif name in ['pickObjectRuleEnum', 'createObjectRuleEnum']:
            x = Terms.getNamedEnumerator(self.addObjectRule, type.__getattribute__(TermNames, name))
        elif name in ['yesEnum', 'noEnum']:
            x = Terms.getNamedEnumerator(self.boolean, type.__getattribute__(TermNames, name))
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
            i = terms.term.createEmptyInstance(None, transactionState)
            i.addStringValue(terms.name, name, 0, transactionState)
            return i
            
    
    # Return an Instance representing the specified Ontology object. 
    # If the Instance doesn't exist, raise a Value.DoesNotExist.   
    def getNamedEnumerator(term, name):
        if not term:
            raise ValueError("term is null")
        try:
            v = Value.objects.get(instance=term, field=terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.name,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact=name)
            return v.referenceValue
        except Value.DoesNotExist:
            if name.startswith('_'):
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.name,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact=name[1:])
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
            else:
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.name,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact='_'+name)
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getTranslationNamedEnumerator(term, name, languageCode):
        try:
            v = Value.objects.get(instance=term, field = terms.enumerator,
                                  referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=terms.translation,
                                  referenceValue__value__stringValue=name,
                                  referenceValue__value__languageCode=languageCode)
            return v.referenceValue
        except Value.DoesNotExist:
            if name.startswith('_'):
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              referenceValue__value__field=terms.translation,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact=name[1:],
                              referenceValue__value__languageCode=languageCode)
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
            else:
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              referenceValue__value__field=terms.translation,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact='_'+name,
                              referenceValue__value__languageCode=languageCode)
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
        
    def isUUID(self, s):
        return re.search('^[a-fA-F0-9]{32}$', s)
                
terms = Terms()

class FieldsDataDictionary(dict):
    def __init__(self, *args, **kwargs):
        self.language = kwargs.pop('language', None)
        dict.__init__(self, *args, **kwargs)
    
    def getType(self, t):
        if isinstance(t, uuid.UUID):
            return next((key for key in self.keys() if key.id == t), None) or \
                   Instance.objects.get(pk=t)
        elif isinstance(t, Instance):
            return t
        else:
            raise ValueError("%s is not a type" % t)
    
    def __getitem__(self, t):
        typeInstance = self.getType(t)
                            
        if typeInstance not in self:
            self[typeInstance] = typeInstance.getFieldsData(self.language)
        
        return dict.__getitem__(self, typeInstance)
    
    def getData(self, types):
        values = map(lambda t: self[t], types)
        fds = list(itertools.chain.from_iterable(values))
        return fds
        
class UserInfo:
    def __init__(self, authUser):
        self.authUser = authUser
        self.instance = Instance.getUserInstance(authUser) if authUser.is_authenticated() else None
        self._findValueFilter = None
        self._readValueFilter = None
        self._logs = []
        self.log('Create UserInfo')
        self.typeNames = {}
        
        # privileges is a cache of privileges where the keys are instance ids.
        self._privileges = {}
    
    @property    
    def is_administrator(self):
        return self.authUser.is_staff
        
    @property
    def is_authenticated(self):
        return self.authUser.is_authenticated()

    def findFilter(self, resultSet):
        return resultSet.applyFindFilter(self)

    def readFilter(self, resultSet):
        return resultSet.applyReadFilter(self)

    def administerFilter(self, resultSet):
        return resultSet.applyAdministerFilter(self)
        
    def isPrimaryAdministrator(self, instance):
        return self.is_authenticated and self.instance and self.instance.isPrimaryAdministrator(instance)

    def log(self, s):
        self._logs.append({"text": s, "timestamp": str(datetime.datetime.now())})
        
    def getTypeName(self, typeID):
        if typeID in self.typeNames:
            return self.typeNames[typeID]
        else:
            description = Instance.objects.get(pk=typeID).description.text
            self.typeNames[typeID] = description
            return description
    
    def loadPrivilege(self, source_id):
        try:
            minPrivilege = Value.objects.get(instance=source_id,
                                                  field=terms.publicAccess, deleteTransaction__isnull=True)\
                                   .select_related('referenceValue__description').referenceValue
        except Exception:
            minPrivilege = None
    
        if not self.instance:
            self._privileges[source_id] = minPrivilege
        elif Value.objects.filter(instance=source_id,
                                field=terms.primaryAdministrator, 
                                deleteTransaction__isnull=True,
                                referenceValue=self.instance).exists():
            self._privileges[source_id] = terms.administerPrivilegeEnum
        else:
            # create a query set of all of the access records that contain this instance.        
            f = Instance.objects.filter(parent=source_id, typeID=terms.accessRecord)\
                .filter(Q(value__referenceValue=self.instance,
                          value__deleteTransaction__isnull=True)|
                        Q(value__deleteTransaction__isnull=True,
                          value__referenceValue__value__referenceValue=self.instance,
                          value__referenceValue__value__deleteTransaction__isnull=True))
    
            g = Value.objects.filter(instance__in=f, field=terms.privilege, 
                    deleteTransaction__isnull=True)\
                    .select_related('referenceValue__description')
            
            # map the access records to their corresponding privilege values.              
            p = map(lambda i: i.referenceValue, g)
    
            self._privileges[source_id] = reduce(Instance.comparePrivileges, p, minPrivilege)
    
    # Returns a privilege instance for the specified source_id.
    def getPrivilege(self, source_id):
        if source_id not in self._privileges:
            self.loadPrivilege(source_id)
        
        return self._privileges[source_id]
            
class ObjectQuerySet:
    def __init__(self, querySet=None):
        if isinstance(querySet, ObjectQuerySet):
            raise ValueError("querySet is an ObjectQuerySet")
        self.querySet = querySet

    def getQClause(self, field, symbol, testValue):
        if isinstance(testValue, list):
            simples = map(lambda t: self.getSimpleQClause(field, symbol, t), testValue)
            return reduce(lambda q1, q2: q1 | q2, simples)
        else:
            return self.getSimpleQClause(field, symbol, testValue)

    def getAncestorClause(self, symbol, testValue):
        if isinstance(testValue, list):
            simples = map(lambda t: self.getSimpleAncestorClause(symbol, t), testValue)
            return reduce(lambda q1, q2: q1 | q2, simples)
        else:
            return self.getSimpleAncestorClause(symbol, testValue)

    # Return the Q Clause based on all of the elements within a []
    # This function factors out '|' operations within the clause into simple tests.
    def clause(self, params, userInfo):
        paramClauses = []
        paramClause = []
        for s in params:
            if s == '|':
                if len(paramClause):
                    paramClauses.append(paramClause)
                    paramClause = []
            else:
                paramClause.append(s)
        if len(paramClause):
            paramClauses.append(paramClause)
        
        if len(paramClauses) == 1:
            return self.filterClause(paramClauses[0], userInfo)
        else: 
            return reduce(lambda q1, q2: ((q1[0] | q2[0]), combineTerms(q1[1], q2[1])), \
                          map(lambda p: self.filterClause(p, userInfo), paramClauses))

    def getValueFilter(self, field, symbol, testValue):
        if terms.isUUID(testValue):
            if symbol == '=':
                vFilter = Value.objects.filter(referenceValue_id=testValue)
            else:
                raise ValueError("unrecognized symbol: %s" % symbol)
        else:
            if symbol == '^=':
                vFilter = Value.objects.filter(Q(stringValue__istartswith=testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__istartswith=testValue))
            elif symbol == '=':
                vFilter = Value.objects.filter(Q(stringValue__iexact=testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__iexact=testValue))
            elif symbol == '*=':
                vFilter = Value.objects.filter(Q(stringValue__iregex='[[:<:]]' + testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__iregex='[[:<:]]' + testValue))
            elif symbol == '<':
                vFilter = Value.objects.filter(Q(stringValue__lt=testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__lt=testValue))
            elif symbol == '<=':
                vFilter = Value.objects.filter(Q(stringValue__lte=testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__lte=testValue))
            elif symbol == '>':
                vFilter = Value.objects.filter(Q(stringValue__gt=testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__gt=testValue))
            elif symbol == '>=':
                vFilter = Value.objects.filter(Q(stringValue__gte=testValue,referenceValue__isnull=True)|
                                               Q(referenceValue__description__text__gte=testValue))
            else:
                raise ValueError("unrecognized symbol: %s"%symbol)
        vFilter = vFilter.filter(deleteTransaction__isnull=True)
        return vFilter.filter(field=field) if field else vFilter

    # Returns a duple containing a new result set based on the first "phrase" of the path 
    # and a subset of path containing everything but the first "phrase" of the path.
    def refineResults(self, path, userInfo):
#         logger = logging.getLogger(__name__)
#         logger.error("refineResults(%s, %s)" % (str(self.querySet), path))
    
        if path[0] == '#':
            return InstanceQuerySet(Instance.objects.filter(pk=path[1])), path[2:]
        elif path[0] == '*':
            return InstanceQuerySet(Instance.objects.filter(deleteTransaction__isnull=True)), path[1:]
        elif path[0] == '[':
            params = path[1]
            if params[0] == 'ancestor' and params[1] == ':':
                # Filter by items that contain an ancestor with the specified field clause. 
                if params[2] != '?':
                    i = terms[params[2]]
                else:
                    i = None
                if len(params) == 5:
                    # example: ancestor:name*='foo'
                    #
                    # Get a Q clause that compares either a single test value or a comma-separated list of test values
                    # according to the specified symbol.
                    stringText = self.getAncestorClause(symbol=params[3], testValue=params[-1])
            
                    if i:
                        q = stringText & Q(ancestors__ancestor__value__field=i,
                                           ancestors__ancestor__value__deleteTransaction__isnull=True)
                    else:
                        q = stringText & Q(ancestors__ancestor__value__deleteTransaction__isnull=True)
                else:
                    raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
            else:
                q, i = self.clause(params, userInfo)
            
            # Need to add distinct after the tests to prevent duplicates if there is
            # more than one value of the instance that matches.
            return self.applyClause(q, i), path[2:]
        elif path[0] == '>' or path[0] == '/':
            i = terms[path[1]]
            if len(path) == 2:
                f = Value.objects.filter(instance__in=self.applyFindFilter(userInfo),
                                         field=i,
                                         deleteTransaction__isnull=True)\
                                 .order_by('instance', 'position')
                return wrapValueQuerySet(i, f), []
            elif len(path) == 4 and path[2] == '/' and terms.isUUID(path[3]):
                f = Value.objects.filter(instance__in=self.applyFindFilter(userInfo),
                                         field=i,
                                         deleteTransaction__isnull=True,
                                         referenceValue_id=path[3])\
                                 .order_by('instance', 'position')
                return wrapValueQuerySet(i, f), []
            else:
                f = Instance.objects.filter(referenceValues__instance__in=self.applyFindFilter(userInfo),
                                            referenceValues__field=i,
                                            referenceValues__deleteTransaction__isnull=True)\
                                    .order_by('parent', 'parentValue__position')
                return wrapInstanceQuerySet(i, f), path[2:]       
        elif path[0] == '::':
            function = path[1]
            if function == 'reference':
                if isinstance(path[2], list):
                    if len(path[2]) != 1:
                        t = map(terms.__getitem__, path[2])
                        f = Instance.objects.filter(typeID__in=t,
                                                    value__deleteTransaction__isnull=True,
                                                    value__referenceValue__in=self.applyFindFilter(userInfo))
                    else:
                        t = terms[path[2][0]]
                        f = Instance.objects.filter(value__deleteTransaction__isnull=True,
                                                    value__referenceValue__in=self.applyFindFilter(userInfo),
                                                    typeID=t,
                                                   )
                    return InstanceQuerySet(f), path[3:]
                else:
                    raise ValueError("malformed reference (missing parentheses)")
            else:
                raise ValueError("unrecognized function: %s" % function)
        elif path[0] == '|':
            # 'or' case.
            parsed = InstanceQuerySet().parse(path[1:], userInfo)
            return InstanceObjectSet(Instance.objects.filter(self.instanceQ()|parsed.instanceQ())), []
        elif len(path) >= 3 and path[0] == ':' and path[1] == 'not':
            if isinstance(path[2], list):
                if path[2][0] == '[':
                    params = path[2][1]
                    i = terms[params[0]]
                    if len(params) == 1:
                        f = self.excludeByField(i)
                        return f, path[3:]
                    elif len(params) == 3:
                        symbol = params[1]
                        testValue = params[2]
                        f = self.excludeByValue(i, symbol, testValue)
                        return f, path[3:]
                    else:
                        raise ValueError("unrecognized contents within ':not([...])'")
                else:
                    raise ValueError("unimplemented 'not' expression")
            else:
                raise ValueError("malformed 'not' expression")
        elif isinstance(path[0], list): # Path[0] is a list of type IDs.
            t = map(terms.__getitem__, path[0])
            f = Instance.objects.filter(typeID__in=t,
                                        deleteTransaction__isnull=True)
            return wrapInstanceQuerySet(t, f), path[1:]
        elif terms.isUUID(path[0]):
            pathID = uuid.UUID(path[0])
            if self.querySet:
                return InstanceQuerySet(self.querySet.filter(pk=pathID, deleteTransaction__isnull=True)), path[1:]
            else:
                return InstanceQuerySet(Instance.objects.filter(pk=pathID, deleteTransaction__isnull=True)), path[1:]
        else:   # Path[0] is the name of a type.
            i = terms[path[0]]
            f = Instance.objects.filter(typeID=i, deleteTransaction__isnull=True)
            return wrapInstanceQuerySet(i, f), path[1:]

    def parse(self, a, userInfo):
        qs = self
        path = a
        while len(path) > 0:
            qs, path = qs.refineResults(path, userInfo)
        return qs
    
    def getSubValueQuerySet(vqs, userInfo):
        return ValueQuerySet(vqs.filter(deleteTransaction__isnull=True)).applyFindFilter(userInfo) \
                       .order_by('position')\
                       .select_related('referenceValue')\
                       .select_related('referenceValue__description')

class ValueQuerySet(ObjectQuerySet):
    
    # Extends the specified QuerySet of Values with data to be returned to the client.
    def select_related(self, fieldNames, userInfo):

        # preload the typeID, parent, value_set and description to improve performance.
        # For each field that is in the fields list, also preload its field, referenceValue and referenceValue__description.
        valueQueryset = ObjectQuerySet.getSubValueQuerySet(Value.objects, userInfo)

        if len(fieldNames):
            # The distinct is required to eliminate duplicate subValues.
            subValues = Value.objects.filter(instance__deleteTransaction__isnull=True,
                                      instance__referenceValues__deleteTransaction__isnull=True,
                                      instance__referenceValues__field__description__text__in=fieldNames)\
                .distinct()
            subValueQueryset = ObjectQuerySet.getSubValueQuerySet(subValues, userInfo)
            valueQueryset =  valueQueryset.prefetch_related(Prefetch('referenceValue__value_set',
                                  queryset=subValueQueryset,
                                  to_attr='subValues'))

        self.querySet = self.querySet.select_related('referenceValue__description')\
                  .prefetch_related(Prefetch('referenceValue__value_set',
                                             queryset=valueQueryset,
                                             to_attr='values'))
        return self
    
    def __init__(self, querySet=None):
        super(ValueQuerySet, self).__init__(querySet)
        
    def createObjectQuerySet(self, querySet):
        return ValueQuerySet(querySet)
        
    def excludeFrom(self, oqs):
        if isinstance(oqs, InstanceQuerySet):
            return InstanceQuerySet(oqs.querySet.exclude(value__in=self.querySet))
        else:
            return ValueQuerySet(oqs.querySet.exclude(pk__in=self.querySet))

    # Return a Q expression that returns all of the instances in this query set.
    def instanceQ(self):
        return Q(referenceValues__in=self.querySet)
        
    def excludeByField(self, field):
        raise RuntimeError("ValueQuerySet.excludeByField not implemented")

    def excludeByValue(self, field, symbol, testValue):
        raise RuntimeError("ValueQuerySet.excludeByValue not implemented")
        
    # return an InstanceQuerySet derived from the contents of self.
    def filterToInstances(self):
        return InstanceQuerySet(Instance.objects.filter(referenceValues__in=self.querySet))
        
    # returns a Q clause to filter instances to those that contain references in 
    # the specified fields to one of the specified referenceValues.
    def clauseByReferenceValues(self, fieldNames, referenceValues):
        if isinstance(referenceValues, ObjectQuerySet):
            raise ValueError("referenceValues is an ObjectQuerySet")
            
        if isinstance(fieldNames, list):
            t = list(map(terms.__getitem__, fieldNames))
            return Q(field__in=t,
                     deleteTransaction__isnull=True,
                     referenceValue__in=referenceValues), t
        else:
            t = terms[fieldNames]
            return Q(field=t,
                     deleteTransaction__isnull=True,
                     referenceValue__in=referenceValues), t

    # Return a Q clause according to the specified params.
    # If the parameter list is a single item:
    #     If there is a list, then the object must contain a value with the specified field type.
    #     If there is a question mark, then this is a no-op.
    #     If there is a single term name, then each instance must contain a value of that term.
    # If the parameter list is three or more items and the second item is a '>',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match params[2:]. For example:
    #     /api/Offering[Service>Domain>%22Service%20Domain%22[_name=Sports]]
    # If the parameter list is three or more items and the second item is a '[',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match the clause in params[2] and any following clauses. For example: 
    #     /api/Service[Domain[%22Service%20Domain%22[_name=Sports]][_name^=B]
    # If the parameter list is three values, interpret the three values as a query clause and
    #     filter self on that clause.  
    def filterClause(self, params, userInfo):
    #     print('_filterClause params: %s'% (params))
        if len(params) == 1:
            if isinstance(params[0], list):
                return Q(referenceValue__value__field__in=map(terms.__getitem__, params[0]), 
                         referenceValue__value__deleteTransaction__isnull=True)
            elif params[0] == '?':
                return Q(referenceValue__value__deleteTransaction__isnull=True) #degenerate case
            else:
                return Q(referenceValue__value__field=terms[params[0]], value__deleteTransaction__isnull=True)
        elif len(params) > 2 and params[1]=='>':
            return self.clauseByReferenceValues(params[0], self.getReferenceValues(params, userInfo))
        elif len(params) > 2 and params[1]=='[':
            parsed = InstanceQuerySet().parse(['*'] + params[1:3], userInfo)
            subF = InstanceQuerySet(userInfo.findFilter(parsed))
            if len(params) > 3:
                parsed = subF.parse(params[3:], userInfo)
                subF = parsed.filterToInstances()
            return self.clauseByReferenceValues(params[0], subF.querySet)
        elif len(params) == 3:
            i = None if params[0] == '?' else \
                map(terms.__getitem__, params[0]) if isinstance(params[0], list) else \
                terms[params[0]]
        
            # Return a Q clause that compares either a single test value or a comma-separated list of test values
            # according to the specified symbol to a list of fields or a single field.
            if isinstance(i, map):
                return reduce(lambda q1, q2: q1 | q2, \
                                    map(lambda field: self.getQClause(field, params[1], params[2]), i))
            else:
                return self.getQClause(i, symbol=params[1], testValue=params[2])
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in params]))

    def applyClause(self, q, i):
        return wrapValueQuerySet(i, self.querySet.filter(q).distinct())
        
    def applyFindFilter(self, userInfo):
        qs = self.querySet
        if userInfo._findValueFilter:
            return qs.filter(userInfo._findValueFilter)
        elif userInfo.is_administrator:
            return qs
        else:
            if not userInfo.is_authenticated:
                userInfo._findValueFilter = Value.anonymousFindFilter()
            else:
                userInfo._findValueFilter = userInfo.instance.findValueFilter
            return qs.filter(userInfo._findValueFilter)

    def applyReadFilter(self, userInfo):
        qs = self.querySet
        if userInfo._readValueFilter:
            return qs.filter(userInfo._readValueFilter)
        elif userInfo.is_administrator:
            return qs
        else:
            if not userInfo.is_authenticated:
                userInfo._readValueFilter = Value.anonymousReadFilter()
            else:
                userInfo._readValueFilter = userInfo.instance.readValueFilter
            return qs.filter(userInfo._readValueFilter)

    def applyAdministerFilter(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return []   # If not authenticated, then return an empty iterable.
        elif userInfo.is_administrator:
            return qs
        else:
            return userInfo.instance.administerValueFilter(qs)
    
    @property        
    def types(self):
        return map(lambda i: Instance.objects.get(pk=i),
                   frozenset([x.referenceValue.typeID_id for x in self.querySet]))
    
    def getData(self, fields, fieldNames, fieldsDataDictionary, start, end, userInfo, language):
        self.select_related(fieldNames, userInfo)
        uuObjects = self.querySet.order_by('instance', 'position');
        if end > 0:
            uuObjects = uuObjects[start:end]
        elif start > 0:
            uuObjects = uuObjects[start:]
            
        return [v.getData(fields, fieldsDataDictionary, language, userInfo) for v in uuObjects]        

    def deleteObjects(self, user, nameLists, userInfo, transactionState):
        for value in self.querySet:
            if not value.referenceValue or value.referenceValue.parentValue != value:
                value.checkWriteAccess(userInfo)
                
                value.deepDelete(transactionState)
                if value.isDescriptor:
                    Instance.updateDescriptions([value.instance], nameLists)
            else:
                uuObject = value.referenceValue
                uuObject.checkWriteAccess(userInfo)
                
                for v in uuObject.referenceValues.filter(deleteTransaction__isnull=True):
                    v.markAsDeleted(transactionState)
                    if v.isDescriptor:
                        Instance.updateDescriptions([v.instance], nameLists)

                uuObject.deepDelete(transactionState)

### ReadValueQuerySet is an ValueQuerySet where all users have read access.
class ReadValueQuerySet(ValueQuerySet):

    def __init__(self, querySet=None):
        super(ReadValueQuerySet, self).__init__(querySet)
    
    ### Returns the querySet associated with self.    
    def applyFindFilter(self, userInfo):
        return self.querySet

    ### Returns the querySet associated with self.    
    def applyReadFilter(self, userInfo):
        return self.querySet

    # return an InstanceQuerySet derived from the contents of self.
    def filterToInstances(self):
        return ReadInstanceQuerySet(Instance.objects.filter(referenceValues__in=self.querySet))
        
class InstanceQuerySet(ObjectQuerySet):

    def __init__(self, querySet=None):
        super(InstanceQuerySet, self).__init__(querySet)
        
    def createObjectQuerySet(self, querySet):
        return InstanceQuerySet(querySet)
    
    ### Preloads the querySet of self with associated description and values
    def select_related(self, fieldNames, instanceDataPath, userInfo):
        valueQueryset = ObjectQuerySet.getSubValueQuerySet(Value.objects, userInfo)

        if len(fieldNames):
            # The distinct is required to eliminate duplicate subValues.
            subValues = Value.objects.filter(instance__deleteTransaction__isnull=True,
                                      instance__referenceValues__deleteTransaction__isnull=True,
                                      instance__referenceValues__field__description__text__in=fieldNames)\
                .distinct()
            subValueQueryset = ObjectQuerySet.getSubValueQuerySet(subValues, userInfo)
            valueQueryset =  valueQueryset.prefetch_related(Prefetch('referenceValue__value_set',
                                  queryset=subValueQueryset,
                                  to_attr='subValues'))

        self.querySet = self.querySet.select_related(instanceDataPath + 'description')\
                            .prefetch_related(Prefetch(instanceDataPath + 'value_set',
                                                        queryset=valueQueryset,
                                                        to_attr='values'))
        return self
    
     
    def excludeFrom(self, oqs):
        if isinstance(oqs, InstanceQuerySet):
            return InstanceQuerySet(oqs.querySet.exclude(pk__in=self.querySet))
        else:
            return ValueQuerySet(oqs.querySet.exclude(referenceValue__in=self.querySet))

    # Return a Q expression that returns all of the instances in this query set.
    def instanceQ(self):
        return Q(pk__in=self.querySet)
    
    ### Returns an instance queryset that excludes instances from the current query set
    ### That contain the specified field.    
    def excludeByField(self, field):
        return type(self)(field,
                          self.querySet.exclude(value__field=field, 
                                                value__deleteTransaction__isnull=True))

    ### Returns an instance queryset that excludes instances from the current query set
    ### that have a field that matches the testValue.    
    def excludeByValue(self, field, symbol, testValue):
        if isinstance(testValue, list):
            f = self.querySet
            for test in testValue:
                vFilter = self.getValueFilter(field, symbol, test)
                f = f.exclude(value__in=vFilter)
            return type(self)(f)
        else:
            vFilter = self.getValueFilter(field, symbol, testValue)
            return type(self)(self.querySet.exclude(value__in=vFilter))          

    # Returns an InstanceQuerySet derived from the contents of self.
    def filterToInstances(self):
        return self
    
    # returns a Q clause to filter instances to those that contain references in 
    # the specified fields to one of the specified referenceValues.
    def clauseByReferenceValues(self, fieldNames, referenceValues):
        if isinstance(referenceValues, ObjectQuerySet):
            raise ValueError("referenceValues is an ObjectQuerySet")
            
        if isinstance(fieldNames, list):
            t = map(terms.__getitem__, fieldNames)
            return Q(value__field__in=t,
                     value__deleteTransaction__isnull=True,
                     value__referenceValue__in=referenceValues), t
        else:
            t = terms[fieldNames]
            return Q(value__field=t,
                     value__deleteTransaction__isnull=True,
                     value__referenceValue__in=referenceValues), t

    def applyClause(self, q, i):
        return wrapInstanceQuerySet(i, self.querySet.filter(q).distinct())
        
    def getSimpleQClause(self, field, symbol, testValue):
        vFilter = self.getValueFilter(field, symbol, testValue)
        return Q(value__in=vFilter)

    def getSimpleAncestorClause(self, symbol, testValue):
        if symbol == '^=':
            q = Q(ancestors__ancestor__value__stringValue__istartswith=testValue)
        elif symbol == '=':
            q = Q(ancestors__ancestor__value__stringValue__iexact=testValue)
        elif symbol == '*=':
            q = Q(ancestors__ancestor__value__stringValue__icontains=testValue)
        elif symbol == '<':
            q = Q(ancestors__ancestor__value__stringValue__lt=testValue)
        elif symbol == '<=':
            q = Q(ancestors__ancestor__value__stringValue__lte=testValue)
        elif symbol == '>':
            q = Q(ancestors__ancestor__value__stringValue__gt=testValue)
        elif symbol == '>=':
            q = Q(ancestors__ancestor__value__stringValue__gte=testValue)
        else:
            raise ValueError("unrecognized symbol: %s" & symbol)
        return q
        # Handles a degenerate case where a referenceValue was stored in the same place as
        # the stringValue and it happens to match the query string, 

    # returns an QuerySet that matches the specified parameters.
    def getReferenceValues(self, params, userInfo):
    #     print('getReferenceValues: %s'%params)
        if len(params) > 2 and params[1] == '>':
            q, i = self.clauseByReferenceValues(params[2], self.getReferenceValues(params[2:], userInfo))
            subF = wrapInstanceQuerySet(i, Instance.objects.filter(q))
        else:
            # Replace the type name with a * for any item, because params[0] contains a field name, not a typeID.
            subF = InstanceQuerySet().parse(['*'] + params[1:], userInfo)
        return userInfo.findFilter(subF)

    # Returns a duple of a Q clause and term(s) according to the specified params.
    # If the parameter list is a single item:
    #     If there is a list, then the object must contain a value with the specified field type.
    #     If there is a question mark, then this is a no-op.
    #     If there is a single term name, then each instance must contain a value of that term.
    # If the parameter list is three or more items and the second item is a '>',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match params[2:]. For example:
    #     /api/Offering[Service>Domain>%22Service%20Domain%22[_name=Sports]]
    # If the parameter list is three or more items and the second item is a '[',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match the clause in params[2] and any following clauses. For example: 
    #     /api/Service[Domain[%22Service%20Domain%22[_name=Sports]][_name^=B]
    # If the parameter list is three values, interpret the three values as a query clause and
    #     filter self on that clause.  
    def filterClause(self, params, userInfo):
    #     print('_filterClause params: %s'% (params))
    
        if len(params) == 1:
            if isinstance(params[0], list):
                t = list(map(terms.__getitem__, params[0]))
                return Q(value__field__in=t, 
                         value__deleteTransaction__isnull=True), t
            elif params[0] == '?':
                return Q(value__deleteTransaction__isnull=True), None #degenerate case
            else:
                t = terms[params[0]]
                return Q(value__field=t, value__deleteTransaction__isnull=True), t
        elif len(params) > 2 and params[1]=='>':
            return self.clauseByReferenceValues(params[0], self.getReferenceValues(params, userInfo))
        elif len(params) > 2 and params[1]=='[':
            parsed = InstanceQuerySet().parse(['*'] + params[1:3], userInfo)
            subF = InstanceQuerySet(userInfo.findFilter(parsed))
            if len(params) > 3:
                parsed = subF.parse(params[3:], userInfo)
                subF = parsed.filterToInstances()
            return self.clauseByReferenceValues(params[0], subF.querySet)
        elif len(params) == 3:
            i = None if params[0] == '?' else \
                map(terms.__getitem__, params[0]) if isinstance(params[0], list) else \
                terms[params[0]]
        
            # Return a Q clause that compares either a single test value or a comma-separated list of test values
            # according to the specified symbol to a list of fields or a single field.
            if isinstance(i, map):
                return reduce(lambda q1, q2: q1 | q2, \
                                    map(lambda field: self.getQClause(field, params[1], params[2]), i)), i
            else:
                return self.getQClause(i, symbol=params[1], testValue=params[2]), i
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in params]))

    def applyFindFilter(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return qs.filter(Instance.anonymousFindFilter())
        elif userInfo.is_administrator:
            return qs
        elif userInfo.instance:
            return userInfo.instance.findFilter(qs)
        else:
            return qs.filter(Instance.anonymousFindFilter()) # This case occurs while setting up a user.

    def applyReadFilter(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return qs.filter(Instance.anonymousReadFilter())
        elif userInfo.is_administrator:
            return qs
        else:
            return userInfo.instance.readFilter(qs)

    def applyAdministerFilter(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return []   # If not authenticated, then return an empty iterable.
        elif userInfo.is_administrator:
            return qs
        else:
            return userInfo.instance.administerFilter(qs)
    
    @property        
    def types(self):
        return map(lambda i: Instance.objects.get(pk=i),
                   frozenset([x.typeID_id for x in self.querySet]))
    
    def getData(self, fields, fieldNames, fieldsDataDictionary, start, end, userInfo, language):
        self.select_related(fieldNames, '', userInfo)
        
        uuObjects = self.querySet.order_by('description__text', 'id');
        if end > 0:
            uuObjects = uuObjects[start:end]
        elif start > 0:
            uuObjects = uuObjects[start:]

        return [i.getData(fields, fieldsDataDictionary, language, userInfo) for i in uuObjects]        

    def deleteObjects(self, user, nameLists, userInfo, transactionState):
        for uuObject in self.querySet:
            for v in uuObject.referenceValues.filter(deleteTransaction__isnull=True):
                v.markAsDeleted(transactionState)
                if v.isDescriptor:
                    Instance.updateDescriptions([v.instance], nameLists)

            uuObject.deepDelete(transactionState)

### ReadInstanceQuerySet is an InstanceQuerySet where all users have read access.
class ReadInstanceQuerySet(InstanceQuerySet):

    def __init__(self, querySet=None):
        super(ReadInstanceQuerySet, self).__init__(querySet)
    
    ### Returns the querySet associated with self.    
    def applyFindFilter(self, userInfo):
        return self.querySet

    ### Returns the querySet associated with self.    
    def applyReadFilter(self, userInfo):
        return self.querySet

### Returns either a ReadValueQuerySet or a ValueQuerySet depending on whether
### or not the objects of the term need to be secured.
def wrapValueQuerySet(t, qs=None):
    if isinstance(t, list) or isinstance(t, map):
        isGlobal = reduce(lambda a, b: a and b,
                          map(lambda i: i.getSubInstance('of kind') != None, t),
                          True)
    else:
        isGlobal = t != None and t.getSubInstance('of kind') != None
        
    return ReadValueQuerySet(qs) if isGlobal else ValueQuerySet(qs)
    
### Returns either a ReadInstanceQuerySet or a InstanceQuerySet depending on whether
### or not the objects of the term need to be secured.
def wrapInstanceQuerySet(t, qs=None):
    if isinstance(t, list) or isinstance(t, map):
        isGlobal = reduce(lambda a, b: a and b,
                          map(lambda i: i.getSubInstance('of kind') != None, t),
                          True)
    else:
        isGlobal = t != None and t.getSubInstance('of kind') != None
        
    return ReadInstanceQuerySet(qs) if isGlobal else InstanceQuerySet(qs)
    
