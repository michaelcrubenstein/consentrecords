from django.db import connection

import logging
import datetime
import numbers
import uuid

from consentrecords.models import LazyInstance, Fact, NameList
from consentrecords import pathparser

def _addElementData(parent, data, fieldData, nameLists, transactionState):
    # If the data is not a list, then treat it as a list of one item.
    if not isinstance(data, list):
        data = [data]

    i = 0
    ids = []
    for d in data:
        fieldID = uuid.UUID(fieldData["nameID"])
        if fieldData["dataTypeID"] == Fact.objectUUID().hex:
            if "objectAddRule" in fieldData and fieldData["objectAddRule"] == "_pick one":
                if Fact.isUUID(d) is not None:
                    # This is a reference to an object.
                    parent.addValue(fieldID, d, i, transactionState)
                elif d is not None:
                    a = pathparser.tokenize(d)
                    ids = pathparser.selectAllIDs(a)
                    if len(ids):
                        parent.addValue(fieldID, ids[0][-1], i, transactionState)
                    else:
                        raise ValueError("Path does not parse to an object: %s" % d)
            else:
                if isinstance(d, dict) and "ofKindID" in fieldData:
                    ofKindObject = LazyInstance(fieldData["ofKindID"])
                    newItem, newValue = create(ofKindObject, parent, fieldID, -1, d, nameLists, transactionState)
                else:
                    raise ValueError("Unrecognized type of data to save")
        else:
            parent.addValue(fieldID, d, i, transactionState)
        i += 1

def create(typeInstance, parent, parentFieldID, position, propertyList, nameLists, transactionState):
#     logger = logging.getLogger(__name__)
#     logger.error("typeInstance: %s" % typeInstance._description)
#     logger.error("propertyList: %s" % str(propertyList))
    item = typeInstance.instance.createEmptyInstance(parent.instance, transactionState).lazyInstance

    if parent:
        if position < 0:
            maxIndex = parent.getMaxElementIndex(parentFieldID)
            if maxIndex == None:
                position = 0
            else:
                position = maxIndex + 1
        newIndex = parent.updateElementIndexes(parentFieldID, position, transactionState)
        newValue = parent.addValue(parentFieldID, item.id.hex, newIndex, transactionState)
    else:
        newValue = None

    if propertyList:
        configuration = None
        if isinstance(propertyList, dict):
            for key in propertyList:
                data = propertyList[key]
                if Fact.isUUID(key):
                    fieldObject = LazyInstance(key)
                else:
                    if not configuration:
                        configuration = typeInstance.getSubInstance(fieldID=Fact.configurationUUID())
                    id = Fact.getFieldNamedID(configuration.id, key)
                    fieldObject = LazyInstance(id)
                fieldData = fieldObject.getFieldData()
                if fieldData:
                    _addElementData(item, data, fieldData, nameLists, transactionState)
        else:
            raise ValueError('initial data is not a dictionary: %s' % str(propertyList))
    
    item.cacheDescription(nameLists)    
    return (item, newValue)
                
def createConfigurations(parent, itemValues, transactionState):
    return createMissingInstances(parent, Fact.configurationUUID(), Fact.configurationUUID(), Fact.nameUUID(), itemValues, transactionState)
    
def createFields(self, itemValues, transactionState):
    return createMissingInstances(parent, Fact.fieldUUID(), Fact.fieldUUID(), Fact.nameUUID(), itemValues, transactionState)

# items is a dictionary whose keys are the missing values and whose values start as None
# and end with the items that represent the values.    
# Updates the items dictionary by inserting the newly created values for the keys
def createMissingInstances(parent, fieldUUID, typeUUID, descriptorUUID, itemValues, transactionState):
    items = {}

    # See if there is an field of parent which has a value that points to a name which has a value in items.
    with connection.cursor() as c:
        sql = "SELECT v2.instance_id, v2.stringvalue" + \
              " FROM consentrecords_value v1" + \
                   " JOIN consentrecords_value v2" + \
                    " ON (v2.instance_id = v1.stringvalue AND v2.fieldid = %s" + \
                    " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v2.id))" + \
              " WHERE v1.instance_id = %s AND v1.fieldid = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
        c.execute(sql, [descriptorUUID.hex, 
                        parent.id.hex, 
                        fieldUUID.hex,
                        ])
                        
        for i in c.fetchall():
            if i[1] in itemValues:
                items[i[1]] = LazyInstance(i[0])

    ofKindObject = LazyInstance(typeUUID)
    position = parent.getMaxElementIndex(fieldUUID)
    if position == None:
        position = 0
    else:
        position = position + 1
        
    nameLists = NameList()
    
    for v in itemValues:
        if not v in items:
            items[v] = create(ofKindObject, parent, fieldUUID, position, [], nameLists, transactionState)[0]
            position += 1
            items[v].addValue(descriptorUUID, v, 0, transactionState)
    
    return items
        
