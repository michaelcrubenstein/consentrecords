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
import html.parser

from monitor.models import LogRecord
from consentrecords.models import TransactionState, Fact, LazyInstance, LazyValue
from custom_user import views as userviews
from parse.cssparser import parser as cssparser

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
        args['userID'] = UserFactory.getUserObjectID(request.user.id)
        
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
        args['userID'] = UserFactory.getUserObjectID(request.user.id)
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = "findNewExperience" + serviceid + offeringid
    
    if settings.FACEBOOK_SHOW:
        offering = LazyInstance(offeringid)
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = offering._description
        args['fbDescription'] = offering.parent and offering.parent.parent and offering.parent.parent._description

    context = RequestContext(request, args)
        
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
    rootType = request.GET.get('type', None)
    rootID = rootType and Fact.getNamedUUID(rootType);
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
    if rootID:
        argList["rootID"] = rootID.hex
        argList["singularName"] = LazyInstance(rootID)._description
        
    context = RequestContext(request, argList)
        
    return HttpResponse(template.render(context))
    
# Handle a POST event to create a new instance of an object with a set of properties.
class api:
    def createInstance(user, data):
        try:
            # The type of the new object.
            instanceType = data.get('typeName', None)
            instanceUUID = data.get('typeID', None)
            if instanceUUID:
                ofKindObject = LazyInstance(instanceUUID)
            elif not instanceType:
                return JsonResponse({'success':False, 'error': "type was not specified in createInstance"})
            else:
                ofKindObject = LazyInstance(Fact.getNamedUUID(instanceType))
        
            # An optional container for the new object.
            containerUUID = data.get('containerUUID', None)
        
            # The element name for the type of element that the new object is to the container object
            elementName = data.get('elementName', None)
            elementUUID = data.get('elementUUID', None)
            if elementUUID:
                elementID = uuid.UUID(elementUUID)
            elif elementName:
                elementID = Fact.getNamedUUID(elementName)
            elif instanceUUID:
                elementID = uuid.UUID(instanceUUID)
            elif instanceName: 
                elementID = Fact.getNamedUUID(instanceName)
            
            # An optional set of properties associated with the object.
            propertyString = data.get('properties', "[]")
            propertyList = json.loads(propertyString)
        
            indexString = data.get('index', "-1")
            index = int(indexString)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
        
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                if containerUUID:
                    containerObject = LazyInstance(containerUUID)
                else:
                    containerObject = None
    
                item, newValue = ofKindObject.createInstance(containerObject, elementID, index, propertyList, transactionState)
        
                if containerObject:
                    results = {'success':True, 'object': newValue.getReferenceData(item, ofKindObject)}
                else:    
                    results = {'success':True, 'object': item.getReferenceData(ofKindObject)}
            
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
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
                for c in commands:
                    if "id" in c:
                        oldValue = LazyValue(c["id"])
                        if "value" in c:
                            item = oldValue.updateValue(c["value"], transactionState);
                        else:
                            if oldValue.isOriginalReference:
                                i = LazyInstance(oldValue.stringValue).deepDelete(transactionState)
                            oldValue.markAsDeleted(transactionState)
                            item = None
                    elif "containerUUID" in c:
                        container = LazyInstance(c["containerUUID"])
                        fieldID = c["fieldID"]
                        newIndex = c["index"]
                        newValue = c["value"]
                        if isinstance(newValue, (str)):
                            item = container.addValue(fieldID, newValue, newIndex, transactionState)
                        else:
                            ofKindObject = LazyInstance(c["ofKindID"])
                            newInstance, item = ofKindObject.createInstance(container, uuid.UUID(fieldID), newIndex, newValue, transactionState)
                    else:
                        raise ValueError("subject id was not specified")
                    if item:
                        ids.append(item.id.hex)
                    else:
                        ids.append(None)
            
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
            
            # The index of the value within the container.
            indexString = data.get('index', None)
        
            # The client time zone offset, stored with the transaction.
            timezoneoffset = data['timezoneoffset']
        
            with transaction.atomic():
                transactionState = TransactionState(user, timezoneoffset)
        
                elementID = uuid.UUID(elementUUID)
                container = LazyInstance(containerUUID)
        
                if indexString:
                    newIndex = container.updateElementIndexes(elementID, int(indexString), transactionState)
                else:
                    maxIndex = container.getMaxElementIndex(elementID)
                    if maxIndex == None: # Note that it could be 0.
                        newIndex = 0
                    else:
                        newIndex = maxIndex + 1
        
                item = container.addValue(elementID, valueUUID, newIndex, transactionState)
        
            results = {'success':True, 'id': item.id.hex}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def selectAll(user, data):
        try:
            ofKindName = data.get("ofKindName", "_uuname")
            ofKindID = data.get("ofKindID", None)
            path = data.get("path", None)
        
            if path:
                html_parser = html.parser.HTMLParser()
                unescaped = html_parser.unescape(path)
                tokens = cssparser.tokenize(unescaped)
                a, remainder = cssparser.cascade(tokens)
                
                p = LazyInstance.selectAllDescriptors(a)
            else:
                if ofKindID:
                    ofKindUUID = uuid.UUID(ofKindID)
                else:
                    ofKindUUID = Fact.getNamedUUID(ofKindName, None)
    
                html_parser = html.parser.HTMLParser()
                unescaped = html_parser.unescape(ofKindUUID.hex)
                tokens = cssparser.tokenize(unescaped)
                a, remainder = cssparser.cascade(tokens)
                p = LazyInstance.rootDescriptors(a)
        
            results = {'success':True, 'objects': p}
        
        except Fact.NoEditsAllowedError:
            return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
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
                kindObject = LazyInstance(typeUUID)
            elif typeName:
                kindObject = LazyInstance(Fact.getNamedUUID(typeName))
            else:
                return JsonResponse({'success':False, 'error': "typeName was not specified in getAddConfiguration"})
        
            configurationObject = kindObject.getSubInstance(Fact.configurationUUID())
        
            if not configurationObject:
                return JsonResponse({'success':False, 'error': "objects of this kind have no configuration object"})
                
            p = configurationObject.getData()
        
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

    def getUserID(user, data):
        accessTokenID = data.get('access_token', None)
    
        try:
            if not accessTokenID:
                raise ValueError("the access token is not specified")
            accessToken = AccessToken.objects.get(token=accessTokenID)
        
            userID = UserFactory.getUserObjectID(accessToken.user.id)
            results = {'success':True, 'userID': userID}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
    
    def getCells(uuObject, fields):
        kindObject = LazyInstance(uuObject.typeID)
        
        configurationObject = kindObject.getSubInstance(Fact.configurationUUID())
    
        if not configurationObject:
            raise ValueError("the specified item is not configured")
    
        cells = configurationObject.getData(uuObject)
    
        data = {"id": uuObject.id.hex, "parentID": uuObject.parentID, "cells" : cells }
    
        if 'parents' in fields:
            while uuObject.parentID:
                uuObject = LazyInstance(uuObject.parentID)
                kindObject = LazyInstance(uuObject.typeID)
                fieldData = kindObject.getParentReferenceFieldData()
                nameFieldUUIDs = kindObject._descriptors
            
                parentData = {'id': None, 
                        'value': {'id': uuObject.id.hex, 'description': uuObject._getDescription(nameFieldUUIDs)},
                        'position': 0}
                data["cells"].append({"field": fieldData, "data": parentData})
        
        return data;
    
    def getData(user, data):
        path=None
        try:
            path = data.get('path', None)
        
            if not path:
                return JsonResponse({'success':False, 'error': "path was not specified in getData"})
            
            fieldString = data.get('fields', "[]")
            fields = json.loads(fieldString)

            html_parser = html.parser.HTMLParser()
            unescaped = html_parser.unescape(path)
            tokens = cssparser.tokenize(unescaped)
            a, remainder = cssparser.cascade(tokens)
            
            uuObjects = LazyInstance.selectAllObjects(a)
            p = [api.getCells(uuObject, fields) for uuObject in uuObjects]        
        
            results = {'success':True, 'data': p}
        except Fact.NoEditsAllowedError:
            return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData data:%s" % str(data))
            
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
    
    def deleteInstances(user, data):
        try:
            path = data.get('path', None)
        
            if path:
                html_parser = html.parser.HTMLParser()
                unescaped = html_parser.unescape(path)
                tokens = cssparser.tokenize(unescaped)
                a, remainder = cssparser.cascade(tokens)
            
                # The client time zone offset, stored with the transaction.
                timezoneoffset = data['timezoneoffset']
        
                with transaction.atomic():
                    transactionState = TransactionState(user, timezoneoffset)
                    for uuObject in LazyInstance.selectAllObjects(a):
                        uuObject.deleteOriginalReference(transactionState)
                        uuObject.deepDelete(transactionState)
            else:   
                return JsonResponse({'success':False, 'error': "path was not specified in delete"})
            results = {'success':True}
        except Fact.NoEditsAllowedError:
            return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            results = {'success':False, 'error': str(e)}
            
        return JsonResponse(results)
        
    def deleteValue(user, data):
        try:
            valueID = data.get('valueID', None)
        
            if valueID:
                v = LazyValue(valueID)

                # The client time zone offset, stored with the transaction.
                timezoneoffset = data['timezoneoffset']

                with transaction.atomic():
                    transactionState = TransactionState(user, timezoneoffset)
                    if v.isOriginalReference:
                        i = LazyInstance(v.stringValue).deepDelete(transactionState)
                    v.markAsDeleted(transactionState)
            else:   
                return JsonResponse({'success':False, 'error': "valueID was not specified in delete"})
            results = {'success':True}
        except Fact.NoEditsAllowedError:
            return JsonResponse({'success':False, 'error': "the specified instanceType was not recognized"})
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
        
class UserFactory:
    def getUserObjectID(userID):
        fieldID = Fact.getNamedUUID(Fact.userIDName)
        if isinstance(userID, uuid.UUID):
            userID = userID.hex
        with connection.cursor() as c:
            sql = "SELECT v1.instance_id" + \
              " FROM consentrecords_value v1" + \
              " WHERE v1.fieldid = %s and v1.stringvalue = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)"
            c.execute(sql, [fieldID.hex, userID])
            r = c.fetchone()
            return r and r[0]
            
    def createUserObjectID(user, timezoneOffset):
        with transaction.atomic():
            if isinstance(user.id, uuid.UUID):
                userID = user.id.hex    # SQLite
            else:
                userID = user.id        # MySQL

            transactionState = TransactionState(user, timezoneOffset)
            ofKindObject = LazyInstance(Fact.getNamedUUID(Fact.userName))
            item, newValue = ofKindObject.createInstance(None, None, 0, [], transactionState)
            item.addValue(Fact.getNamedUUID(Fact.userIDName), userID, 0, transactionState)
            item.addValue(Fact.getNamedUUID(Fact.emailName), user.email, 0, transactionState)
            if user.first_name:
                item.addValue(Fact.getNamedUUID(Fact.firstNameName), user.first_name, 0, transactionState)
            if user.last_name:
                item.addValue(Fact.getNamedUUID(Fact.lastNameName), user.last_name, 0, transactionState)
            
            return item.id.hex

# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    LogRecord.emit(request.user, 'consentrecords/submitsignin', '')
    
    try:
        timezoneOffset = request.POST["timezoneoffset"]
    
        results = userviews.signinResults(request)
        if results["success"]:
            userID = UserFactory.getUserObjectID(request.user.id) or UserFactory.createUserObjectID(request.user, timezoneOffset)
            results["user"] = { "id": userID, "description" : request.user.get_full_name() }        
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
            userID = UserFactory.getUserObjectID(request.user.id) or UserFactory.createUserObjectID(request.user, timezoneOffset)
            results["user"] = { "id": userID, "description" : request.user.get_full_name() }
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
        
    return JsonResponse(results)

