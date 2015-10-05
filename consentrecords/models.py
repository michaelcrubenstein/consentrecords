from django.db import connection
from django.db import models as dbmodels
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
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
        with TransactionState.mutex:
            if self.currentTransaction == None:
                self.currentTransaction = Transaction.createTransaction(self.user, self.timeZoneOffset)

        return self.currentTransaction
        
class Instance(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    typeID = dbmodels.UUIDField(db_index=True, editable=False)
    parentID = dbmodels.UUIDField(db_index=True, null=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
        
    def __str__(self):
        return str(LazyInstance(self.id, self.typeID, self.parentID, self.transaction))
    
    @property    
    def _description(self):
        return str(LazyInstance(self.id, self.typeID, self.parentID, self.transaction))

    @property    
    def _parentDescription(self):
        return self.parentID and str(LazyInstance(self.parentID))

class DeletedInstance(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(self.instance.id)
        
class LazyObject():
    # id can be a UUID or a string representation of a UUID
    def __init__(self, id=None):
        if not id:
            self.id = uuid.uuid4()
        elif isinstance(id, uuid.UUID):
            self.id = id
        else:
            self.id = uuid.UUID(id)
            
    def __str__(self):
        return "uo{%s}" % self.id.hex
        
class LazyInstance(LazyObject):
    def __init__(self, id, typeID=None, parentID=None, transactionID=None):
        self._typeID = typeID
        self._parentID = parentID
        self._transactionID = transactionID
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
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.instance_id = i1.id)"
            c.execute(sql, [self.id.hex])
            r = c.fetchone()
            if r:
                self._typeID = r[0]
                self._parentID = r[1]
                self._transactionID = r[2]

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
        if self._transactionID is None: # Use typeID instead of parentID because parentID can be None
            self._fill()
        return self._transactionID
    
    def fieldName(fieldID):     #Previously verbString
        return LazyInstance(fieldID).getSubValue(Fact.uuNameUUID()).stringValue or str(fieldID)
    
    @property   
    def objectString(self):
        if Fact.instanceOfName not in Fact._initialUUNames:
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
        logger = logging.getLogger(__name__)
        logger.error("%s.addValue(%s, %s, %s)" % (str(self.id), str(fieldID), value, position))
        i = Instance.objects.get(id=self.id.hex)
        v = Value.objects.create(instance=i, fieldID=fieldID, stringValue = value, position=position, transaction=transactionState.transaction)
        logger.error("  value id:(%s)" % (v.id))
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
    
    def getSubValue(self, fieldID): # Previously getSubValueObject
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
    
    def getSubInstance(self, fieldID):      # Previously getSubValueObject
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
        yesUUID = Fact.yesUUID()
        if configuration:
            elementIDs = [Fact.nameUUID(), Fact.dataTypeUUID()]
            for fieldObject in configuration._getSubInstances(fieldID=Fact.fieldUUID()):
                r = fieldObject.getSubInstance(fieldID=Fact.isDescriptorUUID())
                if r and r.id == yesUUID:
                    n = [fieldObject.getSubValue(x) for x in elementIDs]
                    dataTypeInstance = n[1] and LazyInstance(n[1].stringValue)
                    dataTypeValue = dataTypeInstance and dataTypeInstance.getSubValue(Fact.nameUUID())
                    dataTypeName = dataTypeValue and dataTypeValue.stringValue
                    if n[0] and dataTypeName:
                        results.append([n[0].stringValue, dataTypeName])
        return results
        
    # Returns a description of this object with these verbs. 
    # verbs is an array of pairs where the first of the pair is the field name and 
    # the second is the field dataType.
    # The string is directly attached to the verb (v1).       
    def _getDescription(self, verbs):
        r = []
        logger = logging.getLogger(__name__)
        for verb in verbs:
            name, dataType = verb[0], verb[1]
            with connection.cursor() as c:
                sql = "SELECT v1.stringvalue" + \
                      " FROM consentrecords_value v1" + \
                      " WHERE v1.instance_id = %s AND v1.fieldID = %s" + \
                      " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
                c.execute(sql, [self.id.hex, name])
                if dataType == Fact.objectName:
                    r.extend([LazyInstance(i[0])._description for i in c.fetchall()])
                else:
                    r.extend([i[0] for i in c.fetchall()])
                    
        return " ".join(r)
    
    @property
    def _description(self):
        ofKindObject = LazyInstance(self.typeID)
        nameFieldUUIDs = ofKindObject._descriptors
        if len(nameFieldUUIDs):
            return self._getDescription(nameFieldUUIDs)
        else:
            return "{%s}" % ofKindObject.id
        
    # verb is a UUID
    # return value is an array of all objects with the specified verb for this object.
    def _getAllInstances(self):
        with connection.cursor() as c:
            sql = "SELECT i1.id" + \
              " FROM consentrecords_instance i1" + \
              " WHERE typeid = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.instance_id = i1.id)"
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
        with connection.cursor() as c:
            r = []
            ofKindObject = LazyInstance(ofKindID)
            nameFieldUUIDs = ofKindObject._descriptors
            return [{'id': None, \
                     'value': { 'id': e.id.hex, \
                                'description': e._getDescription(nameFieldUUIDs) }} \
                    for e in ofKindObject._getAllInstances()]
    
    def _checkCount(sql, argList):
        with connection.cursor() as c:
            c.execute(sql, argList)
            return c.fetchone()[0]
        
    def _getResultArray(sql, argList):
        with connection.cursor() as c:
            c.execute(sql, argList)
            return [i[0] for i in c.fetchall()]
        
    def refineResults(resultSet, path):
        if path[0] == '#':
            sql = 'SELECT i1.id FROM consentrecords_instance i1' + \
                     ' WHERE i1.id=%s' + \
                     ' AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.instance_id = i1.id)'
            with connection.cursor() as c:
                c.execute(sql, [path[1]])
                return [r[0] for r in c.fetchall()], path[2:]
        elif path[0] == '[':
            if len(path[1]) == 1:
                lastTable = tableList[-1]
                sql = 'SELECT COUNT(*) FROM consentrecords_value v1' + \
                      ' WHERE v1.instance_id = %s AND v1.fieldID = %s' + \
                      ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id))'
                fieldID = Fact.getNamedUUID(path[1][0]).hex
                newResults = filter(lambda s: LazyInstance._checkCount(sql, [s, fieldID]), resultSet)
                return newResults, path[2:]
            elif len(path[1]) == 3:
                fieldID = Fact.getNamedUUID(path[1][0]).hex
                symbol = path[1][1]
                testValue = path[1][2]
                sql = 'SELECT COUNT(*) FROM consentrecords_value v1' + \
                      ' WHERE v1.instance_id = %s' + \
                      ' AND v1.fieldID = %s AND v1.stringvalue ' + symbol + ' %s' + \
                      ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)'
                newResults = filter(lambda s: LazyInstance._checkCount(sql, [s, fieldID, testValue]), resultSet)
                return newResults, path[2:]
            else:
                raise ValueError("not yet implemented")
        elif path[0][0] == '>':
            fieldID = Fact.getNamedUUID(path[1]).hex
            sql = 'SELECT v1.stringvalue id' + \
                     ' FROM consentrecords_value v1' + \
                     ' WHERE v1.instance_id = %s AND v1.fieldID = %s' + \
                     ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)'
            m = map(lambda s: LazyInstance._getResultArray(sql, [s, fieldID]), resultSet)
            newResults = [item for sublist in m for item in sublist]
            return newResults, path[2:]         
        else:   # Path[0] is a type.
            logger = logging.getLogger(__name__)
            logger.error( "path[0]: %s" % path[0])
            fieldID = Fact.getNamedUUID(path[0]).hex
            sql = 'SELECT i1.id' + \
                     ' FROM consentrecords_instance i1' + \
                     ' WHERE i1.typeid = %s' + \
                     ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.instance_id = i1.id)'
            with connection.cursor() as c:
                c.execute(sql, [fieldID])
                return [r[0] for r in c.fetchall()], path[1:]
        
        return newSQL, newArgList, remainder, newTableList
            
    def selectAllObjects(path):
        logger = logging.getLogger(__name__)
        logger.error("Entering selectAll: %s" % path)
        
        resultSet = [([], path)]
        while len(resultSet[-1][1]) > 0:
            lastPair = resultSet[-1]
            nextPair = LazyInstance.refineResults(lastPair[0], lastPair[1])
            resultSet.append(nextPair)
            logger.error("Iterate selectAllObjects: %s, %s" % nextPair)
        
        return [LazyInstance(i) for i in resultSet[-1][0]]
    
    # returns a dictionary of info describing self.
    def clientObject(self, nameLists):
        typeID = self.typeID
        if typeID in nameLists:
            nameFieldUUIDs = nameLists[typeID]
        else:
            ofKindObject = LazyInstance(typeID)
            nameFieldUUIDs = ofKindObject._descriptors
            nameLists[typeID] = nameFieldUUIDs
            
        return {'id': None, 'value': {'description': self._getDescription(nameFieldUUIDs), 'id': self.id.hex}}
    
    def selectAll(path):
        nameLists = {}
        m = LazyInstance.selectAllObjects(path)
        logger = logging.getLogger(__name__)
        logger.error("Entering selectAll: %s" % [str(i) for i in m])
        
        return [e.clientObject(nameLists) for e in m]
    
    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, ofKindObject):        
        # The container of the data may be a value object or the object itself.
        # It will be a value object for values that have multiple data, such as enumerations.
        return { "id": None,
                 "value": {"id": self.id.hex, 
                        "description": self._getDescription(ofKindObject._descriptors), }}
            
        return f;
        
    # Returns a duple containing the name and id of an item referenced by self.
    def getSubValueReference(self, fieldID, descriptorID):
        i = self.getSubInstance(fieldID)
        v = i and i.getSubValue(descriptorID)
        return v and (v.stringValue, i.id)
    
    def getFieldData(self):
        logger = logging.getLogger(__name__)
        logger.error("  %s.getFieldData()" % str(self))
        nameReference = self.getSubValueReference(Fact.nameUUID(), Fact.uuNameUUID())
        dataTypeReference = self.getSubValueReference(Fact.dataTypeUUID(), Fact.nameUUID())
        logger.error("  getFieldData() nameReference: %s" % str(nameReference))
        logger.error("  getFieldData() dataTypeReference: %s" % str(dataTypeReference))
        fieldData = None
        if nameReference and dataTypeReference:
            fieldData = {"id" : self.id.hex, 
                         "name" : nameReference[0],
                         "nameID" : nameReference[1].hex,
                         "dataType" : dataTypeReference[0],
                         "dataTypeID" : dataTypeReference[1].hex}
            r = self.getSubValueReference(Fact.maxCapacityUUID(), Fact.nameUUID())
            if r:
                fieldData["capacity"] = r[0]
            else:
                fieldData["capacity"] = Fact.multipleValuesName
                
            r = self.getSubInstance(Fact.isDescriptorUUID())
            fieldData["isDescriptor"] = bool(r and r.id == Fact.yesUUID())
            
            r = self.getSubValueReference(Fact.addObjectRuleUUID(), Fact.nameUUID())
            if r:
                fieldData[Fact.addObjectRuleName] = r[0]
            
            if fieldData["dataType"] == Fact.objectName:
                ofKindReference = self.getSubValueReference(Fact.ofKindUUID(), Fact.uuNameUUID())
                if ofKindReference:
                    fieldData["ofKind"] = ofKindReference[0]
                    fieldData["ofKindID"] = ofKindReference[1].hex
                v = self.getSubValue(Fact.pickObjectPathUUID())
                if v:
                    fieldData["pickObjectPath"] = v.stringValue;
        
        logger.error("  getFieldData() results: %s" % str(fieldData))
        return fieldData
    
    # Return an array where each element contains the id and description for an object that
    # is contained by self.
    def _getSubReferences(self, fieldID):
        nameLists = {}

        return [v.clientObject(nameLists) for v in self._getSubValues(fieldID)]
    
    # Returns an array of arrays.    
    def getData(self, dataObject=None):
        cells = []
        
        i = 0
        for fieldObject in self._getSubInstances(Fact.fieldUUID()):
            fieldData = fieldObject.getFieldData()
            if fieldData:
                fieldData["index"] = i
                i += 1
                cell = {"field": fieldData}                        
                if dataObject:
                    fieldID = uuid.UUID(fieldData["nameID"])
                    if fieldData["dataType"] == Fact.objectName:
                        nameLists={}
                        cell["data"] = [v.clientObject(nameLists) for v in dataObject._getSubValues(fieldID)]
                    else:
                        # Default case is that this field contains a unique value.
                        cell["data"] = [{"id": v.id.hex, "value": v.stringValue} for v in dataObject._getSubValues(fieldID)]
                
                cells.append(cell)
                
        return cells

    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, parent, transactionState):
        id = uuid.uuid4()
        i = Instance.objects.create(id=id, typeID=self.id.hex, 
                                    parentID = parent and parent.id.hex,
                                    transaction = transactionState.transaction)
        return LazyInstance(id, self.id.hex, parent and parent.id.hex, transactionState.transaction.id)
        
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
            logger = logging.getLogger(__name__)
            logger.error("   %s" % (ids))
            logger.error("   %s, %s" % (sortedIndexes, isinstance(sortedIndexes[-1], str)))
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
        
    def _addElementData(self, data, fieldData, transactionState):
        # If the data is iterable, then create a fact for each iteration of the data.
        # Otherwise, create a fact whose value is the data.
        # Note that this doesn't recur, so it can't handle arrays of dictionaries,
        # which would be the logical construction of a recursive add.
        if isinstance(data, (str, numbers.Number, datetime.date, datetime.time, datetime.timedelta)):
            raise TypeError("Element data not in an array")
        else:           
            i = 0
            ids = []
            logger = logging.getLogger(__name__)
            for d in data:
                logger.error("        Saving data:\n          %s" % str(d))
                logger.error("        Field of data:\n          %s" % str(fieldData))
                fieldID = uuid.UUID(fieldData["nameID"])
                v = d["value"]
                if isinstance(v, (str, numbers.Number, datetime.date, datetime.time, datetime.timedelta)):
                    logger.error("        Creating value object")
                    self.addValue(fieldID, v, i, transactionState)
                elif "id" in v and v["id"] is not None:
                    # This is a reference to an object.
                    logger.error("        Creating reference")
                    self.addValue(fieldID, v["id"], i, transactionState)
                elif "cells" in v and "ofKindID" in fieldData:
                    logger.error("        Creating sub-instance")
                    ofKindObject = LazyInstance(fieldData["ofKindID"])
                    ofKindObject.createInstance(self, fieldID, -1, v["cells"], transactionState)
                else:
                    raise TypeError("Unrecognized type of data to save")
                i += 1
    
    # Add the specified data as a field to self during the process of instantiating
    # self.            
    def addData(self, fieldObject, data, transactionState):        
        fieldData = fieldObject.getFieldData()
        if fieldData:
            self._addElementData(data, fieldData, transactionState)

    def createInstance(self, parent, fieldID, position, propertyList, transactionState):
        logger = logging.getLogger(__name__)
        item = self.createEmptyInstance(parent, transactionState)
    
        if parent:
            logger.error("createInstance parent: %s" % str(parent))
            logger.error("createInstance fieldID: %s" % str(LazyInstance(fieldID)))
            logger.error("createInstance position: %s" % position)
            
            if position < 0:
                maxIndex = parent.getMaxElementIndex(fieldID)
                if maxIndex == None:
                    position = 0
                else:
                    position = maxIndex + 1
            logger.error("createInstance next position: %s" % position)
            newIndex = parent.updateElementIndexes(fieldID, position, transactionState)
            newValue = parent.addValue(fieldID, item.id.hex, newIndex, transactionState)
            logger.error("  newValue: %s" % str(newValue.id))
        else:
            newValue = None
    
        logger.error("  PropertyList: %s" % str(propertyList))
        for f in propertyList:
            fieldData = f['field']
            fieldID = fieldData['id']
            fieldObject = LazyInstance(fieldID)
            item.addData(fieldObject, f['data'], transactionState)
            
        return (item, newValue)
                    
    def markAsDeleted(self, transactonState):
        DeletedInstance.objects.create(id=self.id, transaction=transactionState.transaction)

    def createConfigurations(self, itemValues, transactionState):
        return self.createMissingInstances(Fact.configurationUUID(), Fact.configurationUUID(), Fact.nameUUID(), itemValues, transactionState)
        
    def createFields(self, itemValues, transactionState):
        return self.createMissingInstances(Fact.fieldUUID(), Fact.fieldUUID(), Fact.nameUUID(), itemValues, transactionState)
    
    # items is a dictionary whose keys are the missing values and whose values start as None
    # and end with the items that represent the values.    
    # Updates the items dictionary by inserting the newly created values for the keys
    def createMissingInstances(self, fieldUUID, typeUUID, descriptorUUID, itemValues, transactionState):
        items = {}

        # See if there is an field of self which has a value that points to a name which has a value in items.
        with connection.cursor() as c:
            sql = "SELECT v2.instance_id, v2.stringvalue" + \
                  " FROM consentrecords_value v1" + \
                       " JOIN consentrecords_value v2" + \
                        " ON (v2.instance_id = v1.stringvalue AND v2.fieldid = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v2.id))" + \
                  " WHERE v1.instance_id = %s AND v1.fieldid = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [descriptorUUID.hex, 
                            self.id.hex, 
                            fieldUUID.hex,
                            ])
                            
            for i in c.fetchall():
                if i[1] in itemValues:
                    items[i[1]] = LazyInstance(i[0])

        position = self.getMaxElementIndex(fieldUUID)
        if position == None:
            position = 0
        else:
            position = position + 1
        for v in itemValues:
            if not v in items:
                ofKindObject = LazyInstance(typeUUID)
                items[v] = ofKindObject.createInstance(self, fieldUUID, position, [], transactionState)[0]
                position += 1
                items[v].addValue(descriptorUUID, v, 0, transactionState)
        
        return items
            
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
    def clientObject(self, nameLists, instance=None):
        if not instance:
            instance = LazyInstance(self.stringValue)
        typeID = instance.typeID
        if typeID in nameLists:
            nameFieldUUIDs = nameLists[typeID]
        else:
            ofKindObject = LazyInstance(typeID)
            nameFieldUUIDs = ofKindObject._descriptors
            nameLists[typeID] = nameFieldUUIDs
            
        return {'id': self.id.hex, 
                'value': {'id': self.stringValue, 'description': instance._getDescription(nameFieldUUIDs)},
                'position': self.position}
    
    def getReferenceData(self, instance, ofKindObject):
        nameFieldUUIDs = ofKindObject._descriptors
        return { "id": self.id.hex,
              "value": {"id" : self.stringValue, "description": instance._getDescription(nameFieldUUIDs), },
              "position": self.position }
            
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newStringValue, transactionState):
        if self._fieldID is None:
            self._fill()
        self.markAsDeleted(transactionState)
        LazyInstance(self.instanceID).addValue(self.fieldID, newStringValue, self.position, transactionState);
    
    # Updates the position of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateIndex(self, newIndex, transactionState):
        if self._fieldID is None:
            self._fill()
        self.markAsDeleted(transactionState)
        LazyInstance(self.instanceID).addValue(self.fieldID, self.stringValue, newIndex, transactionState);
    
    def markAsDeleted(self, transactionState):
        DeletedValue.objects.create(id=self.id, transaction=transactionState.transaction)
    
class Value(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    fieldID = dbmodels.UUIDField(db_index=True, default=uuid.uuid4, editable=False)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(LazyValue(self.id, self.instance.id, self.fieldID, self.position, self.stringValue))
    
class DeletedValue(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(LazyValue(self.id))

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
    isDescriptorName = '_is descriptor'
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
    
    
    _initialKinds = [
        configurationName,      # identifies a configuration instance (contained by a kind)
        fieldName,              # identifies a field instance (contained by a configuration)
        booleanName,            # identifies an instance of type Boolean
        nameName,               # Defines the proper name of an object.
        ofKindName,             # identifies the type of object for a field of "object" data type.
        pickObjectPathName,     # identifies the path to objects that are to be picked.
        enumeratorName,         # identifies an enumerator
        dataTypeName,           # defines the data type of a property
        maxCapacityName,        # defines the quantity relationship of a field within its container.
        addObjectRuleName, # defines the rule for adding objects to a field that supports multiple objects
        isDescriptorName,       # defines whether a field is a descriptor of its instance.
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

    _initialUUNames = {}  
        
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
            return "The term \"%s\" is not recognized" % self.uuname
            
#     @property
#     def verbString(self):
#         return UniqueObject(self.verb).getSubData(Fact.uuNameUUID()) or str(self.verb)
#             
#     @property
#     def directObjectString(self):
#         try:
#             return UniqueObject(self.directObject).objectString
#         except Exception:
#             return self.directObject
#     
#     def __str__(self):
#         return UniqueObject(self.subject).objectString + ":" + str(self.verbString) + ": " \
#             + self.directObjectString
#
    def _addEnumeratorTranslations(uuNameID, enumerationNames, transactionState):
        container = LazyInstance(uuNameID)
        enumeratorInstance = LazyInstance(Fact.enumeratorUUID())
        translationInstance = LazyInstance(Fact.translationUUID())
        englishUUID = Fact.getNamedEnumeratorID(Fact.languageUUID(), Fact.englishName)
        
        for name in enumerationNames:
            try:
                item = LazyInstance(Fact.getTranslationNamedEnumeratorID(uuNameID, name))
            except Fact.UnrecognizedNameError:
                item, value1 = enumeratorInstance.createInstance(container, Fact.enumeratorUUID(), -1, [], transactionState)
                item2, value2 = translationInstance.createInstance(item, Fact.translationUUID(), 0, [], transactionState)
                item2.addValue(Fact.textUUID().hex, name, 0, transactionState)
                item2.addValue(Fact.languageUUID().hex, englishUUID.hex, 0, transactionState)
    
    def _addEnumerators(uuNameID, enumerationNames, transactionState):
        logger = logging.getLogger(__name__)
        logger.error("_addEnumerators(%s, %s)" % (uuNameID, enumerationNames))
        
        container = LazyInstance(uuNameID)
        ofKindObject = LazyInstance(Fact.enumeratorUUID())
        
        for name in enumerationNames:
            try:
                item = LazyInstance(Fact.getNamedEnumeratorID(uuNameID, name))
            except Fact.UnrecognizedNameError:
                item, newValue = ofKindObject.createInstance(container, Fact.enumeratorUUID(), -1, [], transactionState)
                item.addValue(Fact.nameUUID(), name, 0, transactionState)
    
    def createDataTypes(transactionState):
        Fact._addEnumerators(Fact.dataTypeUUID(), [Fact.objectName, Fact.stringName, Fact.datestampName, Fact.numberName], transactionState)
        
    def createAddObjectRules(transactionState):
        Fact._addEnumerators(Fact.addObjectRuleUUID(), [Fact.pickObjectRuleName, Fact.createObjectRuleName], transactionState)
        
    def createMaxCapacities(transactionState):
        Fact._addEnumerators(Fact.maxCapacityUUID(), [Fact.uniqueValueName, Fact.multipleValuesName], transactionState)
        
    def createLanguages(transactionState):
        Fact._addEnumerators(Fact.languageUUID(), [Fact.englishName], transactionState)
    
    def createBooleans(transactionState):
        Fact._addEnumeratorTranslations(Fact.booleanUUID(), [Fact.yesName, Fact.noName], transactionState)
    
    def createEnumerationConfiguration(uunameID, fieldID, transactionState):
        container = LazyInstance(uunameID)
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

        fieldValues = [fieldID.hex]
        
        fields = configObject.createFields(fieldValues, transactionState)
        p = fields[fieldID.hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
    
    def createTranslationConfiguration(transactionState):
        container = LazyInstance(Fact.translationUUID())
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

        fieldValues = [Fact.textUUID().hex, Fact.languageUUID().hex]
        
        fields = configObject.createFields(fieldValues, transactionState)
        p = fields[Fact.textUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
    
        p = fields[Fact.languageUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), Fact.languageUUID().hex, 0, transactionState)
        pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.languageName, Fact.enumeratorName)
        p.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
    
    def createEnumeratorConfiguration(transactionState):
        container = LazyInstance(Fact.enumeratorUUID())
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

        fieldValues = [Fact.nameUUID().hex, Fact.translationUUID().hex]
        
        fields = configObject.createFields(fieldValues, transactionState)
        p = fields[Fact.nameUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
    
        p = fields[Fact.translationUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), Fact.translationUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
    
    def createBooleanConfiguration(transactionState):
        container = LazyInstance(Fact.booleanUUID())
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

        fieldValues = [Fact.nameUUID().hex]
        
        fields = configObject.createFields(fieldValues, transactionState)
    
        p = fields[Fact.nameUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), Fact.translationUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
    
    # Create the configuration for the uuname uuname.
    def createUUNameConfiguration(transactionState):
        uunameUUID = Fact.uuNameUUID()
        container = LazyInstance(uunameUUID)
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configurationUUID = Fact.configurationUUID()
            
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

        fieldValues = [uunameUUID.hex, configurationUUID.hex, Fact.enumeratorUUID().hex]

        fields = configObject.createFields(fieldValues, transactionState)
        
        p = fields[uunameUUID.hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
        
        p = fields[configurationUUID.hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), configurationUUID.hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
            
        p = fields[Fact.enumeratorUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), Fact.enumeratorUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
            
    # Create the configuration for the configuration uuname.    
    def createConfigurationConfiguration(transactionState):
        configurationUUID = Fact.configurationUUID()
        container = LazyInstance(configurationUUID)
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
                
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)
        
        fieldValues = [Fact.nameUUID().hex, Fact.fieldUUID().hex]

        fields = configObject.createFields(fieldValues, transactionState)
        
        p = fields[Fact.nameUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
        
        p = fields[Fact.fieldUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), Fact.fieldUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
        
    # Create the configuration for the configuration uuname.    
    def createFieldConfiguration(transactionState):
        containerUUID = Fact.fieldUUID()
        container = LazyInstance(containerUUID)
        configurationUUID = Fact.configurationUUID()
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)
        
        fieldValues = [Fact.nameUUID().hex, 
                       Fact.dataTypeUUID().hex,
                       Fact.maxCapacityUUID().hex,
                       Fact.isDescriptorUUID().hex,
                       Fact.addObjectRuleUUID().hex,
                       Fact.ofKindUUID().hex,
                       Fact.pickObjectPathUUID().hex,
                      ]

        fields = configObject.createFields(fieldValues, transactionState)
        
        f = fields[Fact.nameUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
        
        f = fields[Fact.dataTypeUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.dataTypeName, Fact.enumeratorName)
        f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
        
        f = fields[Fact.maxCapacityUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.maxCapacityName, Fact.enumeratorName)
        f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
        
        f = fields[Fact.isDescriptorUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.booleanName, Fact.enumeratorName)
        f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
        
        f = fields[Fact.addObjectRuleUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.addObjectRuleName, Fact.enumeratorName)
        f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
        
        f = fields[Fact.ofKindUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)        
        f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)

        f = fields[Fact.pickObjectPathUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        
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
        Instance.objects.create(id=uunameID.hex, typeID=uunameID.hex, parentID=None, transaction=transactionState.transaction)
        LazyInstance(uunameID).addValue(uunameID, Fact.uuNameName, 0, transactionState)
        return uunameID
       
    def initializeFacts(transactionState):
        
        # Initialize global variables.
        Fact._initialUUNames = {}  
        
        #Instantiate the uuName uuName.
        uunameID = Fact.getUUNameID() or Fact.createUUNameID(transactionState)
        
        # Instantiate all of the other core uuNames.
        for s in Fact._initialKinds:
            try: 
                id = Fact.getNamedUUID(s, transactionState)
            except Fact.UnrecognizedNameError:
                obj = uuid.uuid4()
                i = Instance.objects.create(id=obj.hex, typeID=uunameID.hex, parentID=None, transaction=transactionState.transaction)
                LazyInstance(obj).addValue(uunameID, s, 0, transactionState)
        
        Fact.createDataTypes(transactionState)
        Fact.createAddObjectRules(transactionState)
        Fact.createMaxCapacities(transactionState)
        Fact.createLanguages(transactionState)
        Fact.createBooleans(transactionState)
        Fact.createTranslationConfiguration(transactionState)
        Fact.createEnumeratorConfiguration(transactionState)
        Fact.createBooleanConfiguration(transactionState)
        Fact.createUUNameConfiguration(transactionState)
        Fact.createConfigurationConfiguration(transactionState)
        Fact.createFieldConfiguration(transactionState)
                
    # Return the UUID for the 'uuname' instance. 
    def uuNameUUID():
        name = Fact.uuNameName
        if name not in Fact._initialUUNames:
            with connection.cursor() as c:
                sql = "SELECT v1.instance_id" + \
                      " FROM consentrecords_value v1" + \
                      " WHERE v1.fieldid = v1.instance_id AND v1.stringvalue = %s" + \
                      " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
                c.execute(sql, [Fact.uuNameName])
                i = c.fetchone();
                Fact._initialUUNames[name] = uuid.UUID(i[0])
        
        return Fact._initialUUNames[name]
    
    def _getInitialUUID(name):
        if name not in Fact._initialUUNames:
            try:
                Fact._initialUUNames[name] = Value.objects.get(stringValue=name, fieldID=Fact.uuNameUUID().hex).instance.id
            except Value.DoesNotExist:
                raise Fact.UnrecognizedNameError(name)
                
            if isinstance(Fact._initialUUNames[name], str):
                Fact._initialUUNames[name] = uuid.UUID(Fact._initialUUNames[name])
                
        return Fact._initialUUNames[name]

    def _getObjectUUID(typeID, name):
        if name not in Fact._initialUUNames:
            Fact._initialUUNames[name] = Fact.getNamedEnumeratorID(typeID, name)
            if isinstance(Fact._initialUUNames[name], str):
                Fact._initialUUNames[name] = uuid.UUID(Fact._initialUUNames[name])
                
        return Fact._initialUUNames[name]

    def _getTranslationObjectUUID(typeID, name):
        if name not in Fact._initialUUNames:
            Fact._initialUUNames[name] = Fact.getTranslationNamedEnumeratorID(typeID, name)
            if isinstance(Fact._initialUUNames[name], str):
                Fact._initialUUNames[name] = uuid.UUID(Fact._initialUUNames[name])
                
        return Fact._initialUUNames[name]

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

    def isDescriptorUUID(): return Fact._getInitialUUID(Fact.isDescriptorName)
    
    def yesUUID():
        return Fact._getTranslationObjectUUID(Fact.booleanUUID(), Fact.yesName)
    def noUUID():
        return Fact._getTranslationObjectUUID(Fact.booleanUUID(), Fact.multipleValuesName)

    def languageUUID(): return Fact._getInitialUUID(Fact.languageName)
    def translationUUID(): return Fact._getInitialUUID(Fact.translationName)
    def textUUID(): return Fact._getInitialUUID(Fact.textName)
        
    # Return the UUID for the specified Ontology object. If it doesn't exist, it is created with the specified transaction.   
    def getNamedUUID(uuname, transactionState=None):
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
            
    # Return the UUID for the specified Ontology object. If it doesn't exist, it is created with the specified transaction.   
    def getNamedEnumeratorID(uunameID, stringValue):
        logger = logging.getLogger(__name__)
        logger.error("getNamedEnumeratorID(%s, %s)" % (uunameID, stringValue))
        logger.error("  enumeratorUUID: %s" % Fact.enumeratorUUID())
        logger.error("  nameUUID: %s" % Fact.nameUUID())
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
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, it is created with the specified transaction.   
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
        
    def markAsDeleted(self, transactionState):
        DeletedFact.objects.create(fact=self, transaction=transactionState.transaction)
