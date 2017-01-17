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
from custom_user import views as userviews
from custom_user.emailer import Emailer
from consentrecords.models import *
from consentrecords import instancecreator
from consentrecords import pathparser
from consentrecords.userfactory import UserFactory

templateDirectory = 'consentrecords/'
logPrefix = ''
urlPrefix = ''

def handler404(request):
    response = render_to_response('404.html', {},
                                  context_instance=RequestContext(request))
    response.status_code = 404
    return response


def handler500(request):
    response = render_to_response('500.html', {},
                                  context_instance=RequestContext(request))
    response.status_code = 500
    return response

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
    
    args['state'] = 'settings/'
        
    context = RequestContext(request, args)
        
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
                if user.typeID_id != terms.user.id:
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
            if follower.typeID_id != terms.user.id:
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
                if len(objs) > 0 and objs[0].typeID_id == terms.user.id:
                    following = objs[0]
                    objs = pathparser.selectAllObjects(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(objs) > 0 and objs[0].typeID_id == terms.user.id:
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
                                firstNames = following.value_set.filter(field=terms['_first Name'],
                                                                   deleteTransaction__isnull=True)
                                firstName = firstNames.count() > 0 and firstNames[0].stringValue
                                
                                moreExperiences = following.getSubInstance(terms['Path'])
                                screenNames = moreExperiences and moreExperiences.value_set.filter(field=terms['_name'],
                                                                                                    deleteTransaction__isnull=True)
                                screenName = screenNames and screenNames.count() > 0 and screenNames[0].stringValue
                                
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

def requestExperienceComment(request):
    if request.method != "POST":
        raise Http404("requestExperienceComment only responds to POST methods")
    
    try:    
        language = None
        experienceID = request.POST["experience"]
        if terms.isUUID(experienceID):
            experiencePath = '#%s' % experienceID
        else:
            experiencePath = experienceID
            
        followerID = request.POST["path"]
        if terms.isUUID(followerID):
            followerPath = '#%s' % followerID
        else:
            followerPath = followerID
            
        question = request.POST["question"]
        if len(question) == 0:
            return HttpResponseBadRequest(reason="question text is not specified")
        
        if request.user.is_authenticated():
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())
            else:
                userInfo = UserInfo(request.user)
                objs = pathparser.selectAllObjects(experiencePath, userInfo=userInfo, securityFilter=userInfo.readFilter)
                if len(objs) > 0 and objs[0].typeID_id == terms['More Experience'].id:
                    experience = objs[0]
                    sourcePath = experience.parent
                    experienceValue = sourcePath.value_set.get(referenceValue=experience)
                    objs = pathparser.selectAllObjects(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(objs) > 0 and objs[0].typeID_id == terms['Path'].id:
                        follower = objs[0]
                        with transaction.atomic():
                            transactionState = TransactionState(request.user)
                            nameLists = NameList()
                        
                            commentsTerm = terms['Comments']
                            containerObject = experience.getSubInstance(commentsTerm)
                            if containerObject:
                                commentsValue = None
                                propertyList = {\
                                        'Comment Request': [{'cells': {\
                                            'Path': [{'instanceID': follower.id}],
                                            '_text': [{'text': question}],
                                           }}],
                                    }
                                item, v = instancecreator.create(terms['Comment'], 
                                    containerObject, terms['Comment'], -1, 
                                    propertyList, nameLists, transactionState)
        
                            else:
                                propertyList = {\
                                        'Comment': [{'cells': {\
                                            'Comment Request': [{'cells': {\
                                                'Path': [{'instanceID': follower.id}],
                                                '_text': [{'text': question}],
                                               }}],
                                            }}],
                                    }
                                item, commentsValue = instancecreator.create(commentsTerm, 
                                    experience, commentsTerm, -1, 
                                    propertyList, nameLists, transactionState)
                                containerObject = experience.getSubInstance(commentsTerm)
                                v = containerObject.getSubValue(terms['Comment'])
                                item = v.referenceValue
                            
                            Instance.updateDescriptions([item], nameLists)
                            
                            # Send an email to the following user.
                            protocol = "https://" if request.is_secure() else "http://"

                            # sendNewFollowerEmail(senderEMail, recipientEMail, follower, acceptURL, ignoreURL)
                            experienceUser = experience.parent.parent
                            recipientEMail = experienceUser.value_set.filter(field=terms.email,
                                                                        deleteTransaction__isnull=True)[0].stringValue
                            firstNames = experienceUser.value_set.filter(field=terms['_first Name'],
                                                               deleteTransaction__isnull=True)
                            firstName = firstNames.count() > 0 and firstNames[0].stringValue
                            
                            path = experienceUser.parent
                            screenNames = path and path.value_set.filter(field=terms['_name'],
                                                                         deleteTransaction__isnull=True)
                            screenName = screenNames and screenNames.count() > 0 and screenNames[0].stringValue
                            
                            Emailer.sendNewExperienceQuestionEmail(settings.PASSWORD_RESET_SENDER, 
                                screenName or firstName,
                                recipientEMail,
                                experienceValue,
                                follower,
                                question,
                                v,
                                protocol + request.get_host())
                        
                            
                            if commentsValue:
                                typeset = frozenset([terms['Comments'], terms['Comment'], terms['Comment Request'], ])
                                fieldsDataDictionary = FieldsDataDictionary(typeset, language)
                                vFilter = api._selectInstanceData(Value.objects.filter(id=commentsValue.id), [], 'referenceValue__', userInfo)
                                data = api._getValueData(vFilter[0], ['Comment/Comment Request'], fieldsDataDictionary, language, userInfo)
                                
                                # Get the new value along with its subdata (v, above, only has the value)
                                vFilter = api._selectInstanceData(Value.objects.filter(id=v.id), ['Comment Request'], 'referenceValue__', userInfo)
                                commentData = api._getValueData(vFilter[0], ['Comment Request'], fieldsDataDictionary, language, userInfo)
                                
                                data['cells'][0]['data'] = [commentData]
                                results = {'fields': fieldsDataDictionary.getData(), 'Comments': data}
                            else:
                                typeset = frozenset([terms['Comment'], terms['Comment Request'], ])
                                fieldsDataDictionary = FieldsDataDictionary(typeset, language)
                                # Get the new value along with its subdata (v, above, only has the value)
                                vFilter = api._selectInstanceData(Value.objects.filter(id=v.id), ['Comment Request'], 'referenceValue__', userInfo)
                                data = api._getValueData(vFilter[0], ['Comment Request'], fieldsDataDictionary, language, userInfo)
                                results = {'fields': fieldsDataDictionary.getData(), 'Comment': data}
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

class api:
    # Handle a POST event to create a new instance of an object with a set of properties.
    def createInstance(user, data):
        try:
            # The type of the new object.
            instanceType = data.get('typeName', None)
            instanceUUID = data.get('typeID', None)
            if instanceUUID:
                ofKindObject = Instance.objects.get(pk=instanceUUID)
            elif not instanceType:
                return HttpResponseBadRequest(reason="Type was not specified in createInstance")
            else:
                ofKindObject = terms[instanceType]
         
            # An optional container for the new object.
            containerUUID = data.get('containerUUID', None)
        
            # The element name for the type of element that the new object is to the container object
            elementName = data.get('elementName', None)
            elementUUID = data.get('elementUUID', None)
            if elementUUID:
                field = Instance.objects.get(pk=elementUUID)
            elif elementName:
                field = terms[elementName]
            elif instanceUUID:
                field = Instance.objects.get(pk=instanceUUID)
            elif instanceName: 
                field = terms[instanceName]
            
            # An optional set of properties associated with the object.
            propertyString = data.get('properties', None)
            propertyList = json.loads(propertyString)
        
            indexString = data.get('index', "-1")
            index = int(indexString)
        
            # The client time zone offset, stored with the transaction.
            languageID = None
            language = None
            
            userInfo = UserInfo(user)
            
            with transaction.atomic():
                transactionState = TransactionState(user)
                if containerUUID:
                    containerObject = Instance.objects.get(pk=containerUUID)
                else:
                    containerObject = None

                nameLists = NameList()
                item, newValue = instancecreator.create(ofKindObject, containerObject, field, index, propertyList, nameLists, transactionState)
    
                if newValue and newValue.isDescriptor:
                    Instance.updateDescriptions([item], nameLists)
    
                if containerObject:
                    results = {'object': newValue.getReferenceData(userInfo, language)}
                else:    
                    results = {'object': item.getReferenceData(userInfo, language)}
            
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)
    
    def checkForPath(c, user, pathKey, idKey):
        if pathKey in c:
            userInfo = UserInfo(user)
            instances = pathparser.selectAllObjects(c[pathKey], userInfo=userInfo, securityFilter=userInfo.findFilter)
            if len(instances) > 0:
                c[idKey] = instances[0].id
            else:
                raise RuntimeError("%s is not recognized" % pathKey)
           
    def updateValues(user, data):
        try:
            commandString = data.get('commands', "[]")
            commands = json.loads(commandString)
        
            valueIDs = []
            instanceIDs = []
            nameLists = NameList()
            descriptionQueue = []
            
            with transaction.atomic():
                transactionState = TransactionState(user)
                for c in commands:
                    instanceID = None
                    if "id" in c:
                        oldValue = Value.objects.get(pk=c["id"],deleteTransaction__isnull=True)
                        oldValue.checkWriteAccess(user)

                        container = oldValue.instance

                        api.checkForPath(c, user, "instance", "instanceID")
                        
                        if oldValue.isDescriptor:
                            descriptionQueue.append(container)
                        
                        if oldValue.hasNewValue(c):
                            container.checkWriteValueAccess(user, oldValue.field, c["instanceID"] if "instanceID" in c else None)
                            item = oldValue.updateValue(c, transactionState)
                            instanceID = item.referenceValue_id
                        else:
                            oldValue.deepDelete(transactionState)
                            item = None
                    elif "containerUUID" in c or "container" in c:
                        api.checkForPath(c, user, "container", "containerUUID")
                        container = Instance.objects.get(pk=c["containerUUID"],deleteTransaction__isnull=True)

                        if "field" in c:
                            field = terms[c["field"]]
                        else:
                            field = Instance.objects.get(pk=c["fieldID"],deleteTransaction__isnull=True)
                        
                        if "index" in c:
                            newIndex = container.updateElementIndexes(field, int(c["index"]), transactionState)
                        else:
                            newIndex = container.getNextElementIndex(field)
                        
                        api.checkForPath(c, user, "instance", "instanceID")
                        instanceID = c["instanceID"] if "instanceID" in c else None

                        container.checkWriteValueAccess(user, field, instanceID)

                        if "ofKindID" in c:
                            ofKindObject = Instance.objects.get(pk=c["ofKindID"],deleteTransaction__isnull=True)
                            newInstance, item = instancecreator.create(ofKindObject, container, field, newIndex, c, nameLists, transactionState)
                            instanceID = newInstance.id
                        else:
                            item = container.addValue(field, c, newIndex, transactionState)
                            instanceID = item.referenceValue_id
                            
                        if item.isDescriptor:
                            descriptionQueue.append(container)
                    else:
                        raise ValueError("subject id was not specified")
                    valueIDs.append(item.id if item else None)
                    instanceIDs.append(instanceID)
                                
                Instance.updateDescriptions(descriptionQueue, nameLists)
                
                results = {'valueIDs': valueIDs, 'instanceIDs': instanceIDs}
            
            return JsonResponse(results)
        
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))

    def selectAll(user, data):
        try:
            path = data.get("path", None)
            start = int(data.get("start", "0"))
            end = int(data.get("end", "0"))
            userInfo = UserInfo(user)
            language=None
        
            if not path:
                raise ValueError("path was not specified")
        
            uuObjects = pathparser.selectAllObjects(path, userInfo=userInfo, securityFilter=userInfo.findFilter)\
                            .select_related('description')\
                            .order_by('description__text', 'id')
            
            if end > 0:
                uuObjects = uuObjects[start:end]
            elif start > 0:
                uuObjects = uuObjects[start:]
            
            p = [i.getReferenceData(userInfo, language) for i in uuObjects]                                                
            results = {'objects': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)

    # Returns an iterable of the values within self associated with the specified field.
    # If value is specified, then filter the returned values according to the value. Otherwise,
    # return all of the values.       
    def _findValues(instance, field, value, fieldNames, userInfo):
        f = instance.value_set.filter(deleteTransaction__isnull=True, field=field)
        if value:
            return f.filter(Q(stringValue=value)|Q(referenceValue_id=value))
        else:
            return api._selectInstanceData(f, fieldNames, 'referenceValue__', userInfo)\
                      .order_by('position');
        
    
    # getValues is used to test whether or not a particular value exists in a field of any
    # instance with the specified path.    
    def getValues(user, data):
        try:
            path = data.get("path", None)
            if not path:
                raise ValueError('the path was not specified')
                
            fieldString = data.get('fields', "[]")
            fields = json.loads(fieldString)
            
            language = data.get('language', None)

            userInfo = UserInfo(user)
        
            # The element name for the type of element that the new value is to the container object
            fieldName = data.get('fieldName', None)
        
            if fieldName is None:
                raise ValueError('the fieldName was not specified')
            elif terms.isUUID(fieldName):
                field = Instance.objects.get(pk=fieldName, deleteTransaction__isnull=True)
            else:
                field = terms[fieldName]
            
            # An optional value within the container on which to filter.
            value = data.get('value', None)
        
            containers = pathparser.selectAllObjects(path=path, userInfo=userInfo, securityFilter=userInfo.findFilter)
            m = map(lambda i: api._findValues(i, field, value, fields, userInfo), containers)

            m = list(itertools.chain.from_iterable(m))
            typeIDs = [v.referenceValue.typeID_id for v in m]
            typeIDs.extend(map(lambda c: c.typeID_id, containers))
            typeset = frozenset(typeIDs)
            fieldsDataDictionary = FieldsDataDictionary(typeset, language)
            if len(fields) == 0:
                p = map(lambda v: v.getReferenceData(userInfo, language=language), m)
            else:
                # iterate through the list so that fieldsDataDictionary is populated.
                p = list(map(lambda v: api._getValueData(v, fields, fieldsDataDictionary, language, userInfo), m))
            
            results = {'fields': fieldsDataDictionary.getData(), 'values': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)
        
    def getConfiguration(user, data):
        try:
            # Get the uuid for the configuration.
            typeName = data.get('typeName', None)
            typeUUID = data.get('typeID', None)
            if typeUUID:
                kindObject = Instance.objects.get(pk=typeUUID)
            elif typeName:
                kindObject = terms[typeName]
            else:
                raise ValueError("typeName was not specified in getConfiguration")
        
            configurationObject = kindObject.getSubInstance(terms.configuration)
        
            if not configurationObject:
                raise ValueError("objects of this kind have no configuration object")
                
            p = configurationObject.getConfiguration()
        
            results = {'cells': p}
        except Instance.DoesNotExist:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason="the specified instanceType was not recognized")
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)

    def getUserID(user, data):
        accessTokenID = data.get('access_token', None)
    
        try:
            if not accessTokenID:
                raise ValueError("the access token is not specified")
            accessToken = AccessToken.objects.get(token=accessTokenID)
        
            userID = Instance.getUserInstance(accessToken.user).id
            results = {'userID': userID}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)
    
    def _getValueQuerySet(vs, userInfo):
        return userInfo.findValueFilter(vs.filter(deleteTransaction__isnull=True))\
                .order_by('position')\
                .select_related('referenceValue')\
                .select_related('referenceValue__description')
    
    def _getCells(uuObject, fields, fieldsDataDictionary, language, userInfo):
        fieldsData = fieldsDataDictionary[uuObject.typeID_id]
        cells = uuObject.getData(uuObject.values, fieldsData, userInfo, language)
    
        if 'parents' in fields:
            p = uuObject
            while p.parent_id:
                p = Instance.objects\
                                .select_related('description')\
                                .get(pk=p.parent_id)
                
                fieldData = next((field for field in fieldsData if field["id"] == "parent/" + p.typeID_id), None)
                if not fieldData:
                    fieldData = Instance.getParentReferenceFieldData(userInfo, p.typeID_id)
                    fieldsData.append(fieldData)
            
                parentData = p.getReferenceData(userInfo, language)
                parentData['position'] = 0
                if fieldData["name"] in fields:
                    vs = api._getValueQuerySet(p.value_set, userInfo)
                    parentData['cells'] = p.getData(vs, fieldsDataDictionary[p.typeID_id], userInfo, language)
                    
                cells.append({"field": fieldData["id"], "data": [parentData]})
        
        if TermNames.systemAccess in fields:
            if userInfo.authUser.is_superuser:
                saObject = terms.administerPrivilegeEnum
            elif userInfo.authUser.is_staff:
                saObject = terms.writePrivilegeEnum
            else:
                saObject = None
            if saObject:
                fieldData = next((field for field in fieldsData if field["id"] == terms.systemAccess.id), None)
                if not fieldData:
                    fieldData = Instance.getParentReferenceFieldData(userInfo, terms.systemAccess.id)
                    fieldsData.append(fieldData)
                parentData = [{'id': None, 
                              'instanceID' : saObject.id,
                              'description': saObject.getDescription(language),
                              'position': 0,
                              'privilege': saObject.description.text}]
                cells.append({"field": fieldData["id"], "data": parentData})
                
        # For each of the cells, if the cell is in the field list explicitly, 
        # and the cell is in the fieldsData (and not the name of a parent type)
        # then get the subdata for all of the values in that cell.
        subValuesDict = None
        for cell in cells:
            fieldData = next((field for field in fieldsData if field["id"] == cell["field"]), None)
            if not fieldData:
                raise "fieldData is not found"
            
            if fieldData["name"] in fields and fieldData["name"] != TermNames.systemAccess \
                and "ofKindID" in fieldData \
                and next((field for field in fieldsData if field["nameID"] == fieldData["nameID"]), None):
                
                subFieldsData = fieldsDataDictionary[fieldData["ofKindID"]]
                subValuesDict = subValuesDict or \
                                dict((s.id, s) for s in filter(lambda s: s, map(lambda v: v.referenceValue, uuObject.values)))  
                for d in cell["data"]:
                    i = subValuesDict[d["instanceID"]]
                    d['cells'] = i.getData(i.subValues, subFieldsData, userInfo, language)
                    d['typeName'] = fieldData["ofKind"]
        return cells

    def _getInstanceData(uuObject, fields, fieldsDataDictionary, language, userInfo):
        data = uuObject.getReferenceData(userInfo, language)
        data['cells'] = api._getCells(uuObject, fields, fieldsDataDictionary, language, userInfo)
        return data;
    
    def _getValueData(v, fields, fieldsDataDictionary, language, userInfo):
        data = v.getReferenceData(userInfo, language=language)
        data['cells'] = api._getCells(v.referenceValue, fields, fieldsDataDictionary, language, userInfo)
        return data
    
    # instanceDataPath is the django query path from the sourceFilter objects to the 
    # data to be selected.
    def _selectInstanceData(sourceFilter, fieldNames, instanceDataPath, userInfo):
        # preload the typeID, parent, value_set and description to improve performance.
        # For each field that is in the fields list, also preload its field, referenceValue and referenceValue__description.
        valueQueryset = api._getValueQuerySet(Value.objects, userInfo)

        if len(fieldNames):
            # The distinct is required to eliminate duplicate subValues.
            subValues = Value.objects.filter(instance__deleteTransaction__isnull=True,
                                      instance__referenceValues__deleteTransaction__isnull=True,
                                      instance__referenceValues__field__description__text__in=fieldNames)\
                .distinct()
            subValueQueryset = api._getValueQuerySet(subValues, userInfo)
            valueQueryset =  valueQueryset.prefetch_related(Prefetch('referenceValue__value_set',
                                  queryset=subValueQueryset,
                                  to_attr='subValues'))

        return sourceFilter.select_related(instanceDataPath + 'description')\
                           .prefetch_related(Prefetch(instanceDataPath + 'value_set',
                                                        queryset=valueQueryset,
                                                        to_attr='values'))
            
        
    def getData(user, path, data):
        try:
            start = int(data.get("start", "0"))
            end = int(data.get("end", "0"))
        
            if not path:
                raise ValueError("path was not specified in getData")
            
            fieldString = data.get('fields', "[]")
            fields = json.loads(fieldString)
            
            userInfo=UserInfo(user)
            
            fieldNames = filter(lambda s: s != TermNames.systemAccess and s != 'parents' and s != 'type', fields)
            fieldNames = list(fieldNames)
            
            uuObjects = pathparser.selectAllObjects(path=path, userInfo=userInfo, securityFilter=userInfo.readFilter)
            uuObjects = api._selectInstanceData(uuObjects, fieldNames, '', userInfo)
            uuObjects = uuObjects.order_by('description__text', 'id');
            if end > 0:
                uuObjects = uuObjects[start:end]
            elif start > 0:
                uuObjects = uuObjects[start:]
                                                            
            language = data.get('language', None)
            typeset = frozenset([x.typeID_id for x in uuObjects])
            fieldsDataDictionary = FieldsDataDictionary(typeset, language)
            
            p = [api._getInstanceData(uuObject, fields, fieldsDataDictionary, language, userInfo) for uuObject in uuObjects]        
        
            results = {'fields': fieldsDataDictionary.getData(), 'data': p}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData data:%s" % str(data))
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)
        
    # This should only be done for root instances. Otherwise, the value should
    # be deleted, which will delete this as well.
    def deleteInstances(user, path):
        try:
            if path:
                with transaction.atomic():
                    transactionState = TransactionState(user)
                    descriptionCache = []
                    nameLists = NameList()
                    userInfo=UserInfo(user)
                    for uuObject in pathparser.selectAllObjects(path, userInfo=userInfo, securityFilter=userInfo.administerFilter):
                        if uuObject.parent:
                            raise RuntimeError("can only delete root instances directly")
                        uuObject.deleteOriginalReference(transactionState)
                        uuObject.deepDelete(transactionState)
            else:   
                raise ValueError("path was not specified in delete")
            results = {}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)
        
    def deleteValue(user, data):
        try:
            valueID = data.get('valueID', None)
        
            if valueID:
                v = Value.objects.get(pk=valueID, deleteTransaction__isnull=True)

                with transaction.atomic():
                    v.checkWriteAccess(user)
                    
                    transactionState = TransactionState(user)
                    v.deepDelete(transactionState)
                    
                    if v.isDescriptor:
                        nameLists = NameList()
                        Instance.updateDescriptions([v.instance], nameLists)
            else:   
                raise ValueError("valueID was not specified in delete")
            results = {}
        except Value.DoesNotExist:
            return HttpResponseBadRequest(reason="the specified value ID was not recognized")
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)

def createInstance(request):
    if request.method != "POST":
        raise Http404("createInstance only responds to POST methods")
    
    if not request.user.is_authenticated():
        raise PermissionDenied
    
    return api.createInstance(request.user, request.POST)
    
def updateValues(request):
    if request.method != "POST":
        raise Http404("updateValues only responds to POST methods")
    
    if not request.user.is_authenticated():
        raise PermissionDenied
    
    return api.updateValues(request.user, request.POST)
    
def deleteInstances(request):
    if request.method != "POST":
        raise Http404("deleteInstances only responds to POST methods")
    
    if not request.user.is_authenticated():
        raise PermissionDenied
        
    return api.deleteInstances(request.user, request.POST.get('path', None))
    
def deleteValue(request):
    if request.method != "POST":
        raise Http404("deleteValue only responds to POST methods")
    
    if not request.user.is_authenticated():
        raise PermissionDenied
    
    return api.deleteValue(request.user, request.POST)
    
def selectAll(request):
    if request.method != "GET":
        raise Http404("selectAll only responds to GET methods")
    
    return api.selectAll(request.user, request.GET)
    
def getValues(request):
    if request.method != "GET":
        raise Http404("getValues only responds to GET methods")
    
    return api.getValues(request.user, request.GET)
    
def getConfiguration(request):
    if request.method != "GET":
        raise Http404("getConfiguration only responds to GET methods")
    
    return api.getConfiguration(request.user, request.GET)
    
def getUserID(request):
    if request.method != "GET":
        raise Http404("getUserID only responds to GET methods")
    
    return api.getUserID(request.user, request.GET)

def getData(request):
    if request.method == 'GET':
        return api.getData(request.user, request.GET.get('path', None), request.GET)
    else:
        raise Http404("getData only responds to GET methods")

def handleURL(request, urlPath):
    if request.method == 'GET':
        return api.getData(request.user, urlPath, request.GET)
    elif request.method == 'DELETE':
        if not request.user.is_authenticated():
            raise PermissionDenied
        return api.deleteInstances(request.user, urlPath)
    else:
        raise Http404("api only responds to GET methods")

class ApiEndpoint(ProtectedResourceView):
    def get(self, request, *args, **kwargs):
        if request.path_info == '/api/getdata/':
            return getData(request)
        elif request.path_info == '/api/getconfiguration/':
            return getConfiguration(request)
        elif request.path_info == '/api/selectall/':
            return selectAll(request)
        elif request.path_info == '/api/getvalues/':
            return getValues(request)
        return HttpResponseNotFound(reason='unrecognized url')
        
    def post(self, request, *args, **kwargs):
        if request.path_info == '/api/createinstance/':
            return createInstance(request)
        elif request.path_info == '/api/updatevalues/':
            return updateValues(request)
        elif request.path_info == '/api/deleteinstances/':
            return deleteInstances(request)
        elif request.path_info == '/api/deletevalues/':
            return deleteValues(request)
        return HttpResponseNotFound(reason='unrecognized url')
    
class ApiGetUserIDEndpoint(ProtectedResourceView):
    def get(self, request, *args, **kwargs):
        return getUserID(request)
        
# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    if request.method != "POST":
        raise Http404("submitsignin only responds to POST methods")
    
    try:
        results = userviews.signinResults(request)
        user = Instance.getUserInstance(request.user) or UserFactory.createUserInstance(request.user, None)
        results["user"] = { "instanceID": user.id, "description" : user.getDescription(None) }        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

def submitNewUser(request):
    if request.method != "POST":
        raise Http404("submitNewUser only responds to POST methods")
    
    try:
        # An optional set of properties associated with the object.
        propertyString = request.POST.get('properties', "")
        propertyList = json.loads(propertyString)
    
        with transaction.atomic():
            results = userviews.newUserResults(request)
            userInstance = Instance.getUserInstance(request.user) or UserFactory.createUserInstance(request.user, propertyList)
            results["user"] = { "instanceID": userInstance.id, "description" : userInstance.getDescription(None) }
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

def updateUsername(request):
    if request.method != "POST":
        raise Http404("updateUsername only responds to POST methods")
    
    try:
        with transaction.atomic():
            results = userviews.updateUsernameResults(request)
            userInstance = Instance.getUserInstance(request.user)
            transactionState = TransactionState(request.user)
            v = userInstance.getSubValue(terms.email)
            v.updateValue({"text": request.user.email}, transactionState)
            nameLists = NameList()
            userInstance.cacheDescription(nameLists);
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

def features(request):
    template = loader.get_template('doc/features.html')
    context = RequestContext(request, {
    })
        
    return HttpResponse(template.render(context))

