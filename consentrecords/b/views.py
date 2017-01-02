from django.conf import settings
from django.db import transaction, connection
from django.db.models import F, Q, Prefetch
from django.http import HttpResponse, JsonResponse, Http404, HttpResponseBadRequest, HttpResponseServerError
from django.shortcuts import render, redirect, render_to_response
from django.template import RequestContext, loader
from django.views.decorators.csrf import requires_csrf_token, ensure_csrf_cookie
from django.core.exceptions import PermissionDenied

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
import itertools

from monitor.models import LogRecord
from custom_user.emailer import Emailer
from consentrecords.models import *
from consentrecords import instancecreator
from consentrecords import pathparser
from consentrecords.userfactory import UserFactory

templateDirectory = 'b/consentrecords/'
logPrefix = 'b/'
urlPrefix = 'b/'

def logPage(request, name):
    try:
        userAgent = request.META['HTTP_USER_AGENT']
    except Exception:
        userAgent = 'Unspecified user agent'
        
    LogRecord.emit(request.user, logPrefix + name, userAgent)

@ensure_csrf_cookie
def home(request):
    logPage(request, 'pathAdvisor/home')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    state = request.GET.get('state', None)
    if state:
        args['state'] = state

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def showLines(request):
    logPage(request, 'pathAdvisor/showLines')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = "me"

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def orgHome(request):
    logPage(request, 'pathAdvisor/orgHome')
    
    template = loader.get_template(templateDirectory + 'orgHome.html')
    args = {
        'user': request.user,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    state = request.GET.get('state', None)
    if state:
        args['state'] = state

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def find(request):
    logPage(request, 'pathAdvisor/find')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        args['userID'] = Instance.getUserInstance(request.user).id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    # Currently, findNewExperience can support a serviceID and an offeringID. ultimately,
    # we want to pass a path to make this more RESTful.
    args['state'] = "findNewExperience"
    
    if settings.FACEBOOK_SHOW:
        offering = Instance.objects.get(pk=offeringid)
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = offering._description
        args['fbDescription'] = offering.parent and offering.parent.parent and offering.parent.parent._description

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def showInstances(request):
    logPage(request, 'pathAdvisor/list')
    
    try:
        # The type of the root object.
        rootType = request.GET.get('type', None)
        root = rootType and terms[rootType];
        path=request.GET.get('path', "_term")
        header=request.GET.get('header', "List")
            
        template = loader.get_template(templateDirectory + 'configuration.html')
    
        argList = {
            'user': request.user,
            'canShowObjects': request.user.is_staff,
            'canAddObject': request.user.is_staff,
            'path': urllib.parse.unquote_plus(path),
            'header': header,
            }
        if root:
            argList["rootID"] = root.id
            argList["singularName"] = root._description
        
        if request.user.is_authenticated():
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponse("user is not set up: %s" % request.user.get_full_name())
            argList['userID'] = user.id
        
        context = RequestContext(request, argList)
        
        return HttpResponse(template.render(context))
    except Exception as e:
        return HttpResponse(str(e))

@ensure_csrf_cookie
def showPathway(request, email):
    logPage(request, 'pathAdvisor/showPathway')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = '_user[_email=%s]' % email
    userInfo = UserInfo(request.user)
    objs = pathparser.selectAllObjects(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(objs) > 0:
        args['state'] = 'user/%s' % objs[0].id

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def showExperience(request, id):
    logPage(request, 'pathAdvisor/experience')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    if terms.isUUID(id):
        args['state'] = 'experience/%s/' % id
        pathend = re.search(r'experience/%s/' % id, request.path).end()
        path = request.path[pathend:]

        if re.match(r'comments/*', path, re.I):
            args['state'] += 'comments/'
        elif re.match(r'comment/.*', path, re.I):
            args['state'] += 'comment/'
            path = path[len('comment/'):]
            if re.match(r'[A-Fa-f0-9]{32}/', path):
                args['state'] += path[:33]
                path = path[33:]

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def accept(request, email):
    LogRecord.emit(request.user, 'pathAdvisor/accept', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = ('#%s' if terms.isUUID(email) else '_user[_email=%s]') % email
    userInfo = UserInfo(request.user)
    objs = pathparser.selectAllObjects(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(objs) > 0:
        args['state'] = 'accept'
        args['follower'] = objs[0].id
        args['cell'] = '_user'
        args['privilege'] = terms.readPrivilegeEnum.id

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def ignore(request, email):
    LogRecord.emit(request.user, 'pathAdvisor/ignore', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = ('#%s' if terms.isUUID(email) else '_user[_email=%s]') % email
    userInfo = UserInfo(request.user)
    objs = pathparser.selectAllObjects(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(objs) > 0:
        args['state'] = 'ignore'
        args['follower'] = objs[0].id
        args['follower_description'] = objs[0].getDescription()
        
    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def userSettings(request):
    LogRecord.emit(request.user, 'pathAdvisor/userSettings/', None)
    
    print ('1')
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    print ('2')
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    print ('3')
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'settings/'
        
    print ('4')
    context = RequestContext(request, args)
        
    print ('5')
    return HttpResponse(template.render(context))

@ensure_csrf_cookie
def signup(request, email=None):
    LogRecord.emit(request.user, 'pathAdvisor/ignore', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    if email:
        args['state'] = 'signup/%s' % email
    else:
        args['state'] = 'signup/'
        
    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

def acceptFollower(request, userPath=None):
    if request.method != "POST":
        raise Http404("acceptFollower only responds to POST methods")
    
    try:    
        language = None
        followerID = request.POST["follower"]
        privilegeID = request.POST["privilege"]
        
        if terms.isUUID(followerID):
            followerPath = '#%s' % followerID
        else:
            followerPath = followerID
        
        if not request.user.is_authenticated():
            return HttpResponseBadRequest(reason="user is not authenticated")
            
        userInfo = UserInfo(request.user)
        if userPath:
            users = pathparser.selectAllObjects(userPath, userInfo=userInfo, securityFilter=userInfo.administerFilter)
            if len(users):
                user = users[0]
                if user.typeID != terms.user:
                    return HttpResponseBadRequest(reason="item to accept follower is not a user: %s" % userPath)
            else:
                return HttpResponseBadRequest(reason="user is not recognized: %s" % userPath)
        else:
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())

        objs = pathparser.selectAllObjects(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
        if len(objs) > 0:
            follower = objs[0]
            if follower.typeID == terms.user:
                followerField = terms.user
            else:
                followerField = terms.group
            ars = user.value_set.filter(field=terms['_access record'],
                                  deleteTransaction__isnull=True) \
                          .filter(referenceValue__value__field=followerField,
                                  referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__referenceValue_id=follower.id)
            if ars.count():
                return HttpResponseBadRequest(reason='%s is already following you' % follower.description.text)
            else:
                with transaction.atomic():
                    transactionState = TransactionState(request.user)
                    nameLists = NameList()
                    try:
                        ar = user.value_set.filter(field=terms['_access record'],
                                                   deleteTransaction__isnull=True) \
                                     .get(referenceValue__value__field=terms['_privilege'],
                                          referenceValue__value__deleteTransaction__isnull=True,
                                          referenceValue__value__referenceValue_id=privilegeID).referenceValue
                        newValue = ar.addReferenceValue(followerField, follower, ar.getNextElementIndex(followerField), transactionState)
                    except Value.DoesNotExist:
                        ar, newValue = instancecreator.create(terms['_access record'], user, terms['_access record'], user.getNextElementIndex(terms['_access record']), 
                            {'_privilege': [{'instanceID': privilegeID}],
                             followerField.getDescription(): [{'instanceID': follower.id}]}, nameLists, transactionState)
    
                    # Remove any corresponding access requests.
                    vs = user.value_set.filter(field=terms['_access request'],
                                           deleteTransaction__isnull=True,
                                           referenceValue_id=follower.id)
                    for v in vs:
                        v.deepDelete(transactionState)
                
                    data = newValue.getReferenceData(userInfo, language)
                    results = {'object': data} 
        else:
            raise RuntimeError('the user or group to accept is unrecognized')
            
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

def requestAccess(request):
    if request.method != "POST":
        raise Http404("requestAccess only responds to POST methods")
    
    try:    
        language = None
        followingID = request.POST["following"]
        if terms.isUUID(followingID):
            followingPath = '#%s' % followingID
        else:
            followingPath = followingID
            
        followerID = request.POST["follower"]
        if terms.isUUID(followerID):
            followerPath = '#%s' % followerID
        else:
            followerPath = followerID
        
        if request.user.is_authenticated():
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())
            else:
                userInfo = UserInfo(request.user)
                objs = pathparser.selectAllObjects(followingPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                if len(objs) > 0 and objs[0].typeID == terms.user:
                    following = objs[0]
                    objs = pathparser.selectAllObjects(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(objs) > 0 and objs[0].typeID == terms.user:
                        follower = objs[0]
                        fieldTerm = terms['_access request']
                        ars = following.value_set.filter(field=fieldTerm,
                                                         deleteTransaction__isnull=True,
                                                         referenceValue_id=follower.id)
                        if ars.count():
                            if follower == user:
                                error = 'You have already requested to follow %s.' % following.description.text
                            else:
                                error = 'There is already a request for %s to follow %s.' % (follower.description.text, following.description.text)
                            raise RuntimeError(error)
                        else:
                            with transaction.atomic():
                                transactionState = TransactionState(request.user)
                                nameLists = NameList()
                            
                                v = following.addReferenceValue(fieldTerm, follower, following.getNextElementIndex(fieldTerm), transactionState)
            
                                data = v.getReferenceData(userInfo, language)
                            
                                # Send an email to the following user.
                                protocol = "https://" if request.is_secure() else "http://"

                                # sendNewFollowerEmail(senderEMail, recipientEMail, follower, acceptURL, ignoreURL)
                                recipientEMail = following.value_set.filter(field=terms.email,
                                                                            deleteTransaction__isnull=True)[0].stringValue
                                firstNames = following.value_set.filter(field=terms['First Name'],
                                                                   deleteTransaction__isnull=True)
                                firstName = firstNames.count() > 0 and firstNames[0]
                                
                                moreExperiences = following.getSubInstance(terms['Path'])
                                screenNames = moreExperiences and moreExperiences.value_set.filter(field=terms['Screen Name'],
                                                                                                    deleteTransaction__isnull=True)
                                screenName = screenNames and screenNames.count() > 0 and screenNames[0]
                                
                                Emailer.sendNewFollowerEmail(settings.PASSWORD_RESET_SENDER, 
                                    screenName or firstName,
                                    recipientEMail, 
                                    follower.getDescription(),
                                    protocol + request.get_host() + settings.ACCEPT_FOLLOWER_PATH + follower.id,
                                    protocol + request.get_host() + settings.IGNORE_FOLLOWER_PATH + follower.id)
                            
                                results = {'object': data}
                    else:
                        raise RuntimeError('the requestor is unrecognized')
                else:
                    raise RuntimeError('the user to follow is unrecognized')
        else:
            return HttpResponseBadRequest(reason="user is not authenticated")
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

@ensure_csrf_cookie
def addExperience(request, experienceID):
    LogRecord.emit(request.user, 'pathAdvisor/addExperience', experienceID)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }
    
    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'addExperience%s' % experienceID

    context = RequestContext(request, args)
        
    return HttpResponse(template.render(context))

def _getOrganizationChildren(organization, siteName, offeringName):
    site = None
    offering = None
    if siteName:
        sites = organization.getSubInstance(terms['Sites']).getChildrenByName(terms['Site'], terms.name, siteName)
        site = sites[0].referenceValue if len(sites) else None
        if site and offeringName:
            offerings = site.getSubInstance(terms['Offerings']).getChildrenByName(terms['Offering'], terms.name, offeringName)
            offering = offerings[0].referenceValue if len(offerings) else None
            
    return site, offering

@ensure_csrf_cookie
def addToPathway(request):
    LogRecord.emit(request.user, 'pathAdvisor/addToPathway', str(request.user))
    
    organizationName = request.GET.get('o', None)
    siteName = request.GET.get('s', None)
    offeringName = request.GET.get('f', None)
    serviceName = request.GET.get('m', None)

    userInfo = UserInfo(request.user)

    if offeringName and terms.isUUID(offeringName):
        offering = terms[offeringName]
    elif siteName and terms.isUUID(siteName):
        site = terms[siteName]
        if offeringName:
            offerings = site.getChildrenByName(terms['Offering'], terms.name, offeringName)
            offering = offerings[0] if len(offerings) else None
    elif organizationName and terms.isUUID(organizationName):
        organization = terms[organizationName]
        site, offering = _getOrganizationChildren(organization, siteName, offeringName)
    elif organizationName:
        organization = terms['Organization'].getInstanceByName(terms.name, organizationName, userInfo)
        if organization:
            site, offering = _getOrganizationChildren(organization, siteName, offeringName)
        else:
            site, offering = None, None
    else:
        organization, site, offering = None, None, None

    if serviceName and terms.isUUID(serviceName):
        try:
            service = terms[serviceName]
        except Instance.DoesNotExist:
            service = None
    elif serviceName:
        service = terms['Service'].getInstanceByName(terms.name, serviceName, userInfo)
    else:
        service = None
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
    }

    if settings.FACEBOOK_SHOW:
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = 'Add %s'%(offeringName if offeringName else serviceName if serviceName else 'Experience')
        atText = (organizationName if organizationName == siteName else \
                ('%s//%s' % (organizationName, siteName)) if siteName else organizationName)
        args['fbDescription'] = atText

    if organizationName:
        args['organization'] = organization.id if organization else organizationName
    if siteName:
        args['site'] = site.id if site else siteName
    if offeringName:
        args['offering'] = offering.id if offering else offeringName
    if serviceName:
        args['service'] = service.id if service else serviceName

    if request.user.is_authenticated():
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id
    
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True

    args['state'] = 'addToPathway'

    context = RequestContext(request, args)
    
    return HttpResponse(template.render(context))

