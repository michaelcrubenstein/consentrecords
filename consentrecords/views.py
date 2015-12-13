from django.conf import settings
from django.db import transaction, connection
from django.http import HttpResponse, JsonResponse, Http404
from django.shortcuts import render, redirect
from django.template import RequestContext, loader
from django.views.decorators.csrf import requires_csrf_token

from oauth2_provider.views.generic import ProtectedResourceView
from oauth2_provider.models import AccessToken

from pathlib import Path
import os
import json
import logging
import traceback
import uuid
import urllib.parse
import datetime

from monitor.models import LogRecord
from custom_user import views as userviews
from consentrecords.models import TransactionState, Terms, Instance, Value, NameList
from consentrecords import instancecreator
from consentrecords import pathparser
from consentrecords.userfactory import UserFactory

def home(request):
    return userHome(request)

def anonymousHome(request):
    LogRecord.emit(request.user, 'consentrecords/anonymousHome', '')
    
    template = loader.get_template('consentrecords/anonymousHome.html')
    context = RequestContext(request, {
    })
        
    return HttpResponse(template.render(context))

def userHome(request):
    LogRecord.emit(request.user, 'consentrecords/userHome', '')
    
    template = loader.get_template('consentrecords/userHome.html')
    args = {
        'user': request.user,
        'backURL': '/',
    }
    
    if request.user.is_authenticated():
        user = UserFactory.getUserInstance(request.user.id)
        if not user:
            print ("user is not set up: %s" % (request.user.get_full_name()))
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    state = request.GET.get('state', None)
    if state:
        args['state'] = state

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

def find(request, serviceid, offeringid):
    LogRecord.emit(request.user, 'consentrecords/find', '')
    
    template = loader.get_template('consentrecords/userHome.html')
    args = {
        'user': request.user,
        'backURL': '/',
    }
    
    if request.user.is_authenticated():
        args['userID'] = UserFactory.getUserInstance(request.user.id).id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = "findNewExperience" + serviceid + offeringid
    
    if settings.FACEBOOK_SHOW:
        offering = Instance.objects.get(pk=offeringid)
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = offering._description
        args['fbDescription'] = offering.parent and offering.parent.parent and offering.parent.parent._description

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

def list(request):
    LogRecord.emit(request.user, 'consentrecords/list', '')
    
    try:
        # The type of the root object.
        rootType = request.GET.get('type', None)
        root = rootType and Terms.getNamedInstance(rootType);
        path=request.GET.get('path', "_uuname")
        header=request.GET.get('header', "List")
            
        template = loader.get_template('consentrecords/configuration.html')
    
        argList = {
            'user': request.user,
            'canShowObjects': request.user.is_superuser,
            'canAddObject': request.user.is_superuser,
            'path': urllib.parse.unquote_plus(path),
            'header': header,
            }
        if root:
            argList["rootID"] = root.id
            argList["singularName"] = root._description
        
        context = RequestContext(request, argList)
        
        return HttpResponse(template.render(context))
    except Exception as e:
        return HttpResponse(str(e))

# Handle a POST event to create a new instance of an object with a set of properties.
class api:
    def createInstance(user, data):
        try:
            # The type of the new object.
            instanceType = data.get('typeName', None)
            instanceUUID = data.get('typeID', None)
            if instanceUUID:
                ofKindObject = Instance.objects.get(pk=instanceUUID)
            elif not instanceType:
                return JsonResponse({'success':False, 'error': "type was not specified in createInstance"})
            else:
                ofKindObject = Terms.getNamedInstance(instanceType)
        
            # An optional container for the new object.
            containerUUID = data.get('containerUUID', None)
        
            # The element name for the type of element that the new object is to the container object
            elementName = data.get('elementName', None)
            elementUUID = data.get('elementUUID', None)
            if elementUUID:
                field = Instance.objects.get(pk=elementUUID)
            elif elementName:
                field = Terms.getNamedInstance(elementName)
            elif instanceUUID:
                field = Instance.objects.get(pk=instanceUUID)
            elif instanceName: 
                field = Terms.getNamedInstance(instanceName)
            
            # An optional set of properties associated with the object.
            propertyString = data.get('properties', None)
            propertyList = json.loads(propertyString)
        
            indexString = data.get('index', "-1")
            index = int(indexString)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
            languageID = None
        
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                if containerUUID:
                    containerObject = Instance.objects.get(pk=containerUUID)
                else:
                    containerObject = None

                nameLists = NameList()
                item, newValue = instancecreator.create(ofKindObject, containerObject, field, index, propertyList, nameLists, transactionState)
    
                if newValue and newValue.isDescriptor:
                    Instance.updateDescriptions([item], nameLists)
    
                if containerObject:
                    results = {'success':True, 'object': newValue.getReferenceData()}
                else:    
                    results = {'success':True, 'object': item.getReferenceData()}
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def updateValues(user, data):
        try:
            commandString = data.get('commands', "[]")
            commands = json.loads(commandString)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
        
            ids = []
            nameLists = NameList()
            descriptionQueue = []
            
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                for c in commands:
                    if "id" in c:
                        oldValue = Value.objects.get(pk=c["id"])
                        if oldValue.isDescriptor:
                            container = oldValue.instance;
                            descriptionQueue.append(container)
                        if "value" in c:
                            item = oldValue.updateValue(c["value"], transactionState);
                        else:
                            if oldValue.isOriginalReference:
                                i = oldValue.referenceValue.deepDelete(transactionState)
                            oldValue.markAsDeleted(transactionState)
                            item = None
                    elif "containerUUID" in c:
                        container = Instance.objects.get(pk=c["containerUUID"])
                        fieldID = Instance.objects.get(pk=c["fieldID"])
                        newIndex = c["index"]
                        newValue = c["value"]
                        if "ofKindID" in c:
                            ofKindObject = Instance.objects.get(pk=c["ofKindID"])
                            propertyList = newValue
                            newInstance, item = instancecreator.create(ofKindObject, container, fieldID, propertyList, newValue, nameLists, transactionState)
                        else:
                            item = container.addValue(fieldID, newValue, newIndex, transactionState)
                        if item.isDescriptor:
                            descriptionQueue.append(container)
                    else:
                        raise ValueError("subject id was not specified")
                    if item:
                        ids.append(item.id)
                    else:
                        ids.append(None)
                                
                Instance.updateDescriptions(descriptionQueue, nameLists)
                
                results = {'success':True, 'ids': ids}
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
               
        return JsonResponse(results)

    def addValue(user, data):
        try:
            # An optional container for the new object.
            containerUUID = data.get('containerUUID', None)
        
            # The element name for the type of element that the new value is to the container object
            elementUUID = data.get('elementUUID', None)
        
            if elementUUID is None:
                return JsonResponse({'success':False, 'error': 'the elementUUID was not specified'})
            
            # A value added to the container.
            valueUUID = data.get('valueUUID', None)
        
            if valueUUID is None:
                return JsonResponse({'success':False, 'error': 'the value was not specified'})
            
            referenceValue = Instance.objects.get(pk=valueUUID)
            
            # The index of the value within the container.
            indexString = data.get('index', None)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
        
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                field = Instance.objects.get(pk=elementUUID)
                container = Instance.objects.get(pk=containerUUID)
    
                if indexString:
                    newIndex = container.updateElementIndexes(field, int(indexString), transactionState)
                else:
                    maxIndex = container.getMaxElementIndex(field)
                    if maxIndex == None: # Note that it could be 0.
                        newIndex = 0
                    else:
                        newIndex = maxIndex + 1
    
                item = container.addReferenceValue(field, referenceValue, newIndex, transactionState)
                if item.isDescriptor:
                    Instance.updateDescriptions([container], NameList())
        
            results = {'success':True, 'id': item.id}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def selectAll(user, data):
        try:
            path = data.get("path", None)
            limit = int(data.get("limit", "0"))
        
            if path:
                a = pathparser.tokenize(path)
                p = pathparser.selectAllDescriptors(path=a, limit=limit)
            else:
                try:
                    ofKindName = data.get("ofKindName", "_uuname")
                    ofKindID = data.get("ofKindID", Terms.getNamedInstance(ofKindName).id)
                except Instance.DoesNotExist:
                    return JsonResponse({'success':False, 'error': 'the term "%s" was not recognized' % ofKindName })
                a = pathparser.tokenize(ofKindID)
                p = Instance.rootDescriptors(a, limit)
        
            results = {'success':True, 'objects': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def getConfiguration(user, data):
        try:
            # Get the uuid for the configuration.
            typeName = data.get('typeName', None)
            typeUUID = data.get('typeID', None)
            if typeUUID:
                kindObject = Instance.objects.get(pk=typeUUID)
            elif typeName:
                kindObject = Terms.getNamedInstance(typeName)
            else:
                return JsonResponse({'success':False, 'error': "typeName was not specified in getAddConfiguration"})
        
            configurationObject = kindObject.getSubInstance(Terms.configuration)
        
            if not configurationObject:
                return JsonResponse({'success':False, 'error': "objects of this kind have no configuration object"})
                
            p = configurationObject.getConfiguration()
        
            results = {'success':True, 'cells': p}
        except Instance.DoesNotExist:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)

    def getUserID(user, data):
        accessTokenID = data.get('access_token', None)
    
        try:
            if not accessTokenID:
                raise ValueError("the access token is not specified")
            accessToken = AccessToken.objects.get(token=accessTokenID)
        
            userID = UserFactory.getUserInstance(accessToken.user.id).id
            results = {'success':True, 'userID': userID}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
    
    def getCells(uuObject, fields, fieldsDataDictionary, nameLists):
        if uuObject.typeID in fieldsDataDictionary:
            fieldsData = fieldsDataDictionary[uuObject.typeID]
        else:
            configuration = uuObject.typeID.getSubInstance(Terms.configuration)
    
            if not configuration:
                raise ValueError("the specified item is not configured")
    
            fieldsData = [fieldObject.getFieldData() for fieldObject in configuration._getSubInstances(Terms.field)]
            fieldsDataDictionary[uuObject.typeID] = fieldsData
        
        cells = uuObject.getData(fieldsData, nameLists)
    
        data = {"id": uuObject.id, 
                "description": uuObject.description(),
                "parentID": uuObject.parent and uuObject.parent.id, 
                "cells" : cells }
    
        if 'parents' in fields:
            while uuObject.parent:
                uuObject = uuObject.parent
                kindObject = uuObject.typeID
                fieldData = kindObject.getParentReferenceFieldData()
            
                parentData = {'id': None, 
                        'value': {'id': uuObject.id, 'description': uuObject.description()},
                        'position': 0}
                data["cells"].append({"field": fieldData, "data": parentData})
        
        return data;
    
    def getData(user, data):
        try:
            path = data.get('path', None)
            limit = int(data.get("limit", "0"))
        
            if not path:
                return JsonResponse({'success':False, 'error': "path was not specified in getData"})
            
            fieldString = data.get('fields', "[]")
            fields = json.loads(fieldString)

            a = pathparser.tokenize(path)
            
            uuObjects = pathparser.selectAllObjects(path=a, limit=limit)
            fieldsDataDictionary = {}
            nameLists = NameList()
            p = [api.getCells(uuObject, fields, fieldsDataDictionary, nameLists) for uuObject in uuObjects]        
        
            results = {'success':True, 'data': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData data:%s" % str(data))
            
            results = {'success':False, 'error': str(e)}
        
        return JsonResponse(results)
    
    # This should only be done for root instances. Otherwise, the value should
    # be deleted, which will delete this as well.
    def deleteInstances(user, data):
        try:
            path = data.get('path', None)
        
            if path:
                a = pathparser.tokenize(path)
            
                # The client time zone offset, stored with the transaction.
                timezoneoffset = data['timezoneoffset']
        
                with transaction.atomic():
                    transactionState = TransactionState(user, timezoneoffset)
                    descriptionCache = []
                    nameLists = NameList()
                    for uuObject in pathparser.selectAllObjects(a):
                        if uuObject.parent:
                            raise ValueException("can only delete root instances directly")
                        uuObject.deleteOriginalReference(transactionState)
                        uuObject.deepDelete(transactionState)
            else:   
                return JsonResponse({'success':False, 'error': "path was not specified in delete"})
            results = {'success':True}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def deleteValue(user, data):
        try:
            valueID = data.get('valueID', None)
        
            if valueID:
                v = Value.objects.get(pk=valueID)

                # The client time zone offset, stored with the transaction.
                timezoneoffset = data['timezoneoffset']

                with transaction.atomic():
                    transactionState = TransactionState(user, timezoneoffset)
                    if v.isOriginalReference:
                        i = v.referenceValue.deepDelete(transactionState)
                    v.markAsDeleted(transactionState)
                    
                    if v.isDescriptor:
                        nameLists = NameList()
                        Instance.updateDescriptions([v.instance], nameLists)
            else:   
                return JsonResponse({'success':False, 'error': "valueID was not specified in delete"})
            results = {'success':True}
        except Value.DoesNotExist:
            return JsonResponse({'success':False, 'error': "the specified value ID was not recognized"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)

def createInstance(request):
    LogRecord.emit(request.user, 'consentrecords/createInstance', '')

    if request.method != "POST":
        raise Http404("createInstance only responds to POST methods")
    
    if not request.user.is_authenticated:
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.createInstance(request.user, request.POST)
    
def updateValues(request):
    LogRecord.emit(request.user, 'consentrecords/updateValues', '')
    
    if request.method != "POST":
        raise Http404("updateValues only responds to POST methods")
    
    if not request.user.is_authenticated:
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.updateValues(request.user, request.POST)
    
# Handle a POST event to add a value to an object that references another other or data.
def addValue(request):
    
    LogRecord.emit(request.user, 'consentrecords/addValue', '')

    if request.method != "POST":
        raise Http404("addValue only responds to POST methods")
    
    if not request.user.is_authenticated:
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.addValue(request.user, request.POST)
        
def deleteInstances(request):
    LogRecord.emit(request.user, 'consentrecords/deleteInstances', '')
    
    if request.method != "POST":
        raise Http404("deleteInstances only responds to POST methods")
    
    if not request.user.is_authenticated:
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
        
    return api.deleteInstances(request.user, request.POST)
    
def deleteValue(request):
    LogRecord.emit(request.user, 'consentrecords/deleteValue', '')
    
    if request.method != "POST":
        raise Http404("deleteValue only responds to POST methods")
    
    if not request.user.is_authenticated:
        return JsonResponse({'success':False, 'error': 'the current user is not authenticated'})
    
    return api.deleteValue(request.user, request.POST)
    
def selectAll(request):
    LogRecord.emit(request.user, 'consentrecords/selectAll', '')
    
    if request.method != "GET":
        raise Http404("selectAll only responds to GET methods")
    
    return api.selectAll(request.user, request.GET)
    
def getConfiguration(request):
    LogRecord.emit(request.user, 'consentrecords/getAddConfiguration', '')
    
    if request.method != "GET":
        raise Http404("getConfiguration only responds to GET methods")
    
    return api.getConfiguration(request.user, request.GET)
    
def getUserID(request):
    LogRecord.emit(request.user, 'consentrecords/getUserID', '')
    
    if request.method != "GET":
        raise Http404("getUserID only responds to GET methods")
    
    return api.getUserID(request.user, request.GET)

def getData(request):
    LogRecord.emit(request.user, 'consentrecords/getData', '')
    
    if request.method != "GET":
        raise Http404("getData only responds to GET methods")
    
    return api.getData(request.user, request.GET)

class ApiEndpoint(ProtectedResourceView):
    def get(self, request, *args, **kwargs):
        if request.path_info == '/api/getdata/':
            return getData(request)
        elif request.path_info == '/api/getconfiguration/':
            return getConfiguration(request)
        elif request.path_info == '/api/selectall/':
            return selectAll(request)
        return JsonResponse({'success':False, 'error': 'unrecognized url'})
        
    def post(self, request, *args, **kwargs):
        if request.path_info == '/api/createinstance/':
            return createInstance(request)
        elif request.path_info == '/api/updatevalues/':
            return updateValues(request)
        elif request.path_info == '/api/addvalue/':
            return addValue(request)
        elif request.path_info == '/api/deleteinstances/':
            return deleteInstances(request)
        elif request.path_info == '/api/deletevalues/':
            return deleteValues(request)
        return JsonResponse({'success':False, 'error': 'unrecognized url'})
    
class ApiGetUserIDEndpoint(ProtectedResourceView):
    def get(self, request, *args, **kwargs):
        return getUserID(request)
        
# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    LogRecord.emit(request.user, 'consentrecords/submitsignin', '')
    
    try:
        timezoneOffset = request.POST["timezoneoffset"]
    
        results = userviews.signinResults(request)
        if results["success"]:
            user = UserFactory.getUserInstance(request.user.id) or UserFactory.createUserInstance(request.user, timezoneOffset)
            results["user"] = { "id": user.id, "description" : request.user.get_full_name() }        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
        
    return JsonResponse(results)

def submitNewUser(request):
    LogRecord.emit(request.user, 'consentrecords/submitNewUser', '')
        
    try:
        timezoneOffset = request.POST["timezoneoffset"]
    
        results = userviews.newUserResults(request)
        if results["success"]:
            userInstance = UserFactory.getUserInstance(request.user.id) or UserFactory.createUserInstance(request.user, timezoneOffset)
            results["user"] = { "id": userInstance.id, "description" : request.user.get_full_name() }
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
        
    return JsonResponse(results)

