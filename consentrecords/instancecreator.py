from django.db import connection

import logging
import datetime
import numbers
import uuid

from consentrecords.models import LazyInstance, Fact
from consentrecords import pathparser

def _addElementData(parent, data, fieldData, transactionState):
    # If the data is iterable, then create a fact for each iteration of the data.
    # Otherwise, create a fact whose value is the data.
    # Note that this doesn't recur, so it can't handle arrays of dictionaries,
    # which would be the logical construction of a recursive add.
    if not isinstance(data, list):
        raise ValueError("Data to add is not in a list")
    else:           
        i = 0
        ids = []
        for d in data:
            if not isinstance(d, dict):
                raise ValueError("Item to add is not a dictionary with a value")
            if "value" not in d or not d["value"]:
                raise ValueError("Item to add does not contain a non-null value")

            fieldID = uuid.UUID(fieldData["nameID"])
            v = d["value"]
            if isinstance(v, (str, numbers.Number, datetime.date, datetime.time, datetime.timedelta)):
                parent.addValue(fieldID, v, i, transactionState)
            elif "id" in v and v["id"] is not None:
                # This is a reference to an object.
                parent.addValue(fieldID, v["id"], i, transactionState)
            elif "path" in v and v["path"] is not None:
                a = pathparser.tokenize(v["path"])
                ids = pathparser.selectAllIDs(a)
                if len(ids):
                    logger = logging.getLogger(__name__)
                    logger.error("id: %s" % len(ids[0]))
                    parent.addValue(fieldID, ids[0][-1], i, transactionState)
                else:
                    raise ValueError("Path does not parse to an object: %s" % v["path"])
            elif "cells" in v and "ofKindID" in fieldData:
                ofKindObject = LazyInstance(fieldData["ofKindID"])
                createInstance(ofKindObject, parent, fieldID, -1, v["cells"], transactionState)
            else:
                raise ValueError("Unrecognized type of data to save")
            i += 1

# Add the specified data as a field to parent during the process of instantiating
# parent.            
def addData(parent, fieldObject, data, transactionState):
    fieldData = fieldObject.getFieldData()
    if fieldData:
        _addElementData(parent, data, fieldData, transactionState)

def createInstance(typeInstance, parent, parentFieldID, position, propertyList, transactionState):
    logger = logging.getLogger(__name__)
    logger.error("typeInstance: %s" % typeInstance._description)
    item = typeInstance.createEmptyInstance(parent, transactionState)

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

    configuration = None
    for f in propertyList:
        logger.error("field: %s" % str(f))
        if 'field' not in f:
            raise ValueError('instance data element missing field key');
        if 'data' not in f:
            raise ValueError('instance data element missing data key');
        fieldData = f['field']
        if 'id' in fieldData:
            fieldID = fieldData['id']
            fieldObject = LazyInstance(fieldID)
        elif 'name' in fieldData:
            if not configuration:
                configuration = typeInstance.getSubInstance(fieldID=Fact.configurationUUID())
            logger.error(configuration.id.hex)
            name = fieldData['name']
            id = Fact.getFieldNamedID(configuration.id, name)
            logger.error(id)
            fieldObject = LazyInstance(id)
        else:
            raise ValueError('field data element missing id key');
        addData(item, fieldObject, f['data'], transactionState)
        
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

    position = parent.getMaxElementIndex(fieldUUID)
    if position == None:
        position = 0
    else:
        position = position + 1
    for v in itemValues:
        if not v in items:
            ofKindObject = LazyInstance(typeUUID)
            items[v] = createInstance(ofKindObject, parent, fieldUUID, position, [], transactionState)[0]
            position += 1
            items[v].addValue(descriptorUUID, v, 0, transactionState)
    
    return items
        
