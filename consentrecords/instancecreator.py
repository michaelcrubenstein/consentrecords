from django.db import connection

import logging
import datetime
import numbers
import uuid

from consentrecords.models import *
from consentrecords import pathparser

def _addElementData(parent, data, fieldData, nameLists, userInfo, transactionState, check):
    # If the data is not a list, then treat it as a list of one item.
    if not isinstance(data, list):
        data = [data]

    i = 0
    ids = []
    field = Instance.objects.get(pk=fieldData["nameID"])
    for d in data:
        if not isinstance(d, dict):
            raise RuntimeError("%s field of type %s is not a dictionary: %s" % (field, parent.typeID, str(d)))
            
        if fieldData["dataTypeID"] == terms.objectEnum.idString:
            if "objectAddRule" in fieldData and fieldData["objectAddRule"] == TermNames.pickObjectRuleEnum:
                if "instanceID" in d:
                    # This is a reference to an object.
                    if not terms.isUUID(d["instanceID"]):
                        raise RuntimeError("value(%s) for %s field is not an instance ID" % (d["instanceID"], field))
                        
                    values = list(userInfo.findFilter(InstanceQuerySet(Instance.objects.filter(pk=d["instanceID"]))))
                    if len(values):
                        parent.addReferenceValue(field, values[0], i, transactionState)
                    elif d["instanceID"] == parent.idString and field == terms.primaryAdministrator:
                        # This is a special case of setting up the primary administrator. This
                        # is necessary when creating a user so that it can be bootstrapped.
                        parent.addReferenceValue(field, parent, i, transactionState)
                    else:
                        raise RuntimeError("find permission failed for %s" % field)
                elif "path" in d:
                    ids = pathparser.getQuerySet(d["path"], userInfo=userInfo)
                    if len(ids):
                        parent.addReferenceValue(field, ids[len(ids)-1], i, transactionState)
                    else:
                        raise RuntimeError("Path does not parse to an object: %s" % d["path"])
                else:
                    raise RuntimeError("%s field of type %s contains neither instanceID nor path: %s" % (field, parent.typeID, str(d)))
            else:
                if "ofKindID" not in fieldData:
                    raise RuntimeError("%s field of type %s not configured with an object kind" % (field, parent.typeID))
                elif "cells" in d:
                    ofKindObject = Instance.objects.get(pk=fieldData["ofKindID"])
                    create(ofKindObject, parent, field, -1, d["cells"], nameLists, userInfo, transactionState, check)
                else:
                    raise RuntimeError("%s field of type %s missing data: %s" % (field, parent.typeID, str(d)))
        else:
            parent.addValue(field, d, i, userInfo, transactionState)
        i += 1

### Ensure that the current user has permission to perform this operation.
def checkCreateAccess(typeInstance, parent, parentField, userInfo):
    if typeInstance == terms.user:
        return
    elif parent:
        parent.checkWriteAccess(userInfo, parentField)
    else:
        if not userInfo.is_administrator:
            raise RuntimeError("write permission failed")

### Ensure that the current user has permission to perform this operation.
def checkCreateCommentAccess(typeInstance, parent, parentField, userInfo):
    if typeInstance in [terms['Comments'], terms['Comment'], terms['Comment Request']]:
        return
    elif parentField == terms['Comments']:
        return
    elif parent:
        parent.checkWriteAccess(userInfo, parentField)
    else:
        if not userInfo.is_administrator:
            raise RuntimeError("write permission failed")

### Ensure that the current user has permission to perform this operation.
def checkCreateNotificationAccess(typeInstance, parent, parentField, userInfo):
    if typeInstance in [terms['notification']] and parentField == terms['notification']:
    	if parent.getPrivilege(userInfo):
    	    return
    	else:
    	    raise RuntimeError("the user or group is unrecognized")
    elif parent:
        parent.checkWriteAccess(userInfo, parentField)
    else:
        if not userInfo.is_administrator:
            raise RuntimeError("write permission failed")

def create(typeInstance, parent, parentField, position, propertyList, nameLists, userInfo, transactionState, check=checkCreateAccess):
#     logger = logging.getLogger(__name__)
#     logger.error("typeInstance: %s" % typeInstance._description)
#     logger.error("propertyList: %s" % str(propertyList))
    if not typeInstance:
        raise ValueError("typeInstance is null")
    elif not isinstance(typeInstance, Instance):
        raise ValueError("typeInstance is not an instance: %s" % typeInstance)
    if parent and not parentField:
        raise ValueError("parent is specified but parentField is not")
    if parent and parentField:
        configuration = parent.typeID.getSubInstance(terms.configuration)
        fieldObject = configuration.getFieldByReferenceValue(parentField.id)
        fieldData = fieldObject.getFieldData()
        if "objectAddRule" in fieldData and fieldData["objectAddRule"] == TermNames.pickObjectRuleEnum:
            raise ValueError("instances can not be created in parents with a pick one field")
    
    check(typeInstance, parent, parentField, userInfo)
                
    item = typeInstance.createEmptyInstance(parent, transactionState)

    # If the item being created is a user, then we have to set the primary administrator
    # of the user to itself so that the user has a primary administrator. Otherwise, we can't
    # add values to the user.
    if typeInstance==terms.user:
        if TermNames.primaryAdministrator not in propertyList:
            propertyList[TermNames.primaryAdministrator] = {"instanceID": item.idString}
        # Add userID explicitly in case it isn't part of the configuration.
        userID = transactionState.user.id.hex
        item.addStringValue(terms[TermNames.userID], userID, 0, transactionState)
        # Set up the userInfo explicitly if it isn't already set up.
        if not userInfo.instance:
            userInfo.instance = item
        
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
        item.accessSource = item
        item.save()
    elif parent:
        item.accessSource = parent.accessSource
        item.save()

    # propertyList should be either null or a dictionary of properties.
    # The key of each element in the dictionary is the name of a term which is the fieldID.
    #    If the key is not a field in the configuration, then it is ignored.
    # The value is an array.
    #    Each element of the value array is a dictionary that has one item in the field.
    #    The dictionary can have the following elements:
    #        "instanceID": The value should be a hex string for a GUID.
    #        "path": The value should be a path to an object.
    #        "cells": A dictionary which matches a dictionary of properties passed to a recursive call to instancecreator.create.
    #        "text" and "languageCode": the text and language code for a translation.
    #        "text": the text of a string element.
    if propertyList:
        if isinstance(propertyList, dict):
            if len(propertyList) > 0:
                configuration = typeInstance.getSubInstance(terms.configuration)
            
                # Handle security fields before all other fields so that children have the
                # correct security.
                for key in filter(lambda key: terms[key] in terms.securityFields, propertyList):
                    fieldData = configuration.getFieldDataByName(key) 
                    if fieldData:
                        _addElementData(item, propertyList[key], fieldData, nameLists, userInfo, transactionState, check)
                
                for key in filter(lambda key: terms[key] not in terms.securityFields, propertyList):
                    fieldData = configuration.getFieldDataByName(key) 
                    if fieldData:
                        _addElementData(item, propertyList[key], fieldData, nameLists, userInfo, transactionState, check)
        else:
            raise ValueError('initial data is not a dictionary: %s' % str(propertyList))
    
    item.cacheDescription(nameLists)    
    return (item, newValue)
                
# itemValues is a dictionary whose keys are the values to be found.
def createMissingInstances(parent, field, type, descriptor, itemValues, userInfo, transactionState):
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
            items[s] = create(type, parent, field, position, [], nameLists, userInfo, transactionState)[0]
            position += 1
            items[s].addValue(descriptor, {"text": s}, 0, userInfo, transactionState)
    
    return items
        
def addUniqueChild(parent, field, typeID, propertyList, nameList, userInfo, transactionState):
    children = parent.value_set.filter(field=field,
                                    deleteTransaction__isnull=True)
    if len(children):
        return children[0].referenceValue
    else:
        item, newValue = create(typeID, parent, field, -1, propertyList, nameList, userInfo, transactionState)
        return item

def addNamedChild(parent, field, type, nameField, fieldData, text, languageCode, nameList, userInfo, transactionState):
    children = parent.getChildrenByName(field, nameField, text)
    if len(children):
        return children[0].referenceValue
    else:
        if fieldData['nameID'] != nameField.idString:
            raise RuntimeError('Mismatch: %s/%s' % (fieldData['nameID'], nameField.idString))
        if fieldData['dataType'] == TermNames.translationEnum:
            propertyList = {nameField.idString: [{'text': text, 'languageCode': languageCode}]}
        else:
            propertyList = {nameField.idString: [{'text': text}]}
        child, newValue = create(type, parent, field, -1, propertyList, nameList, userInfo, transactionState)
        return child

def addNamedByReferenceChild(parent, field, type, nameField, fieldData, referenceValue, nameList, userInfo, transactionState):
    children = parent.getChildrenByReferenceName(field, nameField, referenceValue)
    if len(children):
        return children[0].referenceValue
    else:
        if fieldData['nameID'] != nameField.idString:
            raise RuntimeError('Mismatch: %s/%s' % (fieldData['nameID'], nameField.idString))
        propertyList = {nameField.idString: [{'instanceID': referenceValue.idString}]}
        child, newValue = create(type, parent, field, -1, propertyList, nameList, userInfo, transactionState)
        return child

