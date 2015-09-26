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

def list(request):
    LogRecord.emit(request.user, 'consentrecords/list', '')
    
    # The type of the root object.
    rootType = request.GET.get('type', "_uuname")
    rootID = Fact.getNamedUUID(rootType);
            
    template = loader.get_template('consentrecords/configuration.html')
    
    context = RequestContext(request, {
        'user': request.user,
        'canShowObjects': request.user.is_superuser,
        'canAddObject': request.user.is_superuser,
        'rootType': rootType,
        'rootID': rootID.hex,
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
        instanceUUID = request.POST.get('typeID', None)
        if instanceUUID:
            ofKindObject = UniqueObject(instanceUUID)
        elif not instanceType:
            return JsonResponse({'success':False, 'error': "type was not specified in submitCreateInstance"})
        else:
            ofKindObject = UniqueObject(Fact.getNamedUUID(instanceType))
        
        # An optional container for the new object.
        containerUUID = request.POST.get('containerUUID', None)
        
        # The element name for the type of element that the new object is to the container object
        elementName = request.POST.get('elementName', None)
        elementUUID = request.POST.get('elementUUID', None)
        if elementUUID:
            elementID = uuid.UUID(elementUUID)
        elif elementName:
            elementID = Fact.getNamedUUID(elementName)
        elif instanceUUID:
            elementID = uuid.UUID(instanceUUID)
        elif instanceName: 
            elementID = Fact.getNamedUUID(instanceName)
            
        # An optional set of properties associated with the object.
        propertyString = request.POST.get('properties', "[]")
        propertyList = json.loads(propertyString)
        
        indexString = request.POST.get('index', "-1")
        index = int(indexString)
        
        # The client time zone offset, stored with the transaction.
        timezoneoffset = request.POST['timezoneoffset']
        
        with transaction.atomic():
            transactionState = TransactionState(request.user, timezoneoffset)
            if containerUUID:
                containerObject = UniqueObject(containerUUID)
                # If containerObject is a reference, then get the value for the reference.
                containerObject = containerObject.getSubObject(Fact.valueUUID()) or containerObject
            else:
                containerObject = None
    
            item, newValue = ofKindObject.createInstance(containerObject, elementID, index, propertyList, transactionState)
        
        if containerObject:
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
    
def selectAll(request):
    LogRecord.emit(request.user, 'consentrecords/selectAll', '')
    
    try:
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
        typeUUID = request.GET.get('typeID', None)
        if typeUUID:
            kindObject = UniqueObject(typeUUID)
        elif not typeName:
            return JsonResponse({'success':False, 'error': "typeName was not specified in getAddConfiguration"})
        else:
            kindObject = UniqueObject(Fact.getNamedUUID(typeName))
        
        configurationObject = kindObject.getSubValueObject(verb=Fact.configurationUUID())
        
        p = configurationObject.getData()
        
        logger = logging.getLogger(__name__)
        logger.error("getAddConfiguration result: %s" % str(p))
        
        results = {'success':True, 'cells': p}
    except Fact.NoEditsAllowedError:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
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
                
        results = {'success':True, 'values': fieldObject.enumerationValues}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)
    
