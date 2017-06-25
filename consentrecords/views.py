from django.conf import settings
from django.db import transaction, connection
from django.db.models import F, Q, Prefetch
from django.http import HttpResponse, JsonResponse, Http404, HttpResponseBadRequest, HttpResponseServerError
from django.shortcuts import render, redirect, render_to_response
from django.template import RequestContext, loader
from django.views import View
from django.views.decorators.csrf import requires_csrf_token, ensure_csrf_cookie
from django.core.exceptions import PermissionDenied

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
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    state = request.GET.get('state', None)
    if state:
        args['state'] = state

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def showLines(request):
    logPage(request, 'pathAdvisor/showLines')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = "me"

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def orgHome(request):
    logPage(request, 'pathAdvisor/orgHome')
    
    template = loader.get_template(templateDirectory + 'orgHome.html')
    args = {
        'user': request.user,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    state = request.GET.get('state', None)
    if state:
        args['state'] = state

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def find(request):
    logPage(request, 'pathAdvisor/find')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        args['userID'] = Instance.getUserInstance(request.user).idString
        
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

    return HttpResponse(template.render(args))

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
            'jsversion': settings.JS_VERSION,
            'canShowObjects': request.user.is_staff,
            'canAddObject': request.user.is_staff,
            'path': urllib.parse.unquote_plus(path),
            'header': header,
            }
        if root:
            argList["rootID"] = root.idString
            argList["singularName"] = root._description
        
        if request.user.is_authenticated:
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponse("user is not set up: %s" % request.user.get_full_name())
            argList['userID'] = user.idString
        
        return HttpResponse(template.render(argList))
    except Exception as e:
        return HttpResponse(str(e))

@ensure_csrf_cookie
def showPathway(request, email):
    logPage(request, 'pathAdvisor/showPathway')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = 'user[email=%s]' % email
    userInfo = UserInfo(request.user)
    objs = pathparser.getQuerySet(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(objs) > 0:
        args['state'] = 'user/%s' % objs[0].idString

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def showExperience(request, id):
    logPage(request, 'pathAdvisor/experience')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
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

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def accept(request, email):
    LogRecord.emit(request.user, 'pathAdvisor/accept', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = ('#%s' if terms.isUUID(email) else 'user[email=%s]') % email
    userInfo = UserInfo(request.user)
    objs = pathparser.getQuerySet(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(objs) > 0:
        args['state'] = 'accept'
        args['follower'] = objs[0].idString
        args['cell'] = TermNames.user
        args['privilege'] = terms.readPrivilegeEnum.idString

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def ignore(request, email):
    LogRecord.emit(request.user, 'pathAdvisor/ignore', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = ('#%s' if terms.isUUID(email) else 'user[email=%s]') % email
    userInfo = UserInfo(request.user)
    objs = pathparser.getQuerySet(containerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(objs) > 0:
        args['state'] = 'ignore'
        args['follower'] = objs[0].idString
        args['follower_description'] = objs[0].getDescription()
        
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def userSettings(request):
    LogRecord.emit(request.user, 'pathAdvisor/userSettings/', None)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'settings/'
        
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def signup(request, email=None):
    LogRecord.emit(request.user, 'pathAdvisor/ignore', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
    }
    
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    if email:
        args['state'] = 'signup/%s' % email
    else:
        args['state'] = 'signup/'
        
    return HttpResponse(template.render(args))

def acceptFollower(request, userPath=None):
    if request.method != "POST":
        raise Http404("acceptFollower only responds to POST methods")
    
    try:    
        language = None
        followerPath = request.POST["follower"]
        privilegeID = request.POST["privilege"]
        
        if not request.user.is_authenticated:
            return HttpResponseBadRequest(reason="user is not authenticated")
            
        userInfo = UserInfo(request.user)
        if userPath:
            users = pathparser.getQuerySet(userPath, userInfo=userInfo, securityFilter=userInfo.administerFilter)
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

        objs = pathparser.getQuerySet(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
        if len(objs) > 0:
            follower = objs[0]
            if follower.typeID_id == terms.user.id:
                followerField = terms.user
            else:
                followerField = terms.group
            ars = user.value_set.filter(field=terms.accessRecord,
                                  deleteTransaction__isnull=True) \
                          .filter(referenceValue__value__field=followerField,
                                  referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__referenceValue_id=follower.id)
            if ars.exists():
                return HttpResponseBadRequest(reason='%s is already following you' % follower.description.text)
            else:
                with transaction.atomic():
                    transactionState = TransactionState(request.user)
                    nameLists = NameList()
                    try:
                        ar = user.value_set.filter(field=terms.accessRecord,
                                                   deleteTransaction__isnull=True) \
                                     .get(referenceValue__value__field=terms.privilege,
                                          referenceValue__value__deleteTransaction__isnull=True,
                                          referenceValue__value__referenceValue_id=privilegeID).referenceValue
                        newValue = ar.addReferenceValue(followerField, follower, ar.getNextElementIndex(followerField), transactionState)
                    except Value.DoesNotExist:
                        ar, newValue = instancecreator.create(terms.accessRecord, user, terms.accessRecord, user.getNextElementIndex(terms.accessRecord), 
                            {TermNames.privilege: [{'instanceID': privilegeID}],
                             followerField.getDescription(): [{'instanceID': follower.idString}]}, nameLists, userInfo, transactionState)
    
                    # Remove any corresponding access requests.
                    vs = user.value_set.filter(field=terms.accessRequest,
                                           deleteTransaction__isnull=True,
                                           referenceValue_id=follower.id)
                    for v in vs:
                        v.deepDelete(transactionState)
                
                    if follower.typeID_id == terms.user.id:
                        propertyList = {\
                                'name': [{'text': 'crn.FollowerAccept'}],
                                'argument': [{'instanceID': user.idString}],
                                'is fresh': [{'instanceID': terms.yesEnum.idString}]
                            }
                        item, v = instancecreator.create(terms['notification'], 
                            follower, terms['notification'], -1, 
                            propertyList, nameLists, userInfo, transactionState, instancecreator.checkCreateNotificationAccess)

                    data = newValue.getReferenceData(userInfo, language)
                    results = {'object': data} 
        else:
            raise RuntimeError('the user or group is unrecognized')
            
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
        followingPath = request.POST["following"]
        followerPath = request.POST["follower"]
        
        if request.user.is_authenticated:
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())
            else:
                userInfo = UserInfo(request.user)
                objs = pathparser.getQuerySet(followingPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                if len(objs) > 0 and objs[0].typeID_id == terms.user.id:
                    following = objs[0]
                    objs = pathparser.getQuerySet(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(objs) > 0 and objs[0].typeID_id == terms.user.id:
                        follower = objs[0]
                        fieldTerm = terms.accessRequest
                        ars = following.value_set.filter(field=fieldTerm,
                                                         deleteTransaction__isnull=True,
                                                         referenceValue_id=follower.id)
                        if ars.exists():
                            if follower == user:
                                error = 'You have already requested to follow %s.' % following.description.text
                            else:
                                error = 'There is already a request for %s to follow %s.' % (follower.description.text, following.description.text)
                            return HttpResponseBadRequest(reason=error)
                        elif not follower.value_set.filter(field=terms.publicAccess,
                                                              deleteTransaction__isnull=True).exists() and \
                             not Value.objects.filter(field=terms.user,
                                                      deleteTransaction__isnull=True,
                                                      referenceValue__id=following.id,
                                                      instance__typeID=terms.accessRecord,
                                                      instance__referenceValues__instance_id=follower.id).exists():
                            followerName = "you" if follower.id == user.id else ('"%s"' % follower.description.text)
                            followerPossessive = "your" if follower.id == user.id else (('"%s"' + "'s") % follower.description.text)
                            followingName = "You" if following.id == user.id else ('"%s"' % following.description.text)
                            error = "%s will not be able to accept your request because they can't find %s. You can either change %s Profile Visibility or share %s profile with them." % (followingName, followerName, followerPossessive, followerPossessive)
                            return HttpResponseBadRequest(reason=error)
                        else:
                            with transaction.atomic():
                                transactionState = TransactionState(request.user)
                                nameLists = NameList()
                            
                                v = following.addReferenceValue(fieldTerm, follower, following.getNextElementIndex(fieldTerm), transactionState)
            
                                data = v.getReferenceData(userInfo, language)
                            
                                # Send an email to the following user.
                                protocol = "https://" if request.is_secure() else "http://"
                                recipientEMail = following.getSubDatum(terms.email)
                                path = following.getSubInstance(terms['Path'])
                                salutation = (path and path.getSubDatum(terms.name)) or following.getSubDatum(terms.firstName)
                                
                                Emailer.sendNewFollowerEmail(salutation,
                                    recipientEMail, 
                                    follower.getDescription(),
                                    protocol + request.get_host() + settings.ACCEPT_FOLLOWER_PATH + follower.idString,
                                    protocol + request.get_host() + settings.IGNORE_FOLLOWER_PATH + follower.idString)
                            
                                results = {'object': data}
                    else:
                        return HttpResponseBadRequest(reason='the requestor is unrecognized')
                else:
                    return HttpResponseBadRequest(reason='the user to follow is unrecognized')
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
        'jsversion': settings.JS_VERSION,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'addExperience%s' % experienceID

    return HttpResponse(template.render(args))

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
        'jsversion': settings.JS_VERSION,
    }

    if settings.FACEBOOK_SHOW:
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = 'Add %s'%(offeringName if offeringName else serviceName if serviceName else 'Experience')
        atText = (organizationName if organizationName == siteName else \
                ('%s//%s' % (organizationName, siteName)) if siteName else organizationName)
        args['fbDescription'] = atText

    if organizationName:
        args['organization'] = organization.idString if organization else organizationName
    if siteName:
        args['site'] = site.idString if site else siteName
    if offeringName:
        args['offering'] = offering.idString if offering else offeringName
    if serviceName:
        args['service'] = service.idString if service else serviceName

    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.idString
    
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True

    args['state'] = 'addToPathway'

    return HttpResponse(template.render(args))

def requestExperienceComment(request):
    if request.method != "POST":
        raise Http404("requestExperienceComment only responds to POST methods")
    
    try:    
        language = None
        experiencePath = request.POST["experience"]
            
        followerPath = request.POST["path"]
            
        question = request.POST["question"]
        if len(question) == 0:
            return HttpResponseBadRequest(reason="question text is not specified")
        
        if request.user.is_authenticated:
            user = Instance.getUserInstance(request.user)
            if not user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())
            else:
                userInfo = UserInfo(request.user)
                objs = pathparser.getQuerySet(experiencePath, userInfo=userInfo, securityFilter=userInfo.readFilter)
                if len(objs) > 0 and objs[0].typeID_id == terms['More Experience'].id:
                    experience = objs[0]
                    sourcePath = experience.parent
                    experienceValue = sourcePath.value_set.get(referenceValue=experience)
                    objs = pathparser.getQuerySet(followerPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
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
                                            'Path': [{'instanceID': follower.idString}],
                                            TermNames.text: [{'text': question}],
                                           }}],
                                    }
                                item, v = instancecreator.create(terms['Comment'], 
                                    containerObject, terms['Comment'], -1, 
                                    propertyList, nameLists, userInfo, transactionState, instancecreator.checkCreateCommentAccess)
        
                            else:
                                propertyList = {\
                                        'Comment': [{'cells': {\
                                            'Comment Request': [{'cells': {\
                                                'Path': [{'instanceID': follower.idString}],
                                                TermNames.text: [{'text': question}],
                                               }}],
                                            }}],
                                    }
                                item, commentsValue = instancecreator.create(commentsTerm, 
                                    experience, commentsTerm, -1, 
                                    propertyList, nameLists, userInfo, transactionState, instancecreator.checkCreateCommentAccess)
                                containerObject = experience.getSubInstance(commentsTerm)
                                v = containerObject.getSubValue(terms['Comment'])
                                item = v.referenceValue
                            
                            Instance.updateDescriptions([item], nameLists)
                            
                            # Send an email to the following user.
                            protocol = "https://" if request.is_secure() else "http://"

                            recipient = experience.parent.parent
                            recipientEMail = recipient.getSubDatum(terms.email)
                            path = experience.parent
                            salutation = path.getSubDatum(terms.name) or recipient.getSubDatum(terms.firstName)
                            
                            # Send an email to the recipient that they have a question.
                            Emailer.sendRequestExperienceCommentEmail(settings.PASSWORD_RESET_SENDER, 
                                salutation,
                                recipientEMail,
                                experienceValue,
                                follower,
                                (follower.id == user.getSubInstance(terms['Path']).id and \
                                 request.user.is_staff),
                                question,
                                v,
                                protocol + request.get_host())
                            
                            # Create a notification for the user.    
                            notificationData = {\
                                    'name': [{'text': 'crn.ExperienceCommentRequested'}],
                                    'argument': [{'instanceID': follower.idString},
                                                 {'instanceID': experience.idString},
                                                 {'instanceID': item.idString}],
                                    'is fresh': [{'instanceID': terms.yesEnum.idString}]
                                }
                            notification, notificationValue = instancecreator.create(terms['notification'], 
                                recipient, terms['notification'], -1, 
                                notificationData, nameLists, userInfo, transactionState, instancecreator.checkCreateNotificationAccess)


                            typeset = frozenset([terms['Comments'], terms['Comment'], terms['Comment Request'], ])
                            typeDuples = map(lambda t: (t, t.getFieldsData(language)), typeset)
                            fieldsDataDictionary = FieldsDataDictionary(typeDuples, language=language)
                            
                            if commentsValue:
                                vqs = ValueQuerySet(Value.objects.filter(id=commentsValue.id)).select_related([], userInfo)
                                data = vqs.querySet[0].getData(['Comment/Comment Request'], fieldsDataDictionary, language, userInfo)
                                
                                # Get the new value along with its subdata (v, above, only has the value)
                                vqs = ValueQuerySet(Value.objects.filter(id=v.id)).select_related(['Comment Request'], userInfo)
                                commentData = vqs.querySet[0].getData(['Comment Request'], fieldsDataDictionary, language, userInfo)
                                
                                data['cells'][0]['data'] = [commentData]
                            else:
                                # Get the new value along with its subdata (v, above, only has the value)
                                vqs = ValueQuerySet(Value.objects.filter(id=v.id)).select_related(['Comment Request'], userInfo)
                                data = vqs.querySet[0].getData(['Comment Request'], fieldsDataDictionary, language, userInfo)
                            
                            results = {'fields': fieldsDataDictionary.getData(typeset), 'Comment': data}
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
    def createInstance(user, path, data):
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
                if path:
                    instances = pathparser.getQuerySet(path, userInfo=userInfo, securityFilter=userInfo.findFilter)
                    if len(instances) > 0:
                        containerObject = instances[0]
                    else:
                        raise RuntimeError("%s is not recognized" % path)
                else:
                    containerObject = None

                nameLists = NameList()
                item, newValue = instancecreator.create(ofKindObject, containerObject, field, index, propertyList, nameLists, userInfo, transactionState)
    
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
            instances = pathparser.getObjectQuerySet(c[pathKey], userInfo=userInfo)\
                                  .filterToInstances()\
                                  .querySet
            if len(instances) > 0:
                c[idKey] = instances[0].id
            else:
                raise RuntimeError("%s is not recognized" % pathKey)
    
    def valueAdded(v, nameLists, userInfo, transactionState, hostURL):
        if v.instance.typeID_id == terms['Comment'].id and \
           v.field_id == terms['text'].id:
            request = v.instance.getSubInstance(terms['Comment Request'])
            if request:
                follower = request.getSubInstance(terms['Path'])
                recipient = follower.parent
                recipientEMail = recipient.getSubDatum(terms.email)
                experienceValue = v.instance.parent.parent.parentValue
                salutation = follower.getSubDatum(terms.name) or recipient.getSubDatum(terms.firstName)
                following = experienceValue.instance
                isAdmin = userInfo.is_administrator
                comment = v.instance
                Emailer.sendAnswerExperienceQuestionEmail(salutation, recipientEMail, 
                    experienceValue, following, isAdmin, comment, hostURL)

                # Create a notification for the user.    
                notificationData = {\
                    'name': [{'text': 'crn.ExperienceQuestionAnswered'}],
                    'argument': [{'instanceID': following.idString},
                                 {'instanceID': experienceValue.referenceValue.idString},
                                 {'instanceID': comment.idString}],
                    'is fresh': [{'instanceID': terms.yesEnum.idString}]
                }
                notification, notificationValue = instancecreator.create(terms['notification'], 
                    recipient, terms['notification'], -1, 
                    notificationData, nameLists, userInfo, transactionState, instancecreator.checkCreateNotificationAccess)

    def updateValues(user, data, hostURL):
        try:
            commandString = data.get('commands', "[]")
            commands = json.loads(commandString)
        
            valueIDs = []
            instanceIDs = []
            nameLists = NameList()
            descriptionQueue = []
            
            with transaction.atomic():
                transactionState = TransactionState(user)
                userInfo = UserInfo(user)
                for c in commands:
                    instanceID = None
                    if "id" in c:
                        oldValue = Value.objects.get(pk=c["id"],deleteTransaction__isnull=True)
                        oldValue.checkWriteAccess(userInfo)

                        container = oldValue.instance

                        api.checkForPath(c, user, "instance", "instanceID")
                        
                        if oldValue.isDescriptor:
                            descriptionQueue.append(container)
                        
                        if oldValue.hasNewValue(c):
                            container.checkWriteValueAccess(userInfo, oldValue.field, c["instanceID"] if "instanceID" in c else None)
                            item = oldValue.updateValue(c, userInfo, transactionState)
                            instanceID = item.referenceValue_id
                        else:
                            oldValue.deepDelete(transactionState)
                            item = None
                    elif "containerUUID" in c or "container" in c:
                        api.checkForPath(c, user, "container", "containerUUID")
                        container = Instance.objects.get(pk=c["containerUUID"],deleteTransaction__isnull=True)

                        if "field" in c:
                            field = terms[c["field"]]
                        elif "fieldID" in c:
                            field = Instance.objects.get(pk=c["fieldID"],deleteTransaction__isnull=True)
                        else:
                            raise ValueError("neither field nor fieldID was specified")
                            
                        if "index" in c:
                            newIndex = container.updateElementIndexes(field, int(c["index"]), transactionState)
                        else:
                            newIndex = container.getNextElementIndex(field)
                        
                        api.checkForPath(c, user, "instance", "instanceID")
                        instanceID = c["instanceID"] if "instanceID" in c else None

                        container.checkWriteValueAccess(userInfo, field, instanceID)

                        if "ofKindID" in c:
                            ofKindObject = Instance.objects.get(pk=c["ofKindID"],deleteTransaction__isnull=True)
                            newInstance, item = instancecreator.create(ofKindObject, container, field, newIndex, c, nameLists, userInfo, transactionState)
                            instanceID = newInstance.idString
                        else:
                            item = container.addValue(field, c, newIndex, userInfo, transactionState)
                            instanceID = item.referenceValue_id and item.referenceValue_id.hex
                            # Handle special cases that should occur when adding a new value.
                            api.valueAdded(item, nameLists, userInfo, transactionState, hostURL)

                        if item.isDescriptor:
                            descriptionQueue.append(container)
                    else:
                        raise ValueError("subject id was not specified")
                    valueIDs.append(item.idString if item else None)
                    instanceIDs.append(instanceID)
                                
                Instance.updateDescriptions(descriptionQueue, nameLists)
                
                results = {'valueIDs': valueIDs, 'instanceIDs': instanceIDs}
            
            return JsonResponse(results)
        
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))

    def getData(user, path, data):
        try:
            start = int(data.get("start", "0"))
            end = int(data.get("end", "0"))
        
            if not path:
                raise ValueError("path was not specified in getData")
            
            fieldString = data.get('fields', "[]")
            fields = json.loads(fieldString)
            
            language = data.get('language', None)
            context = Context(language, user)
            
            tokens = cssparser.tokenizeHTML(path)
            qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
            if qs.count() == 0:
                p = []
            else:
                resultClass = type(qs[0])
                qs2 = resultClass.filterForGetData(qs, context.user, accessType)
                qs2 = resultClass.select_related(qs2.distinct())
                if end > 0:
                    qs2 = qs2[start:end]
                elif start > 0:
                    qs2 = qs2[start:]
                p = [i.getData(fields, context) for i in qs2]
        
            results = {'data': p}
                
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData path:%s" % str(path))
            logger.error("getData data:%s" % str(data))
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)
        
    # This should only be done for root instances. Otherwise, the value should
    # be deleted, which will delete this as well.
    def delete(user, path):
        try:
            if not path:
                raise ValueError("path was not specified in delete")

            with transaction.atomic():
                transactionState = TransactionState(user)
                userInfo=UserInfo(user)
                if path.startswith("value/"):
                    valueID = path[6:6+32]
                    ValueQuerySet(Value.objects.filter(pk=valueID, deleteTransaction__isnull=True))\
                        .deleteObjects(user, NameList(), userInfo, transactionState)
                else:
                    descriptionCache = []
                    nameLists = NameList()
                    pathparser.getObjectQuerySet(path, userInfo=userInfo, securityFilter=userInfo.administerFilter).deleteObjects(user, nameLists, userInfo, transactionState)
 
            results = {}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)
        
def updateValues(request):
    if request.method != "POST":
        raise Http404("updateValues only responds to POST methods")
    
    if not request.user.is_authenticated:
        raise PermissionDenied
    
    hostURL = ("https://" if request.is_secure() else "http://") + request.get_host();
    return api.updateValues(request.user, request.POST, hostURL)
    
def getUserID(request):
    if request.method != "GET":
        raise Http404("getUserID only responds to GET methods")
    
    return api.getUserID(request.user, request.GET)

def handleURL(request, urlPath=None):
    if request.method == 'GET':
        return api.getData(request.user, urlPath, request.GET)
    elif request.method == 'DELETE':
        if not request.user.is_authenticated:
            raise PermissionDenied
        return api.delete(request.user, urlPath)
    elif request.method == 'POST':
        if not request.user.is_authenticated:
            raise PermissionDenied
        return api.createInstance(request.user, urlPath, request.POST)
    else:
        raise Http404("api only responds to GET, DELETE and POST methods")

class ApiEndpoint(View):
    def get(self, request, *args, **kwargs):
        if request.path_info == '/api/':
            return handleURL(request, None)
        elif request.path_info == '/api/getvalues/':
            return getValues(request)
        return HttpResponseNotFound(reason='unrecognized url')
        
    def post(self, request, *args, **kwargs):
        if request.path_info == '/api/':
            return handleURL(request, None)
        elif request.path_info == '/api/updatevalues/':
            return updateValues(request)
        return HttpResponseNotFound(reason='unrecognized url')
    
# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    if request.method != "POST":
        raise Http404("submitsignin only responds to POST methods")
    
    try:
        results = userviews.signinResults(request)
        user = Instance.getUserInstance(request.user) or UserFactory.createUserInstance(request.user, None)
        results["user"] = { "instanceID": user.idString, "description" : user.getDescription(None) }        
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
            results["user"] = { "instanceID": userInstance.idString, "description" : userInstance.getDescription(None) }
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
            v.updateValue({"text": request.user.email}, UserInfo(request.user), transactionState)
            nameLists = NameList()
            userInstance.cacheDescription(nameLists);
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

def features(request):
    template = loader.get_template('doc/features.html')
    args = {
        'jsversion': settings.JS_VERSION,
    }
        
    return HttpResponse(template.render(args))

