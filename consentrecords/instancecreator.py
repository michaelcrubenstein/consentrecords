from django.db import connection

import logging
import datetime
import numbers
import uuid

from consentrecords.models import Instance, Value, Terms, NameList
from consentrecords import pathparser

def _addElementData(parent, data, fieldData, nameLists, transactionState):
    # If the data is not a list, then treat it as a list of one item.
    if not isinstance(data, list):
        data = [data]

    i = 0
    ids = []
    field = Instance.objects.get(pk=fieldData["nameID"])
    for d in data:
        if fieldData["dataTypeID"] == Terms.objectEnum.id:
            if "objectAddRule" in fieldData and fieldData["objectAddRule"] == "_pick one":
                if Terms.isUUID(d):
                    # This is a reference to an object.
                    parent.addReferenceValue(field, Instance.objects.get(pk=d), i, transactionState)
                elif d is not None:
                    a = pathparser.tokenize(d)
                    ids = pathparser.selectAllObjects(a)
                    if len(ids):
                        parent.addReferenceValue(field, ids[-1], i, transactionState)
                    else:
                        raise ValueError("Path does not parse to an object: %s" % d)
            else:
                if isinstance(d, dict) and "ofKindID" in fieldData:
                    ofKindObject = Instance.objects.get(pk=fieldData["ofKindID"])
                    newItem, newValue = create(ofKindObject, parent, field, -1, d, nameLists, transactionState)
                else:
                    raise ValueError("Unrecognized type of data to save: %s" % str(d))
        else:
            parent.addValue(field, d, i, transactionState)
        i += 1

def create(typeInstance, parent, parentFieldID, position, propertyList, nameLists, transactionState):
#     logger = logging.getLogger(__name__)
#     logger.error("typeInstance: %s" % typeInstance._description)
#     logger.error("propertyList: %s" % str(propertyList))
    if not typeInstance:
        raise ValueError("typeInstance is null")
        
    item = typeInstance.createEmptyInstance(parent, transactionState)

    if parent:
        if position < 0:
            maxIndex = parent.getMaxElementIndex(parentFieldID)
            if maxIndex == None:
                position = 0
            else:
                position = maxIndex + 1
        newIndex = parent.updateElementIndexes(parentFieldID, position, transactionState)
        newValue = parent.addReferenceValue(parentFieldID, item, newIndex, transactionState)
        item.parentValue = newValue
        item.save()
    else:
        newValue = None

    if propertyList:
        configuration = None
        if isinstance(propertyList, dict):
            for key in propertyList:
                data = propertyList[key]
                if Terms.isUUID(key):
                    fieldObject = Instance.objects.get(pk=key)
                else:
                    if not configuration:
                        configuration = typeInstance.getSubInstance(Terms.configuration)
                    fieldObject = configuration.getFieldByName(key)
                fieldData = fieldObject.getFieldData()
                if fieldData:
                    _addElementData(item, data, fieldData, nameLists, transactionState)
        else:
            raise ValueError('initial data is not a dictionary: %s' % str(propertyList))
    
    item.cacheDescription(nameLists)    
    return (item, newValue)
                
# itemValues is a dictionary whose keys are the values to be found.
def createMissingInstances(parent, field, type, descriptor, itemValues, transactionState):
    items = {}

    # See if there is an field of parent which has a value that points to a name which has a value in items.
    vs = Value.objects.filter(fieldID=descriptor, deletedvalue__isnull=True)\
            .filter(instance__parent=parent)
            
    # See if there is an field of parent which has a value that points to a name which has a value in items.
    vs = Value.objects.filter(fieldID=descriptor, deletedvalue__isnull=True)\
            .filter(instance__parent=parent,instance__referenceValues__fieldID=field)
            
    for v in vs:
        if v.stringValue in itemValues:
            items[v.stringValue] = v.instance
        elif v.referenceValue in itemValues:
        	items[v.referenceValue] = v.instance
            
    position = parent.getMaxElementIndex(field)
    if position == None:
        position = 0
    else:
        position = position + 1
        
    nameLists = NameList()
    
    for s in itemValues:
        if not s in items:
            items[s] = create(type, parent, field, position, [], nameLists, transactionState)[0]
            position += 1
            items[s].addValue(descriptor, s, 0, transactionState)
    
    return items
        
