from django.db import connection

import logging
import datetime
import numbers
import uuid

from consentrecords.models import Instance, Value, Terms, TermNames, NameList, AccessRecord, UserInfo
from consentrecords import pathparser

def _addElementData(parent, data, fieldData, nameLists, transactionState):
    # If the data is not a list, then treat it as a list of one item.
    if not isinstance(data, list):
        data = [data]

    i = 0
    ids = []
    field = Instance.objects.get(pk=fieldData["nameID"])
    userInfo=UserInfo(transactionState.user)
    for d in data:
        if fieldData["dataTypeID"] == Terms.objectEnum.id:
            if "objectAddRule" in fieldData and fieldData["objectAddRule"] == "_pick one":
                if Terms.isUUID(d):
                    # This is a reference to an object.
                    values = list(userInfo.findFilter(Instance.objects.filter(pk=d)))
                    if len(values):
                        parent.addReferenceValue(field, values[0], i, transactionState)
                    elif d == parent.id and field == Terms.primaryAdministrator:
                        # This is a special case of setting up the primary administrator. This
                        # is necessary when creating a user so that it can be bootstrapped.
                        parent.addReferenceValue(field, parent, i, transactionState)
                    else:
                        raise RuntimeError("find permission failed for %s" % field)
                elif d is not None:
                    ids = pathparser.selectAllObjects(d, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(ids):
                        parent.addReferenceValue(field, ids[-1], i, transactionState)
                    else:
                        raise RuntimeError("Path does not parse to an object: %s" % d)
            else:
                if isinstance(d, dict) and "ofKindID" in fieldData:
                    ofKindObject = Instance.objects.get(pk=fieldData["ofKindID"])
                    create(ofKindObject, parent, field, -1, d, nameLists, transactionState)
                else:
                    raise RuntimeError("%s field of type %s not configured to contain data: %s" % (field, parent.typeID, str(d)))
        else:
            parent.addValue(field, d, i, transactionState)
        i += 1

def create(typeInstance, parent, parentField, position, propertyList, nameLists, transactionState):
#     logger = logging.getLogger(__name__)
#     logger.error("typeInstance: %s" % typeInstance._description)
#     logger.error("propertyList: %s" % str(propertyList))
    if not typeInstance:
        raise ValueError("typeInstance is null")
                
    item = typeInstance.createEmptyInstance(parent, transactionState)

    # If the item being created is a user, then we have to set the primary administrator
    # of the user to itself so that the user has a primary administrator. Otherwise, we can't
    # add values to the user.
    if typeInstance==Terms.user:
        if TermNames.primaryAdministrator not in propertyList:
            propertyList[TermNames.primaryAdministrator] = item.id
    elif parent:
        parent.checkWriteAccess(transactionState.user, parentField)
    else:
        if not transactionState.user.is_staff:
            raise RuntimeError("write permission failed")
        
    if parent:
        if position < 0:
            position = parent.getNextElementIndex(parentField)
        newIndex = parent.updateElementIndexes(parentField, position, transactionState)
        newValue = parent.addReferenceValue(parentField, item, newIndex, transactionState)
        item.parentValue = newValue
        item.save()
    else:
        newValue = None
        
    # Process the access records for this new item.
    if typeInstance.defaultCustomAccess:
        AccessRecord.objects.create(id=item, source=item)
    else:
        try:
            parentAccessRecord = AccessRecord.objects.get(id=parent)
            AccessRecord.objects.create(id=item, source=parentAccessRecord.source)
        except AccessRecord.DoesNotExist:
            pass

    if propertyList:
        configuration = None
        if isinstance(propertyList, dict):
            for key in propertyList:
                data = propertyList[key]
                if not configuration:
                    configuration = typeInstance.getSubInstance(Terms.configuration)
                if Terms.isUUID(key):
                    # The key may be the key of a field object or the key of a term that is 
                    # the name of a field object in the configuration.
                    fieldObject = Instance.objects.get(pk=key)
                    if fieldObject.typeID != Terms.field:
                        fieldObject = configuration.getFieldByReferenceValue(key)
                    elif fieldObject.parent != configuration:
                        raise RuntimeError("the specified field is not contained within the configuration of this type")
                else:
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
    vs = Value.objects.filter(field=descriptor, deleteTransaction__isnull=True)\
            .filter(instance__parent=parent)
            
    # See if there is an field of parent which has a value that points to a name which has a value in items.
    vs = Value.objects.filter(field=descriptor, deleteTransaction__isnull=True)\
            .filter(instance__parent=parent,instance__referenceValues__field=field)
            
    for v in vs:
        if v.stringValue in itemValues:
            items[v.stringValue] = v.instance
        elif v.referenceValue in itemValues:
            items[v.referenceValue] = v.instance
            
    position = parent.getNextElementIndex(field)
        
    nameLists = NameList()
    
    for s in itemValues:
        if not s in items:
            items[s] = create(type, parent, field, position, [], nameLists, transactionState)[0]
            position += 1
            items[s].addValue(descriptor, s, 0, transactionState)
    
    return items
        
def addUniqueChild(parent, field, typeID, propertyList, nameList, transactionState):
    children = parent.value_set.filter(field=field,
                                    deleteTransaction__isnull=True)
    if len(children):
        return children[0].referenceValue
    else:
        item, newValue = create(typeID, parent, field, -1, propertyList, nameList, transactionState)
        return item

def addNamedChild(parent, field, type, nameField, fieldData, name, nameList, transactionState):
    children = parent.getChildrenByName(field, nameField, name)
    if len(children):
        return children[0].referenceValue
    else:
        if fieldData['nameID'] != nameField.id:
            raise RuntimeError('Mismatch: %s/%s' % (fieldData['nameID'], nameField.id))
        if fieldData['dataType'] == '_translation':
            propertyList = {nameField.id: [{'text': name, 'languageCode': 'en'}]}
        else:
            propertyList = {nameField.id: name}
        child, newValue = create(type, parent, field, -1, propertyList, nameList, transactionState)
        return child

