from django.conf import settings
from django.db import transaction, connection
from django.db.models import F, Q, Prefetch
from django.http import HttpResponse, JsonResponse, Http404, HttpResponseBadRequest, HttpResponseServerError
from django.shortcuts import render, redirect, render_to_response
from django.template import RequestContext, loader
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
from custom_user.emailer import Emailer
from consentrecords.models import *
from consentrecords import instancecreator
from consentrecords import pathparser

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
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
    }
    
    if request.user.is_authenticated:
        languageCode = request.GET.get('language', 'en')
        context = Context(languageCode, request.user)
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
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
        'cdn_url': settings.CDN_URL,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
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
        'cdn_url': settings.CDN_URL,
    }
    
    language = request.GET.get('language', 'en')
    context = Context(language, request.user)
    if request.user.is_authenticated:
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
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
        'cdn_url': settings.CDN_URL,
    }
    
    language = request.GET.get('language', 'en')
    context = Context(language, request.user)
    if request.user.is_authenticated:
        args['userID'] = context.user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    # Currently, findNewExperience can support a serviceID and an offeringID. ultimately,
    # we want to pass a path to make this more RESTful.
    args['state'] = "findNewExperience"
    
    if settings.FACEBOOK_SHOW:
        offering = Offering.objects.get(pk=offeringid)
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = offering.description(languageCode=language)
        args['fbDescription'] = offering.parent and offering.parent.parent and offering.parent.parent.description(languageCode=language)

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def showRootItems(request):
    
    try:
        url = request.path_info.split('/')[-2] + '.html'
        logPage(request, 'pathAdvisor/' + request.path_info)
        template = loader.get_template(templateDirectory + url)
    
        argList = {
            'user': request.user,
            'jsversion': settings.JS_VERSION,
            'cdn_url': settings.CDN_URL,
            }
        
        if request.user.is_authenticated:
            user = Context('en', request.user).user
            if not user:
                return HttpResponse("user is not set up: %s" % request.user.get_full_name())
            argList['userID'] = user.id.hex
        
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
        'cdn_url': settings.CDN_URL,
    }
    
    language = request.GET.get('language', 'en')
    context = Context(language, request.user)
    if request.user.is_authenticated:
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = 'user[email>text=%s]' % email
    tokens = cssparser.tokenizeHTML(containerPath)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    if len(qs) > 0:
        args['state'] = 'user/%s' % qs[0].id.hex

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def showExperience(request, id):
    logPage(request, 'pathAdvisor/experience')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
    }
    
    language = request.GET.get('language', 'en')
    context = Context(language, request.user)
    if request.user.is_authenticated:
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
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
        'cdn_url': settings.CDN_URL,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'accept'
    args['follower'] = ('user/%s' if terms.isUUID(email) else 'user[email=%s]') % email
    args['privilege'] = 'read'

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def ignore(request, email):
    LogRecord.emit(request.user, 'pathAdvisor/ignore', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
    }
    
    language = request.GET.get('language', 'en')
    context = Context(language, request.user)
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = ('user/%s' if terms.isUUID(email) else 'user[email>text=%s]') % email
    tokens = cssparser.tokenizeHTML(containerPath)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    if len(qs) > 0:
        args['state'] = 'ignore'
        args['follower'] = 'user/%s' % qs[0].id.hex
        args['follower_description'] = qs[0].description()
        
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def userSettings(request):
    LogRecord.emit(request.user, 'pathAdvisor/userSettings/', None)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'settings/'
        
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def signup(request, email=None):
    LogRecord.emit(request.user, 'pathAdvisor/signup', email)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
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
        followerPath = request.POST["follower"]
        privilege = request.POST["privilege"]
        
        if not request.user.is_authenticated:
            return HttpResponseBadRequest(reason="user is not authenticated")
            
        language = request.POST.get('language', 'en')
        context = Context(language, request.user)
        
        if userPath:
            qs, tokens, qsType, accessType = \
                    RootInstance.parse(cssparser.tokenizeHTML(userPath), context.user)
            if qs.exists():
                user = qs[0]
                if qsType != User:
                    return HttpResponseBadRequest(reason="item to accept follower is not a user: %s" % userPath)
            else:
                return HttpResponseBadRequest(reason="user is not recognized: %s" % userPath)
        else:
            user = context.user
            if not user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())

        if not context.canAdminister(user):
            return PermissionDenied("you do not have permission to accept this user")
        
        qs, tokens, qsType, accessType = \
                    RootInstance.parse(cssparser.tokenizeHTML(followerPath), context.user)    
        if qs.exists():
            grantee = qs[0]
            if qsType == User:
                grants = user.userGrants
            else:
                grants = user.groupGrants
            ars = grants.filter(deleteTransaction__isnull=True,
                                grantee_id=user.id)
            if ars.exists():
                return HttpResponseBadRequest(reason='%s is already following you' % follower.description.text)
            else:
                with transaction.atomic():
                    if qsType == User:
                        grantClass = UserGrant
                    else:
                        grantClass = GroupGrant
                    newValue = grantClass.objects.create(transaction=context.transaction,
                        lastTransaction=context.transaction,
                        parent=grantTarget, privilege=privilege, grantee=grantee)
    
                    # Remove any corresponding access requests.
                    vs = user.userGrantRequests.filter(deleteTransaction__isnull=True,
                                           grantee_id=grantee.id)
                    for v in vs:
                        v.markDeleted(context)
                
                    if qsType == User:
                        n = Notification.objects.create(transaction=context.transaction,
                            lastTransaction=context.transaction,
                            parent=grantee,
                            name='crn.FollowerAccept',
                            isFresh='yes')
                        na=NotificationArgument.objects.create(transaction=context.transaction,
                            lastTransaction=context.transaction,
                            parent=n,
                            position=0,
                            argument=user.id.hex)

                    data = newValue.getData([], context)
                    results = {'object': data} 
        else:
            raise RuntimeError('the user or group is unrecognized')
            
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
        'cdn_url': settings.CDN_URL,
    }
    
    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'addExperience/%s' % experienceID

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
        'cdn_url': settings.CDN_URL,
    }

    if settings.FACEBOOK_SHOW:
        args['fbURL'] = request.build_absolute_uri()
        args['fbTitle'] = 'Add %s'%(offeringName if offeringName else serviceName if serviceName else 'Experience')
        atText = (organizationName if organizationName == siteName else \
                ('%s//%s' % (organizationName, siteName)) if siteName else organizationName)
        args['fbDescription'] = atText

    if organizationName:
        args['organization'] = organization.id.hex if organization else organizationName
    if siteName:
        args['site'] = site.id.hex if site else siteName
    if offeringName:
        args['offering'] = offering.id.hex if offering else offeringName
    if serviceName:
        args['service'] = service.id.hex if service else serviceName

    if request.user.is_authenticated:
        user = Instance.getUserInstance(request.user)
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
    
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True

    args['state'] = 'addToPathway'

    return HttpResponse(template.render(args))

