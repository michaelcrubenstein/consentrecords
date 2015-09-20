from django.conf import settings
from django.db import transaction
from django.http import HttpResponse, JsonResponse, Http404
from django.shortcuts import render, redirect
from django.template import RequestContext, loader

from pathlib import Path
import os
import json
import logging
import traceback
import uuid

from monitor.models import LogRecord
from consentrecords.models import TransactionState, Fact, UniqueObject

def home(request):
    if request.user.is_authenticated():
        return userHome(request)
    else:
        return anonymousHome(request)

def anonymousHome(request):
    LogRecord.emit(request.user, 'consentrecords/anonymousHome', '')
    
    template = loader.get_template('consentrecords/anonymousHome.html')
    context = RequestContext(request, {
    })
        
    return HttpResponse(template.render(context))

def userHome(request):
    LogRecord.emit(request.user, 'consentrecords/userHome', '')
    
    template = loader.get_template('consentrecords/userHome.html')
    context = RequestContext(request, {
        'user': request.user,
        'backURL': '/',
    })
        
    return HttpResponse(template.render(context))

def initializeFacts(request):
    LogRecord.emit(request.user, 'consentrecords/initializeFacts', '')

    if not request.user.is_authenticated:
        return signin(request)
    
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    try:
        if request.method == "POST":
            timezoneoffset = request.POST['timezoneoffset']
        elif request.method == "GET":
            timezoneoffset = request.GET['timezoneoffset']
        
        with transaction.atomic():    
            transactionState = TransactionState(request.user, timezoneoffset)
            Fact.initializeFacts(transactionState) 
        results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)

def configuration(request):
    LogRecord.emit(request.user, 'consentrecords/configuration', '')
    
    # The type of the root object.
    rootType = request.GET.get('type', "_uuname")
    elementType = request.GET.get('elementType', rootType)
        
    template = loader.get_template('consentrecords/configuration.html')
    
    context = RequestContext(request, {
        'user': request.user,
        'canShowObjects': request.user.is_superuser,
        'canAddObject': request.user.is_superuser,
        'rootType': rootType,
        'elementType': elementType
    })
        
    return HttpResponse(template.render(context))
    
# Handle a POST event to create a new instance of an object with a set of properties.
def submitCreateInstance(request):
    
    LogRecord.emit(request.user, 'consentrecords/submitCreateInstance', '')
    if not request.user.is_authenticated:
        return signin(request)
    
    if request.method != "POST":
        raise Http404("submitCreateInstance only responds to POST methods")
    
    # Check the security access for this operation for the current user.
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    logger = logging.getLogger(__name__)
    logger.error("%s" % str(request.POST))

    try:
        # The type of the new object.
        instanceType = request.POST.get('typeName', None)
        
        # An optional container for the new object.
        containerUUID = request.POST.get('containerUUID', None)
        
        # The element name for the type of element that the new object is to the container object
        elementName = request.POST.get('elementName', None) or instanceType
        
        # An optional set of properties associated with the object.
        propertyString = request.POST.get('properties', "[]")
        propertyList = json.loads(propertyString)
        
        indexString = request.POST.get('index', "-1")
        index = int(indexString)
        
        # The client time zone offset, stored with the transaction.
        timezoneoffset = request.POST['timezoneoffset']
        
        if not instanceType:
            return JsonResponse({'success':False, 'error': "type was not specified in submitCreateInstance"})
            
        with transaction.atomic():
            transactionState = TransactionState(request.user, timezoneoffset)
            ofKindObject = UniqueObject(Fact.getNamedUUID(instanceType, transactionState))
            item = ofKindObject.createInstance(transactionState)
        
            if containerUUID:
                logger.error("submitCreateInstance containerUUID: %s" % containerUUID)
                elementID = Fact.getNamedUUID(elementName, transactionState)
            
                containerObject = UniqueObject(containerUUID)
                # If containerObject is a reference, then get the value for the reference.
                containerObject = containerObject.getSubObject(Fact.valueUUID()) or containerObject
        
                logger.error("submitCreateInstance elementID: %s" % elementID)
                logger.error("submitCreateInstance index: %s" % index)
                if index < 0:
                    maxIndex = containerObject.getMaxElementIndex(elementID)
                    if maxIndex == None:
                        index = 0
                    else:
                        index = maxIndex + 1
                logger.error("submitCreateInstance next index: %s" % index)
                newIndex = containerObject.updateElementIndexes(elementID, index, transactionState)
                newValue = containerObject.addValue(elementID, item.id.hex, newIndex, transactionState)
                logger.error("  newValue: %s" % str(newValue.id))
        
            for i in request.POST.lists():
                logger.error("    Request list: %s" % str(i))
            logger.error("  PropertyList: %s" % str(propertyList))
            for f in propertyList:
                fieldData = f['field']
                fieldID = fieldData['id']
                fieldObject = UniqueObject(fieldID)
                item.addData(fieldObject, f['data'], transactionState)
        
        if containerUUID:
            results = {'success':True, 'object': newValue.getValueData(ofKindObject)}
        else:    
            results = {'success':True, 'object': item.getReferenceData(ofKindObject)}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
def submitUpdateValues(request):
    LogRecord.emit(request.user, 'consentrecords/submitUpdateValues', '')
    
    if not request.user.is_authenticated:
        return signin(request)
    
    if request.method != "POST":
        raise Http404("submitUpdateValues only responds to POST methods")
    
    # Check the security access for this operation for the current user.
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    logger = logging.getLogger(__name__)
    logger.error("%s" % request.POST)
    
    try:
                
        commandString = request.POST.get('commands', "[]")
        commands = json.loads(commandString)

        # The client time zone offset, stored with the transaction.
        timezoneoffset = request.POST['timezoneoffset']
        
        with transaction.atomic():
            transactionState = TransactionState(request.user, timezoneoffset)
            for c in commands:
                obj = UniqueObject(c["id"])
                elementName = c["elementID"]
                elementID = Fact.getNamedUUID(elementName, None)
                obj.updateValue(elementID, c["value"], transactionState);
            
            results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
# Handle a POST event to add a value to an object that references another other or data.
def submitAddValue(request):
    
    LogRecord.emit(request.user, 'consentrecords/submitAddValue', '')
    if not request.user.is_authenticated:
        return signin(request)
    
    if request.method != "POST":
        raise Http404("submitAddValue only responds to POST methods")
    
    # Check the security access for this operation for the current user.
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    logger = logging.getLogger(__name__)
    logger.error("%s" % str(request.POST))

    try:
        # An optional container for the new object.
        containerUUID = request.POST.get('containerUUID', None)
        
        # The element name for the type of element that the new value is to the container object
        elementUUID = request.POST.get('elementUUID', None)
        
        if elementUUID is None:
            return JsonResponse({'success':False, 'error': 'the elementUUID was not specified'})
            
        # An value added to the container.
        valueUUID = request.POST.get('valueUUID', None)
        
        if valueUUID is None:
            return JsonResponse({'success':False, 'error': 'the value was not specified'})
            
        # The index of the value within the container.
        indexString = request.POST.get('index', None)
        
        # The client time zone offset, stored with the transaction.
        timezoneoffset = request.POST['timezoneoffset']
        
        with transaction.atomic():
            transactionState = TransactionState(request.user, timezoneoffset)
        
            elementID = uuid.UUID(elementUUID)
            container = UniqueObject(containerUUID)
        
            if indexString:
                newIndex = container.updateElementIndexes(elementID, int(indexString), transactionState)
            else:
                maxIndex = container.getMaxElementIndex(elementID)
                if maxIndex == None: # Note that it could be 0.
                    newIndex = 0
                else:
                    newIndex = maxIndex + 1
        
            item = UniqueObject(containerUUID).addValue(elementID, valueUUID, newIndex, transactionState)
        
        results = {'success':True, 'id': item.id.hex}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
def getRootObjects(request):
    LogRecord.emit(request.user, 'consentrecords/getRootObjects', '')
    
    try:
        logger = logging.getLogger(__name__)
        logger.error("getRootObjects: %s" % str(request.GET))
        
        ofKindName = request.GET.get("ofKindName", "_uuname")
        ofKindID = request.GET.get("ofKindID", None)
    
        if ofKindID:
            ofKindUUID = uuid.UUID(ofKindID)
        else:
            ofKindUUID = Fact.getNamedUUID(ofKindName, None)
    
        # Check the security access for this operation for the current user.
        if not request.user.is_superuser:
            return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
        p = UniqueObject.rootDescriptors(ofKindUUID)
        
        results = {'success':True, 'objects': p}
        logger.error("getRootObjects returns: %s" % str(results))
        
    except Fact.NoEditsAllowedError:
        return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
def getAddConfiguration(request):
    LogRecord.emit(request.user, 'consentrecords/getAddConfiguration', '')
    
    # Check the security access for this operation for the current user.
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    try:
        logger = logging.getLogger(__name__)
        # Get the uuid for the configuration.
        typeName = request.GET.get('typeName', None)
        
        if not typeName:
            return JsonResponse({'success':False, 'error': "typeName was not specified in getData"})

        kindObject = UniqueObject(Fact.getNamedUUID(typeName))
            
        configurationObject = kindObject.getSubValueObject(verb=Fact.configurationUUID())
        
        p = configurationObject.getData()
        
        logger = logging.getLogger(__name__)
        logger.error("getAddConfiguration result: %s" % str(p))
        
        results = {'success':True, 'cells': p}
    except Fact.NoEditsAllowedError:
        return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
def getData(request):
    LogRecord.emit(request.user, 'consentrecords/getData', '')
    
    # Check the security access for this operation for the current user.
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    try:
        logger = logging.getLogger(__name__)
        logger.error("getData request: %s" % str(request.GET))
        # Get the uuid name of the kind for which we are getting the configuration.
        uuidString = request.GET.get('id', None)
        
        if not uuidString:
            return JsonResponse({'success':False, 'error': "id was not specified in getData"})

        uuObject = UniqueObject(uuidString)
        
        # If it is a reference, then get the value for the reference.
        uuObject = uuObject.getSubObject(Fact.valueUUID()) or uuObject
        
        instanceOfFact = uuObject.getSubFact(verb=Fact.instanceOfUUID())
        if instanceOfFact:
            kindObject = UniqueObject(instanceOfFact.directObject)
        else:
            # In this case, the object is a uuName
            kindObject = UniqueObject(Fact.uuNameUUID())
            
        configurationObject = kindObject.getSubValueObject(verb=Fact.configurationUUID())
        
        if not configurationObject:
            return JsonResponse({'success':False, 'error': "the specified item is not configured"})
        
        p = configurationObject.getData(uuObject)
        
        logger.error("%s" % str(p))
        
        results = {'success':True, 'cells': p}
    except Fact.NoEditsAllowedError:
        return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
# Returns in the values array an array of enumeration values with their name, uuid and index.
# This request is made when getting the possible values for an enumeration pick operation.    
def getEnumerationValues(request):
    LogRecord.emit(request.user, 'consentrecords/getEnumerationValues', '')
    
    # Check the security access for this operation for the current user.
    if not request.user.is_superuser:
        return JsonResponse({'success':False, 'error': 'the current user is not an administrator'})
    
    try:
        fieldID = request.GET.get('id', None)
        
        if not fieldID:
            return JsonResponse({'success':False, 'error': "type was not specified in getEnumerationValues"})
        
        fieldObject = UniqueObject(fieldID)
                
        logger = logging.getLogger(__name__)
        logger.error("%s" % str(fieldObject.enumerationValues))
        results = {'success':True, 'values': fieldObject.enumerationValues}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
