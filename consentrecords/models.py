from django.db import connection
from django.db import models as dbmodels
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
    typeID = dbmodels.ForeignKey('consentrecords.Instance', related_name='typeInstance', db_column='typeid', db_index=True, editable=False)
    parent = dbmodels.ForeignKey('consentrecords.Instance', related_name='parentInstance', db_column='parentid', db_index=True, null=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
        
    def __str__(self):
        d = Description.objects.filter(instance=self, language_id__isnull=True)
        if d.count(): 
            return d[0].text
        else:
            return "Deleted"
    
    @property    
    def _description(self):
        d = Description.objects.filter(instance=self, language_id__isnull=True)
        if d.count(): 
            return d[0].text
        else:
            return "Deleted"

    @property    
    def _parentDescription(self):
        return self.parent and str(self.parent)
        
    @property
    def lazyInstance(self):
        return LazyInstance(self.id, instance=self)

    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, parent, transactionState):
        id = uuid.uuid4()
        i = Instance.objects.create(id=id, typeID=self, parent=parent,
                                    transaction = transactionState.transaction)
        return i
        
class DeletedInstance(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Instance', primary_key=True, db_column='id', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(self.id)
        
class LazyObject():
    # id can be a UUID or a string representation of a UUID
    def __init__(self, id=None):
        if not id:
            self.id = uuid.uuid4()
        elif isinstance(id, uuid.UUID):
            self.id = id
        else:
            try:
                self.id = uuid.UUID(id)
            except ValueError as e:
                raise ValueError("%s: %s" % (str(e), id))
            
    def __str__(self):
        return "uo{%s}" % self.id.hex
        
class LazyInstance(LazyObject):
    def __init__(self, id, typeID=None, parentID=None, transactionID=None, instance=None):
        self._typeID = typeID
        self._parentID = parentID
        self._transactionID = transactionID
        self._instance = instance
        super(LazyInstance, self).__init__(id)
        
    def __str__(self):
        try:
            return "{%s %s}" % (LazyInstance(self.typeID)._description, self._description)
        except Fact.UnrecognizedNameError:
            return "{%s %s}" % (self.typeID, self.id)
        
    def _fill(self):
        with connection.cursor() as c:
            sql = "SELECT i1.typeid, i1.parentid, i1.transaction_id" + \
              " FROM consentrecords_instance i1" + \
              " WHERE i1.id = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
            c.execute(sql, [self.id.hex])
            r = c.fetchone()
            if r:
                self._typeID = r[0]
                self._parentID = r[1]
                self._transactionID = r[2]
            else:
                raise ValueError('the ID "%s" is not an instance ID' % self.id.hex)

    @property
    def typeID(self):
        if self._typeID is None:
            self._fill()
        return self._typeID
    
    @property
    def parentID(self):
        if self._typeID is None:    # Use typeID instead of parentID because parentID can be None
            self._fill()
        return self._parentID
    
    @property
    def transactionID(self):
        if self._transactionID is None:
            self._fill()
        return self._transactionID
        
    @property
    def instance(self):
        if self._instance is None:
            try:
                self._instance = Instance.objects.get(id=self.id.hex)
            except Instance.DoesNotExist:
                raise Instance.DoesNotExist('The instance id "%s" is not recognized.' % self.id)
        return self._instance
    
    @property
    def parent(self):
        return self.parentID and LazyInstance(self.parentID)
        
    def fieldName(fieldID):     #Previously verbString
        return LazyInstance(fieldID).getSubValue(Fact.uuNameUUID()).stringValue or str(fieldID)
    
    @property   
    def objectString(self):
        if Fact.instanceOfName not in Fact.initialUUNames:
            return str(self.id)
            
        try:
            fieldName = LazyInstance.fieldName(uuid.UUID(self.typeID))
            if fieldName == Fact.uuNameName:
                return "{%s}" % LazyInstance.fieldName(self.id)
            else:
                return "{%s: %s}" % (fieldName, str(self.id))
        except Exception:
            return str(self.id)     
    
    def addValue(self, fieldID, value, position, transactionState):
        i = self.instance
        v = Value.objects.create(instance=i, fieldID=fieldID, stringValue = value, position=position, transaction=transactionState.transaction)
        return LazyValue(v.id, self.id.hex, fieldID, position, value)
    
    def createMissingSubValue(self, fieldID, value, position, transactionState):
        with connection.cursor() as c:
            sql = "SELECT v1.stringvalue" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.instance_id = %s AND v1.fieldID = %s AND v1.stringvalue = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [self.id.hex, fieldID.hex, value])
            if c.fetchone():
                return
                
        self.addValue(fieldID, value, position, transactionState)
        
    def _getSubValues(self, fieldID):
        with connection.cursor() as c:
            sql = "SELECT v1.id, v1.instance_id, v1.fieldID, v1.position, v1.stringvalue" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.instance_id = %s AND v1.fieldID = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
              " ORDER BY v1.position"
            c.execute(sql, [self.id.hex, fieldID.hex])
            return [LazyValue(i[0], i[1], i[2], i[3], i[4]) for i in c.fetchall()]
    
    def _getValues(self):
        with connection.cursor() as c:
            sql = "SELECT v1.id, v1.instance_id, v1.fieldID, v1.position, v1.stringvalue" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.instance_id = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
              " ORDER BY v1.fieldID, v1.position"
            c.execute(sql, [self.id.hex])
            values = {}
            for i in c.fetchall():
                if i[2] not in values:
                    values[i[2]] = []
                values[i[2]].append(LazyValue(i[0], i[1], i[2], i[3], i[4]))
            return values
    
    def _getSubInstances(self, fieldID): # Previously _getSubValueObjects
        return [LazyInstance(v.stringValue) for v in self._getSubValues(fieldID)]
        
    def getSubValueID(self, fieldID):   # Previously getSubValue
        if not fieldID:
            raise ValueError("fieldID is not specified")
            
        with connection.cursor() as c:
            sql = "SELECT v1.id" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.instance_id = %s AND v1.fieldID = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [self.id.hex, fieldID.hex])
            r = c.fetchone()
            return r and r[0]
    
    def getSubValue(self, fieldID):
        if not fieldID:
            raise ValueError("fieldID is not specified")
            
        with connection.cursor() as c:
            sql = "SELECT v1.id, v1.instance_id, v1.fieldID, v1.position, v1.stringvalue" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.instance_id = %s AND v1.fieldID = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [self.id.hex, fieldID.hex])
            r = c.fetchone()
            return r and LazyValue(r[0], r[1], r[2], r[3], r[4])
    
    def getSubInstance(self, fieldID):
        if not fieldID:
            raise ValueError("fieldID is not specified")
            
        v = self.getSubValue(fieldID)
        return v and LazyInstance(v.stringValue)
            
    # Returns a list of pairs of text that are used to generate the description of objects 
    # of this kind.
    # The first of the pair is the hex UUID of the name, the second is the hex UUID of the dataType
    @property
    def _descriptors(self):
        configuration = self.getSubInstance(fieldID=Fact.configurationUUID())
        results = []
        textUUID = Fact.textEnumUUID()
        countUUID = Fact.countEnumUUID()
        if configuration:
            elementIDs = [Fact.nameUUID(), Fact.dataTypeUUID()]
            for fieldObject in configuration._getSubInstances(fieldID=Fact.fieldUUID()):
                r = fieldObject.getSubInstance(fieldID=Fact.descriptorTypeUUID())
                if r:
                    n = [fieldObject.getSubValue(x) for x in elementIDs]
                    dataTypeInstance = n[1] and LazyInstance(n[1].stringValue)
                    dataTypeValue = dataTypeInstance and dataTypeInstance.getSubValue(Fact.nameUUID())
                    dataTypeName = dataTypeValue and dataTypeValue.stringValue
                    if n[0] and dataTypeName:
                        results.append([n[0].stringValue, dataTypeName, r.id])
        return results
        
    # Returns a description of this object with these verbs. 
    # verbs is an array of pairs where the first of the pair is the field name and 
    # the second is the field dataType.
    # The string is directly attached to the verb (v1).       
    def _getDescription(self, verbs):
        textUUID = Fact.textEnumUUID()
        countUUID = Fact.countEnumUUID()
        r = []
        for verb in verbs:
            name, dataType, descriptorType = verb[0], verb[1], verb[2]
            if descriptorType == textUUID:
                with connection.cursor() as c:
                    sql = "SELECT v1.stringvalue, v1.position" + \
                          " FROM consentrecords_value v1" + \
                          " WHERE v1.instance_id = %s AND v1.fieldID = %s" + \
                          " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
                          " ORDER BY v1.position"
                    c.execute(sql, [self.id.hex, name])
                    if dataType == Fact.objectName:
                        for i in c.fetchall():
                            ds = Description.objects.filter(instance_id=i[0], language_id__isnull=True)
                            if ds.count() > 0:
                                r.append(ds[0].text)
                            else:
                                r.append(LazyInstance(i[0])._description)
                    else:
                        r.extend([i[0] for i in c.fetchall()])
            elif descriptorType == countUUID:
                with connection.cursor() as c:
                    sql = "SELECT COUNT(*)" + \
                          " FROM consentrecords_value v1" + \
                          " WHERE v1.instance_id = %s AND v1.fieldID = %s" + \
                          " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
                    c.execute(sql, [self.id.hex, name])
                    r.extend([str(c.fetchone()[0])]);
            else:
                raise ValueError("unrecognized descriptorType %s" % LazyInstance(descriptorType).getSubValue(Fact.uuNameUUID()).stringValue);
                    
        return " ".join(r)
        
    def cacheDescription(self, nameLists):
        s = self._getDescription(nameLists.getNameUUIDs(self.typeID))
        Description.objects.update_or_create(instance_id = self.id.hex, 
                                             language_id = None, 
                                             defaults={'text': s})
        return s
    
    @property
    def _descriptionReferences(self):
        values = Value.objects.filter(stringValue=self.id.hex)\
            .filter(deletedvalue__isnull=True)
        return [v.instance.lazyInstance for v in filter(lambda v: v.isDescriptor, values)]

    def updateDescriptions(queue, nameLists):
        queue = list(queue) # Make a local copy of the list.
        calculated = []
        while len(queue) > 0:
            i = queue[0]
            queue = queue[1:]
            if i not in calculated:
                i.cacheDescription(nameLists)
                queue.extend(i._descriptionReferences)
                calculated.append(i)
    
    @property
    def _description(self):
        ofKindObject = LazyInstance(self.typeID)
        nameFieldUUIDs = ofKindObject._descriptors
        if len(nameFieldUUIDs):
            return self._getDescription(nameFieldUUIDs)
        else:
            return "{%s}" % ofKindObject.id
    
    # Get the cached description of this LazyInstance.        
    def description(self, language_id=None):
        if language_id:
            return Description.objects.get(instance_id=self.id.hex, language_id=language_id).text
        else:
            return Description.objects.get(instance_id=self.id.hex, language_id__isnull=True).text
        
    # verb is a UUID
    # return value is an array of all objects with the specified verb for this object.
    def _getAllInstances(self):
        with connection.cursor() as c:
            sql = "SELECT i1.id" + \
              " FROM consentrecords_instance i1" + \
              " WHERE typeid = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
            c.execute(sql, [self.id.hex])
            return [LazyInstance(i[0]) for i in c.fetchall()]
            
    # Gets a dictionary with all of the names of the enumeration values in the specified type as keys,
    # and the uuid of the enumeration object as the value.
    # Gets a dictionary of all of the universalObjects that are instances of the specified kind.
    # ofKindID is used as the directObject of an instanceOf verb to identify subjects that are root object IDs.
    # elementTypeName is the type used to identify what the descriptors are that describe each object.
    # Most of the type, nameTypeName and elementTypeName are the same, but they can be different
    # if there are objects that have two types (a parent type and a child type) and the child
    # type is used to identify the objects, but the parent type is used to get the description.
    def rootDescriptors(ofKindID):
        r = []
        ofKindObject = LazyInstance(ofKindID)
        nameFieldUUIDs = ofKindObject._descriptors
        return [{'id': None, \
                 'value': { 'id': e.id.hex, \
                            'description': e._getDescription(nameFieldUUIDs) }} \
                for e in ofKindObject._getAllInstances()]
    
    # returns a dictionary of info describing self.
    def clientObject(self, language_id=None):
        description = Description.objects.get(instance_id=self.id.hex, language_id__isnull=True)    
        return {'id': None, 'value': {'description': description.text, 'id': self.id.hex}}
    
    def selectAll(path):
        return LazyInstance.selectAllClientValues(path)
    
    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, languageID=None):        
        # The container of the data may be a value object or the object itself.
        # It will be a value object for values that have multiple data, such as enumerations.
        description = Description.objects.get(instance_id=self.id.hex, language_id__isnull=True)
        return { "id": None,
                 "value": {"id": self.id.hex, "description": description.text }}
        
    # Returns a dictionary by field id where each value is
    # a duple containing the name and id of an item referenced by self from the key field.
    def _getSubValueReferences(self):
        with connection.cursor() as c:
            sql = "SELECT v1.fieldID, v2.stringvalue, v1.stringvalue" + \
              " FROM consentrecords_value v1" + \
              " JOIN consentrecords_value v2 ON (v2.instance_id = v1.stringvalue)" + \
              " WHERE v1.instance_id = %s" + \
              " AND   v2.fieldID IN (%s, %s)" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v2.id)"
            c.execute(sql, [self.id.hex, Fact.nameUUID().hex, Fact.uuNameUUID().hex])
            d = {}
            for r in c.fetchall():
                d[uuid.UUID(r[0])] = (r[1], uuid.UUID(r[2]))
            return d
    
    def getParentReferenceFieldData(self):
        fieldData = {"name" : self.getSubValue(Fact.uuNameUUID()).stringValue,
                     "nameID" : self.id.hex,
                     "dataType" : Fact.objectName,
                     "dataTypeID" : Fact.objectUUID().hex,
                     "capacity" : Fact.uniqueValueName,
                     "ofKind" : self.getSubValue(Fact.uuNameUUID()).stringValue,
                     "ofKindID" : self.id.hex}
        return fieldData
                     
    def getFieldData(self):
        d = self._getSubValueReferences()
        fieldData = None
        if Fact.nameUUID() in d and Fact.dataTypeUUID() in d:
            nameReference = d[Fact.nameUUID()]
            dataTypeReference = d[Fact.dataTypeUUID()]
            fieldData = {"id" : self.id.hex, 
                         "name" : nameReference[0],
                         "nameID" : nameReference[1].hex,
                         "dataType" : dataTypeReference[0],
                         "dataTypeID" : dataTypeReference[1].hex}
            if Fact.maxCapacityUUID() in d:
                fieldData["capacity"] = d[Fact.maxCapacityUUID()][0]
            else:
                fieldData["capacity"] = Fact.multipleValuesName
                
            if Fact.descriptorTypeUUID() in d:
                fieldData["descriptorType"] = d[Fact.descriptorTypeUUID()][0]
            
            if Fact.addObjectRuleUUID() in d:
                fieldData["objectAddRule"] = d[Fact.addObjectRuleUUID()][0]
            
            if fieldData["dataType"] == Fact.objectName:
                if Fact.ofKindUUID() in d:
                    ofKindReference = d[Fact.ofKindUUID()]
                    fieldData["ofKind"] = ofKindReference[0]
                    fieldData["ofKindID"] = ofKindReference[1].hex
                v = self.getSubValue(Fact.pickObjectPathUUID())
                if v:
                    fieldData["pickObjectPath"] = v.stringValue;
        
        return fieldData
    
    # Return an array where each element contains the id and description for an object that
    # is contained by self.
    def _getSubReferences(self, fieldID):
        return [v.clientObject() for v in self._getSubValues(fieldID)]
    
    # Returns an array of arrays.
    def _getCellData(self, fieldData, values):
        cell = {"field": fieldData}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        elif fieldData["dataType"] == Fact.objectName:
            cell["data"] = [v.clientObject() for v in values[fieldID]]
        else:
            # Default case is that each datum in this cell contains a unique value.
            cell["data"] = [{"id": v.id.hex, "value": v.stringValue} for v in values[fieldID]]
        return cell
                
    def getData(self, fieldsData, nameLists):
        values = self._getValues()
        return [self._getCellData(fieldData, values) for fieldData in fieldsData]

    def getConfiguration(self):
        return [{"field": fieldObject.getFieldData()} for fieldObject in self._getSubInstances(Fact.fieldUUID())]

    def getMaxElementIndex(self, fieldID):
        maxElementIndex = reduce(lambda x,y: max(x, y), 
                                 [e.position for e in self._getSubValues(fieldID)],
                                 -1)
        if maxElementIndex < 0:
            return None
        else:
            return maxElementIndex

    def updateElementIndexes(self, fieldID, newIndex, transactionState):
        ids = {}
        
        for e in self._getSubValues(fieldID):
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
        
    def markAsDeleted(self, transactonState):
        DeletedInstance.objects.create(id=Instance.objects.get(pk=self.id), transaction=transactionState.transaction)

    def deepDelete(self, transactionState):
        queue = [self.id.hex]
        DeletedInstance.objects.create(id=Instance.objects.get(pk=self.id.hex), transaction=transactionState.transaction)
        sql1 = "INSERT INTO consentrecords_deletedvalue(id, transaction_id)" + \
              " SELECT id, %s from consentrecords_value v1 WHERE instance_id = %s" + \
              " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
        sql2 = "SELECT id FROM consentrecords_instance i1 WHERE parentid = %s" + \
               " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
        sql3 = "INSERT INTO consentrecords_deletedinstance(id, transaction_id)" + \
               " SELECT id, %s FROM consentrecords_instance i1 WHERE parentid = %s" + \
               " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
        while len(queue) > 0:
            nextid = queue[0]
            queue = queue[1:]
            with connection.cursor() as c:
                c.execute(sql2, [nextid])
                queue.extend([r[0] for r in c.fetchall()])
            with connection.cursor() as c:
                c.execute(sql3, [transactionState.transaction.id.hex, nextid])
            with connection.cursor() as c:
                c.execute(sql1, [transactionState.transaction.id.hex, nextid])
        
    def deleteOriginalReference(self, transactionState):
        if self.parentID:
            sql = "INSERT INTO consentrecords_deletedvalue(id, transaction_id)" + \
              " SELECT id, %s from consentrecords_value v1" + \
              " WHERE instance_id = %s AND stringvalue = %s" + \
              " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            with connection.cursor() as c:
                c.execute(sql, [transactionState.transaction.id.hex, self.parentID, self.stringValue])
                
class NameList():
    def __init__(self):
        self.items = {}
    
    def getNameUUIDs(self, typeID):
        if typeID in self.items:
            return self.items[typeID]
        else:
            ofKindObject = LazyInstance(typeID)
            nameFieldUUIDs = ofKindObject._descriptors
            self.items[typeID] = nameFieldUUIDs
            return nameFieldUUIDs
    
class LazyValue(LazyObject):
    def __init__(self, id, instanceID=None, fieldID=None, position=None, stringValue=None):
        self._instanceID = instanceID
        self._fieldID = fieldID
        self._position = position
        self._stringValue = stringValue
        super(LazyValue, self).__init__(id)
        
    def __str__(self):
        return "%s[%s:%s]@%s" % (str(LazyInstance(self.instanceID)), 
                                 str(LazyInstance(self.fieldID)), 
                                 self.stringValue, 
                                 str(self.position))
    
    def _fill(self):
        with connection.cursor() as c:
            sql = "SELECT v1.instance_id, v1.fieldID, v1.position, v1.stringvalue" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.id = %s"
            c.execute(sql, [self.id.hex])
            r = c.fetchone()
            if r:
                self._instanceID, self._fieldID, self._position, self._stringValue = r
                
    @property
    def instanceID(self):
        if self._instanceID is None:
            self._fill()
        return self._instanceID
        
    @property
    def instance(self):
        return LazyInstance(self.instanceID)
    
    @property
    def fieldID(self):
        if self._fieldID is None:
            self._fill()
        return self._fieldID
    
    @property
    def position(self):
        if self._position is None:
            self._fill()
        return self._position
    
    @property
    def stringValue(self):
        if self._stringValue is None:
            self._fill()
        return self._stringValue
    
    # returns a dictionary of info describing self.
    def clientObject(self, language_id=None, instance=None):
        description = Description.objects.get(instance_id=self.stringValue, language_id__isnull=True) 
        return {'id': self.id.hex, 
                'value': {'id': self.stringValue, 'description': description.text},
                'position': self.position}
    
    def getReferenceData(self, languageID=None):
        description = Description.objects.get(instance_id=self.stringValue, language_id__isnull=True)
        return { "id": self.id.hex,
              "value": {"id" : self.stringValue, "description": description.text },
              "position": self.position }
            
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newStringValue, transactionState):
        if self._fieldID is None:
            self._fill()
        self.markAsDeleted(transactionState)
        return LazyInstance(self.instanceID).addValue(self.fieldID, newStringValue, self.position, transactionState);
    
    # Updates the position of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateIndex(self, newIndex, transactionState):
        if self._fieldID is None:
            self._fill()
        self.markAsDeleted(transactionState)
        LazyInstance(self.instanceID).addValue(self.fieldID, self.stringValue, newIndex, transactionState);
    
    def markAsDeleted(self, transactionState):
        DeletedValue.objects.create(id=Value.objects.get(pk=self.id), transaction=transactionState.transaction)
        
    @property
    def isOriginalReference(self):
        # If it is not an id, then return false.
        if not Fact.isUUID(self.stringValue):
            return False
        i = LazyInstance(self.stringValue)
        return self.instanceID == i.parentID
        
    @property
    def isDescriptor(self):
        container = Instance.objects.get(pk=self.instanceID)
        configurationInstance = Instance.objects.filter(parent=container.typeID, typeID_id=Fact.configurationUUID().hex) \
            .get(deletedinstance__isnull=True)
        if isinstance(self.fieldID, str):
            fieldID = self.fieldID
        else:
            fieldID = self.fieldID.hex
        fields = Instance.objects.filter(parent__parent=container.typeID, 
                    parent__typeID_id=Fact.configurationUUID().hex,
                    parent__deletedinstance__isnull=True,
                    typeID_id=Fact.fieldUUID().hex) \
            .filter(deletedinstance__isnull=True)\
            .filter(value__fieldID=Fact.nameUUID().hex,\
                    value__stringValue=fieldID)\
            .filter(value__fieldID=Fact.descriptorTypeUUID().hex)
        return fields.count() > 0
                    
class Value(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    fieldID = dbmodels.UUIDField(db_index=True, default=uuid.uuid4, editable=False)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(LazyValue(self.id, self.instance.id, self.fieldID, self.position, self.stringValue))
    
    @property
    def instanceid(self):
        return self.instance.id
    
    @property
    def field(self):
        return LazyInstance(self.fieldID)
        
    @property
    def objectValue(self):
        if Fact.isUUID(self.stringValue):
            try:
                return str(LazyInstance(self.stringValue))
            except Exception:
                return self.stringValue
        else:
            return self.stringValue
    
    @property
    def isDescriptor(self):
        container = self.instance
        typeInstance = container.typeID
        configurationInstance = Instance.objects.filter(parent=typeInstance, typeID_id=Fact.configurationUUID().hex) \
            .get(deletedinstance__isnull=True)
        if isinstance(self.fieldID, str):
            fieldID = self.fieldID
        else:
            fieldID = self.fieldID.hex
        fields = Instance.objects.filter(parent=configurationInstance, typeID_id=Fact.fieldUUID().hex) \
            .filter(deletedinstance__isnull=True)\
            .filter(value__fieldID=Fact.nameUUID().hex,\
                    value__stringValue=fieldID)\
            .filter(value__fieldID=Fact.descriptorTypeUUID().hex)
        return fields.count() > 0

class DeletedValue(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Value', primary_key=True, db_column='id', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(LazyValue(self.id))
        
class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    language = dbmodels.ForeignKey('consentrecords.Instance', related_name='language', db_index=True, null=True, editable=False)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)
    
    

class Fact():
    # These verbs are associated with field IDs of values.
    uuNameName = '_uuname'
    configurationName = '_configuration'
    fieldName = '_field'
    booleanName = '_boolean'
    nameName = '_name'
    dataTypeName = '_data type'
    stringName = '_string'
    numberName = '_number'
    datestampName = '_datestamp'
    objectName = '_object'
    ofKindName = '_of kind'
    pickObjectPathName = '_pick object path'
    enumeratorName = 'enumerator'
    maxCapacityName = '_max capacity'
    uniqueValueName = '_unique value'
    multipleValuesName = '_multiple values'
    addObjectRuleName = '_object add rule'
    pickObjectRuleName = '_pick one'
    createObjectRuleName = '_create one'
    descriptorTypeName = '_descriptor type'
    yesName = '_yes'
    noName = '_no'
    userName = '_user'
    userIDName = '_userID'
    emailName = '_email'
    firstNameName = '_first name'
    lastNameName = '_last name'
    languageName = '_language'
    englishName = 'English'
    translationName = '_translation'
    textName = '_text'
    textEnumName = '_by text'
    countEnumName = '_by count'
    
    initialKinds = [
        configurationName,      # identifies a configuration instance (contained by a kind)
        fieldName,              # identifies a field instance (contained by a configuration)
        booleanName,            # identifies an instance of type Boolean
        nameName,               # Defines the proper name of an object.
        ofKindName,             # identifies the type of object for a field of "object" data type.
        pickObjectPathName,     # identifies the path to objects that are to be picked.
        enumeratorName,         # identifies an enumerator
        dataTypeName,           # defines the data type of a property
        maxCapacityName,        # defines the quantity relationship of a field within its container.
        addObjectRuleName,      # defines the rule for adding objects to a field that supports multiple objects
        descriptorTypeName,     # defines how the data of this field is used to describe its instance.
        userName,               # identifies an instance of a user.
        userIDName,             # identifies the user identifier for the user.
        emailName,              # identifies an email address.
        firstNameName,          # identifies the first name.
        lastNameName,           # identifies the last name.
        languageName,           # identifies an instance of a language
        translationName,        # identifies an instance of translated text
        textName,               # identifies the text of a translation.
        ]

    #         uniqueValueName,        # identifies fields that have only one value.
    #         multipleValuesName,     # identifies fields that have multiple values.
    #         yesName,                # identifies the value yes.
    #         noName,                 # identifies the value no.
    #         pickObjectRuleName,     # identifies fields where you add an object by picking it
    #         createObjectRuleName,   # identifies fields where you add an object by instantiating a new instance.
    #         stringName,             # identifies a string data type
    #         numberName,             # identifies a string data type
    #         datestampName,          # identifies a string data type
    #         objectName,             # identifies an object data type
    #         textEnumName,           # identifies fields that describe their containers by text.
    #         countEnumName,          # identifies fields that describe their containers by count

    initialUUNames = {}  
        
    _bootstrapName = 'Bootstrap'
    
    # An exception that gets raised when trying to do an operation that needs to create 
    # a fact in a context in which facts should not be created (such as getting an enumeration list)
    class NoEditsAllowedError(ValueError):
        def __str__(self):
            return "No edits are allowed for this operation."

    class UnrecognizedNameError(ValueError):
        def __init__(self, uuname):
            self.uuname = uuname
            
        def __str__(self):
            return 'The term "%s" is not recognized' % self.uuname
            
    # Gets the ID of the uuName uuName from the database, or None if it isn't initialized.
    def getUUNameID():
        with connection.cursor() as c:
            sql = "SELECT v1.instance_id" + \
                  " FROM consentrecords_value v1" + \
                  " WHERE v1.fieldid = v1.instance_id AND v1.stringvalue = %s" + \
                  " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [Fact.uuNameName])
            i = c.fetchone()
            return i and uuid.UUID(i[0])
            
    def createUUNameID(transactionState):
        uunameID = uuid.uuid4()
        Instance.objects.create(id=uunameID.hex, typeID_id=uunameID.hex, parent=None, transaction=transactionState.transaction)
        LazyInstance(uunameID).addValue(uunameID, Fact.uuNameName, 0, transactionState)
        return uunameID
       
    # Return the UUID for the 'uuname' instance. 
    def uuNameUUID():
        name = Fact.uuNameName
        if name not in Fact.initialUUNames:
            with connection.cursor() as c:
                sql = "SELECT v1.instance_id" + \
                      " FROM consentrecords_value v1" + \
                      " WHERE v1.fieldid = v1.instance_id AND v1.stringvalue = %s" + \
                      " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
                c.execute(sql, [Fact.uuNameName])
                i = c.fetchone();
                Fact.initialUUNames[name] = uuid.UUID(i[0])
        
        return Fact.initialUUNames[name]
    
    def _getInitialUUID(name):
        if name not in Fact.initialUUNames:
            try:
                Fact.initialUUNames[name] = Value.objects.get(stringValue=name, fieldID=Fact.uuNameUUID().hex).instance.id
            except Value.DoesNotExist:
                raise Fact.UnrecognizedNameError(name)
                
            if isinstance(Fact.initialUUNames[name], str):
                Fact.initialUUNames[name] = uuid.UUID(Fact.initialUUNames[name])
                
        return Fact.initialUUNames[name]

    def _getObjectUUID(typeID, name):
        if name not in Fact.initialUUNames:
            Fact.initialUUNames[name] = Fact.getNamedEnumeratorID(typeID, name)
            if isinstance(Fact.initialUUNames[name], str):
                Fact.initialUUNames[name] = uuid.UUID(Fact.initialUUNames[name])
                
        return Fact.initialUUNames[name]

    def _getTranslationObjectUUID(typeID, name):
        if name not in Fact.initialUUNames:
            Fact.initialUUNames[name] = Fact.getTranslationNamedEnumeratorID(typeID, name)
            if isinstance(Fact.initialUUNames[name], str):
                Fact.initialUUNames[name] = uuid.UUID(Fact.initialUUNames[name])
                
        return Fact.initialUUNames[name]

    def configurationUUID(): return Fact._getInitialUUID(Fact.configurationName)
        
    def nameUUID(): return Fact._getInitialUUID(Fact.nameName)
        
    def fieldUUID(): return Fact._getInitialUUID(Fact.fieldName)
        
    def dataTypeUUID(): return Fact._getInitialUUID(Fact.dataTypeName)
    
    def stringUUID():
        return Fact._getObjectUUID(Fact.dataTypeUUID(), Fact.stringName)
    def objectUUID():
        return Fact._getObjectUUID(Fact.dataTypeUUID(), Fact.objectName)
        
    def booleanUUID(): return Fact._getInitialUUID(Fact.booleanName)
    
    def ofKindUUID(): return Fact._getInitialUUID(Fact.ofKindName)
    
    def pickObjectPathUUID(): return Fact._getInitialUUID(Fact.pickObjectPathName)
        
    def enumeratorUUID(): return Fact._getInitialUUID(Fact.enumeratorName)
        
    # Gets the UUID for the quantity relationship of a field within its container.
    def maxCapacityUUID(): return Fact._getInitialUUID(Fact.maxCapacityName)

    # Gets the UUID for the enum of fields that have only one value.
    def uniqueValueUUID():
        return Fact._getObjectUUID(Fact.maxCapacityUUID(), Fact.uniqueValueName)

    # Gets the UUID for the enum of fields that have multiple values.
    def multipleValuesUUID():
        return Fact._getObjectUUID(Fact.maxCapacityUUID(), Fact.multipleValuesName)

    def addObjectRuleUUID(): return Fact._getInitialUUID(Fact.addObjectRuleName)
    
    def pickObjectRuleUUID():
        return Fact._getObjectUUID(Fact.addObjectRuleUUID(), Fact.pickObjectRuleName)
        
    def createObjectRuleUUID():
        return Fact._getObjectUUID(Fact.addObjectRuleUUID(), Fact.createObjectRuleName)

    def descriptorTypeUUID(): return Fact._getInitialUUID(Fact.descriptorTypeName)
    
    def yesUUID():
        return Fact._getTranslationObjectUUID(Fact.booleanUUID(), Fact.yesName)
    def noUUID():
        return Fact._getTranslationObjectUUID(Fact.booleanUUID(), Fact.multipleValuesName)

    def languageUUID(): return Fact._getInitialUUID(Fact.languageName)
    def translationUUID(): return Fact._getInitialUUID(Fact.translationName)
    def textUUID(): return Fact._getInitialUUID(Fact.textName)

    def textEnumUUID(): return Fact._getObjectUUID(Fact.descriptorTypeUUID(), Fact.textEnumName);
    def countEnumUUID(): return Fact._getObjectUUID(Fact.descriptorTypeUUID(), Fact.countEnumName);
            
    # Return the UUID for the specified Ontology object. If it doesn't exist, it is created with the specified transaction.   
    def getNamedUUID(uuname):
        fieldID = Fact.uuNameUUID()
        with connection.cursor() as c:
            sql = "SELECT v1.instance_id" + \
                  " FROM consentrecords_value v1" + \
                  " WHERE v1.fieldid = %s" + \
                  " AND   v1.stringvalue = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [fieldID.hex, uuname])
            r = c.fetchone()
            if not r:
                raise Fact.UnrecognizedNameError(uuname)
            else:
                return uuid.UUID(r[0])
    
    def isUUID(s):
        return re.search('^[a-fA-F0-9]{32}$', s)
    
    # Return a 32 character hex string which represents the ID of the specified universal name.
    # If the argument is a 32 character hex string, then it is considered that ID. Otherwise,
    # it is looked up by name.
    def getUUIDHex(uuname):
        if Fact.isUUID(uuname):
            return uuname
        else:
            return Fact.getNamedUUID(uuname).hex
            
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Fact.UnrecognizedNameError.   
    def getNamedEnumeratorID(uunameID, stringValue):
        with connection.cursor() as c:
            sql = "SELECT v1.stringvalue" + \
                  " FROM consentrecords_value v1" + \
                  " JOIN consentrecords_value v2 ON (v2.instance_id = v1.stringvalue)" + \
                  " JOIN consentrecords_instance i1 ON (i1.id = v1.instance_id)" + \
                  " WHERE v1.instance_id = %s" + \
                  " AND   v1.fieldid = %s" + \
                  " AND   v2.fieldid = %s" + \
                  " AND   v2.stringvalue = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v2.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
            c.execute(sql, [uunameID.hex, Fact.enumeratorUUID().hex, Fact.nameUUID().hex, stringValue])
            r = c.fetchone()
            if not r:
                raise Fact.UnrecognizedNameError(stringValue)
            else:
                return uuid.UUID(r[0])
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Fact.UnrecognizedNameError.   
    def getTranslationNamedEnumeratorID(uunameID, stringValue):
        with connection.cursor() as c:
            sql = "SELECT v1.stringvalue" + \
                  " FROM consentrecords_value v1" + \
                  " JOIN consentrecords_value v2 ON (v2.instance_id = v1.stringvalue)" + \
                  " JOIN consentrecords_value v3 ON (v3.instance_id = v2.stringvalue)" + \
                  " JOIN consentrecords_instance i1 ON (i1.id = v1.instance_id)" + \
                  " WHERE v1.instance_id = %s" + \
                  " AND   v1.fieldid = %s" + \
                  " AND   v2.fieldid = %s" + \
                  " AND   v3.fieldid = %s" + \
                  " AND   v3.stringvalue = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v2.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v3.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
            c.execute(sql, [uunameID.hex, Fact.enumeratorUUID().hex, Fact.translationUUID().hex, Fact.textUUID().hex, stringValue])
            r = c.fetchone()
            if not r:
                raise Fact.UnrecognizedNameError(stringValue)
            else:
                return uuid.UUID(r[0])
        
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Fact.UnrecognizedNameError.   
    def getFieldNamedID(configurationID, name):
        with connection.cursor() as c:
            sql = "SELECT v1.stringvalue" + \
                  " FROM consentrecords_value v1" + \
                  " JOIN consentrecords_value v2 ON (v2.instance_id = v1.stringvalue)" + \
                  " JOIN consentrecords_value v3 ON (v3.instance_id = v2.stringvalue)" + \
                  " JOIN consentrecords_instance i1 ON (i1.id = v1.instance_id)" + \
                  " WHERE v1.instance_id = %s" + \
                  " AND   v1.fieldid = %s" + \
                  " AND   v2.fieldid = %s" + \
                  " AND   v3.fieldid = %s" + \
                  " AND   v3.stringvalue = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v2.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v3.id)" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)"
            c.execute(sql, [configurationID.hex, Fact.fieldUUID().hex, Fact.nameUUID().hex, Fact.uuNameUUID().hex, name])
            r = c.fetchone()
            if not r:
                raise Fact.UnrecognizedNameError(name)
            else:
                return uuid.UUID(r[0])
