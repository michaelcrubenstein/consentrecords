from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction, connection
from django.db.models import F, Q, Prefetch, Count, Subquery, OuterRef, IntegerField
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
from custom_user.models import PasswordReset
from consentrecords.models import *

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
def welcomePrompt(request, promptType):
    logPage(request, 'pathAdvisor/welcomePrompt')
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    
    currentPromptIndex = (2 if promptType == 'experience' \
        else 0)
        
    args = {
        'user': request.user,
        'urlprefix': urlPrefix,
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
        'currentPromptIndex': currentPromptIndex,
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
    
    language = request.GET.get('language', 'en')
    
    if request.user.is_authenticated:
        context = Context(language, request.user)
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = "me"

    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def orgBase(request, organizationName=None, siteName=None, offeringName=None, sessionName=None):
    logPage(request, 'pathAdvisor/%s' % (organizationName or 'org'))
    
    try:
        template = loader.get_template(templateDirectory + 'org/%s.html' % 'tisrael')
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
            
        if organizationName:
        	args['organizationName'] = organizationName
        	
        if siteName:
            args['siteName'] = siteName
            
        if offeringName:
            args['offeringName'] = offeringName
            
        if sessionName:
            args['sessionName'] = sessionName

        return HttpResponse(template.render(args))
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponse(str(e))

@ensure_csrf_cookie
def orgHome(request):
    return orgBase(request)

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
def showRootItems(request, language, rootItemPluralName, panelType):
    
    try:
        logPage(request, 'pathAdvisor/' + request.path_info)
        template = loader.get_template(templateDirectory + 'rootItems.html')
    
        argList = {
            'user': request.user,
            'jsversion': settings.JS_VERSION,
            'cdn_url': settings.CDN_URL,
            'rootItemPluralName': rootItemPluralName,
            'panelType': panelType,
            }
        
        if request.user.is_authenticated:
            user = Context(language, request.user).user
            if not user:
                return HttpResponse("user is not set up: %s" % request.user.get_full_name())
            argList['userID'] = user.id.hex
        
        return HttpResponse(template.render(argList))
    except Exception as e:
        return HttpResponse(str(e))
        
@ensure_csrf_cookie
def showCommentPrompts(request):
    language = request.GET.get('language', 'en')
    return showRootItems(request, language, 'Comment Prompts', 'CommentPromptsPanel')

@ensure_csrf_cookie
def showOrganizations(request):
    language = request.GET.get('language', 'en')
    return showRootItems(request, language, 'Organizations', 'OrganizationsPanel')

@ensure_csrf_cookie
def showServices(request):
    language = request.GET.get('language', 'en')
    return showRootItems(request, language, 'Services', 'ServicesPanel')

@ensure_csrf_cookie
def showUsers(request):
    language = request.GET.get('language', 'en')
    return showRootItems(request, language, 'Users', 'UsersPanel')

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
    
    if isUUID(email):
        containerPath = 'user/%s' % email
    else:
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
    
    if isUUID(id):
        try:
            experience = Experience.objects.get(pk=id)
            if not context.user or experience.parent.parent.id != context.user.id:
                args['user'] = experience.parent.parent.id.hex
            else:
                args['user'] = None
            
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
        except Experience.DoesNotExist:
            pass

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
    
    language = request.GET.get('language', 'en')
    if request.user.is_authenticated:
        
        user = Context(language, request.user).user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'accept'
    args['follower'] = ('user/%s' if isUUID(email) else 'user[email=%s]') % email
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
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    containerPath = ('user/%s' if isUUID(email) else 'user[email>text=%s]') % email
    tokens = cssparser.tokenizeHTML(containerPath)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    if len(qs) > 0:
        args['state'] = 'ignore'
        args['follower'] = 'user/%s' % qs[0].id.hex
        args['follower_description'] = qs[0].description()
        
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def search(request):
    LogRecord.emit(request.user, 'pathAdvisor/search/', None)
    
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
    
    args['state'] = 'search/'
        
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
    
    language = request.GET.get('language', 'en')
    context = Context(language, request.user)
    
    if request.user.is_authenticated:
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
        
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True
    
    args['state'] = 'settings/'
        
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def wordclouds(request):
    LogRecord.emit(request.user, 'pathAdvisor/userSettings/', None)
    
    try:
        template = loader.get_template(templateDirectory + 'wordclouds.html')
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
    
        args['state'] = 'wordclouds/'
    
        return HttpResponse(template.render(args))
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))

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

@ensure_csrf_cookie
def passwordReset(request, resetKey):
    # Don't rely on authentication.
    
    LogRecord.emit(request.user, 'pathAdvisor/passwordReset', resetKey)
    
    template = loader.get_template(templateDirectory + 'userHome.html')
        
    args = {
        'state': 'resetPassword',
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
        'resetkey': resetKey
    }
    return HttpResponse(template.render(args))

@ensure_csrf_cookie
def forgotPassword(request):
    # Don't rely on authentication.
    
    LogRecord.emit(request.user, 'pathAdvisor/forgotpassword', str(request.user))
    print(1)    
    
    template = loader.get_template(templateDirectory + 'userHome.html')
    
    print(2)    
    args = {
        'state': 'forgotpassword',
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
    }
    print(args)
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
                        grantClass = UserUserGrant
                    else:
                        grantClass = UserGroupGrant
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

def requestAccess(request):
    if request.method != "POST":
        raise Http404("requestAccess only responds to POST methods")
    
    try:    
        followingPath = request.POST["following"]
        followerPath = request.POST["follower"]
        language = request.POST.get('language', 'en')
        context = Context(language, request.user)
        
        if request.user.is_authenticated:
            if not context.user:
                return HttpResponseBadRequest(reason="user is not set up: %s" % request.user.get_full_name())
            else:
                qs, tokens, qsType, accessType = \
                    RootInstance.parse(cssparser.tokenizeHTML(followingPath), context.user)
                if len(qs) > 0 and type(qs[0]) == User:
                    following = qs[0]
                    qs, tokens, qsType, accessType = \
                        RootInstance.parse(cssparser.tokenizeHTML(followerPath), context.user)
                    if len(qs) > 0 and type(qs[0]) == User:
                        follower = qs[0]
                        ars = following.userGrantRequests.filter(deleteTransaction__isnull=True,
                                                                 grantee=follower)
                        if ars.exists():
                            if follower == context.user:
                                error = 'You have already requested to follow %s.' % following.description(language)
                            else:
                                error = 'There is already a request for %s to follow %s.' % (follower.description(language), following.description(language))
                            return HttpResponseBadRequest(reason=error)
                        elif not follower.privilegeSource.publicAccess and \
                             not follower.privilegeSource.userGrants.filter(deleteTransaction__isnull=True,
                                 grantee=following).exists() and \
                             not follower.privilegeSource.groupGrants.filter(deleteTransaction__isnull=True,
                                 grantee__members__user=following,
                                 grantee__members__deleteTransaction__isnull=True).exists():
                            followerName = "you" if follower.id == context.user.id else ('"%s"' % follower.description(language))
                            followerPossessive = "your" if follower.id == context.user.id else (('"%s"' + "'s") % follower.description(language))
                            followingName = "You" if following.id == context.user.id else ('"%s"' % following.description(language))
                            error = "%s will not be able to accept your request because they can't find %s. You can either change %s Profile Visibility or share %s profile with them." % (followingName, followerName, followerPossessive, followerPossessive)
                            return HttpResponseBadRequest(reason=error)
                        else:
                            with transaction.atomic():
                                v = UserUserGrantRequest.objects.create(transaction=context.transaction,
                                    lastTransaction=context.transaction,
                                    parent=following,
                                    grantee=follower)

                                data = v.headData(context)
                            
                                # Send an email to the following user.
                                protocol = "https://" if request.is_secure() else "http://"
                                recipientEMail = following.emails.filter(deleteTransaction__isnull=True)[0].text
                                path = following.path
                                salutation = (path and path.name) or following.firstName
                                
                                Emailer.sendNewFollowerEmail(salutation,
                                    recipientEMail, 
                                    follower.description(language),
                                    protocol + request.get_host() + settings.ACCEPT_FOLLOWER_PATH + follower.id.hex,
                                    protocol + request.get_host() + settings.IGNORE_FOLLOWER_PATH + follower.id.hex)
                            
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
    
    args['state'] = 'addExperience/%s' % experienceID

    return HttpResponse(template.render(args))

def _getOrganizationChildren(organization, siteName, offeringName):
    site = None
    offering = None
    if siteName:
        try:
            site = organization.sites.get(names__text=siteName, names__deleteTransaction__isnull=True)
            if offeringName:
                try:
                    offering = site.offerings.get(names__text=offeringName, names__deleteTransaction__isnull=True)
                except Offering.DoesNotExist:
                    pass
        except Site.DoesNotExist:
            pass
        
    return site, offering

@ensure_csrf_cookie
def addToPathway(request):
    LogRecord.emit(request.user, 'pathAdvisor/addToPathway', str(request.user))
    
    organizationName = request.GET.get('o', None)
    siteName = request.GET.get('s', None)
    offeringName = request.GET.get('f', None)
    serviceName = request.GET.get('t', None)
    
    languageCode = request.GET.get('language', 'en')
    context = Context(languageCode, request.user)

    if offeringName and isUUID(offeringName):
        try:
            offering = Offering.objects.get(pk=offeringName, deleteTransaction__isnull=True)
            site = offering.parent
            organization = site.parent
        except Offering.DoesNotExist:
            organization, site, offering = None, None, None
    elif siteName and isUUID(siteName):
        try:
            site = Site.objects.get(pk=siteName, deleteTransaction__isnull=True)
            organization = site.parent
            if offeringName:
                try:
                    offering = site.offerings.get(names__text=offeringName, names__deleteTransaction__isnull=True)
                except Offering.DoesNotExist:
                    offering = None
        except Site.DoesNotExist:
            organization, site, offering = None, None, None
    elif organizationName and isUUID(organizationName):
        try:
            organization = Organization.objects.get(pk=organizationName, deleteTransaction__isnull=True)
            site, offering = _getOrganizationChildren(organization, siteName, offeringName)
        except Organization.DoesNotExist:
            organization, site, offering = None, None, None
    elif organizationName:
        try:
            organization = Organization.objects.get(names__text=organizationName, names__deleteTransaction__isnull=True)
            site, offering = _getOrganizationChildren(organization, siteName, offeringName)
        except Organization.DoesNotExist:
            organization, site, offering = None, None, None
    else:
        organization, site, offering = None, None, None
    
    if serviceName and isUUID(serviceName):
        try:
            service = Service.objects.get(pk=serviceName, deleteTransaction__isnull=True)
        except Service.DoesNotExist:
            service = None
    elif serviceName:
        service = Service.objects.get(names__text=serviceName, deleteTransaction__isnull=True, names__deleteTransaction__isnull=True)
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
        user = context.user
        if not user:
            return HttpResponse("user is not set up: %s" % request.user.get_full_name())
        args['userID'] = user.id.hex
    
    if settings.FACEBOOK_SHOW:
        args['facebookIntegration'] = True

    args['state'] = 'addToPathway'

    return HttpResponse(template.render(args))

class api:
    def updateValues(user, path, data, hostURL):
        try:
            commandString = data.get('commands', "[]")
            changes = json.loads(commandString)
        
            language = data.get('language', 'en')
            
            with transaction.atomic():
                context = Context(language, user, hostURL=hostURL)
                
                if path:
                    tokens = cssparser.tokenizeHTML(path)
                    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
                    if qs.count() == 0:
                        raise ValueError("path was not recognized: %s" % path)
                    else:
                        root = qs[0]
                        newIDs = {}
                        root.update(changes, context, newIDs)
                        results = {'new IDs': newIDs}
                elif 'organizations' in changes:
                    if not context.is_administrator:
                        raise PermissionDenied("write permission failed")
                    newIDs = {}
                    for d in changes['organizations']:
                        RootInstance.parseUpdateData(d, Organization, context, newIDs)
                    results = {'new IDs': newIDs}
                elif 'services' in changes:
                    if not context.is_administrator:
                        raise PermissionDenied("write permission failed")
                    newIDs = {}
                    for d in changes['services']:
                        RootInstance.parseUpdateData(d, Service, context, newIDs)
                    results = {'new IDs': newIDs}
                elif 'users' in changes:
                    if not context.can_create_user:
                        raise PermissionDenied("write permission failed")
                    newIDs = {}
                    for d in changes['users']:
                        RootInstance.parseUpdateData(d, User, context, newIDs)
                    results = {'new IDs': newIDs}
                elif 'comment prompts' in changes:
                    if not context.is_administrator:
                        raise PermissionDenied("write permission failed")
                    newIDs = {}
                    for d in changes['comment prompts']:
                        RootInstance.parseUpdateData(d, CommentPrompt, context, newIDs)
                    results = {'new IDs': newIDs}
                else:
                    raise ValueError('root object changes are unrecognized: %s' % str(changes))
            
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
            
            language = data.get('language', 'en')
            context = Context(language, user)
            
            tokens = cssparser.tokenizeHTML(path)
            qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
            if qs.count() == 0:
                p = []
            else:
                if 'none' in fields:
                    qs2 = qsType.filterForHeadData(qs, context.user, accessType)
                    qs2 = qsType.select_head_related(qs2.distinct())
                else:
                    qs2 = qsType.filterForGetData(qs, context.user, accessType)
                    qs2 = qsType.select_related(qs2.distinct(), fields)
                qs2 = qsType.order_by(qs2, context)
                if end > 0:
                    qs2 = qs2[start:end]
                elif start > 0:
                    qs2 = qs2[start:]
                if 'none' in fields:
                    p = [i.headData(context) for i in qs2]
                else:
                    p = [i.getData(fields, context) for i in qs2]
        
            results = {'data': p}
                
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("getData path:%s" % str(path))
            logger.error("getData data:%s" % str(data))
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)
        
    def serviceCounts(user, path, data):
        try:
            context = Context(data.get('language', 'en'), user)
            
            tokens = cssparser.tokenizeHTML(path or 'path')
            qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
            if qs.count() == 0:
                p = []
            else:                            
                ss = ExperienceImplication.objects.filter(experience__parent__in=qs,
                        service__deleteTransaction__isnull=True)\
                    .values('service')\
                    .annotate(weight=Count('experience__parent', distinct=True))
            
                p = list(map(lambda s:{'id': s['service'].hex, 'weight': s['weight']}, ss))
        
            results = {'words': p}
                
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("serviceCounts path:%s" % str(path))
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)
        
    def followingCounts(user, path, servicePath, data):
        try:
            context = Context(data.get('language', 'en'), user)
            
            tokens = cssparser.tokenizeHTML(path or 'path')
            qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
            if qs.count() == 0:
                p = []
            else:
                tokens = cssparser.tokenizeHTML(servicePath)
                serviceQS, tokens, serviceType, serviceAccessType = RootInstance.parse(tokens, context.user)
                
                s0 = Experience.objects.filter(deleteTransaction__isnull=True, 
                    experienceImplications__service__in=serviceQS)
                s1 = s0.filter(parent=OuterRef('parent')).order_by('era', 'end')
                s2 = Experience.objects.filter(deleteTransaction__isnull=True, 
                        parent__in=qs)\
                        .filter((Q(era__gt=Subquery(s1.values('era')[:1]))|
                                 Q(end__gt=Subquery(s1.values('end')[:1])))&
                                ~Q(start__lte=Subquery(s1.values('start')[:1])))

                ss = ExperienceImplication.objects.filter(experience__in=s2)\
                    .values('service')\
                    .annotate(weight=Count('experience__parent', distinct=True))
                
                p = list(map(lambda s:{'id': s['service'].hex, 'weight': s['weight']}, ss))
        
            results = {'words': p}
                
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            logger.error("serviceCounts path:%s" % str(path))
            return HttpResponseBadRequest(reason=str(e))
        
        return JsonResponse(results)
        
    # This should only be done for root instances. Otherwise, the value should
    # be deleted, which will delete this as well.
    def delete(user, path, data):
        try:
            if not path:
                raise ValueError("path was not specified in delete")

            languageCode = data.get('languageCode', 'en')
            context = Context(languageCode, user)
            with transaction.atomic():
                tokens = cssparser.tokenizeHTML(path)
                qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
                for i in qs:
                    i.markDeleted(context)
 
            results = {}
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponseBadRequest(reason=str(e))
            
        return JsonResponse(results)
        
def updateValues(request, urlPath=None):
    if request.method != "POST":
        raise Http404("updateValues only responds to POST methods")
    
    if not request.user.is_authenticated:
        raise PermissionDenied("current user is not authenticated")
    
    hostURL = ("https://" if request.is_secure() else "http://") + request.get_host();
    return api.updateValues(request.user, urlPath, request.POST, hostURL)
    
def getUserID(request):
    if request.method != "GET":
        raise Http404("getUserID only responds to GET methods")
    
    return api.getUserID(request.user, request.GET)

def handleServiceCounts(request, urlPath=None):
    return api.serviceCounts(request.user, urlPath, request.GET)
    
def handleFollowingCounts(request, urlPath=None, servicePath=None):
    return api.followingCounts(request.user, urlPath, servicePath, request.GET)
    
def handleURL(request, urlPath=None):
    if request.method == 'GET':
        return api.getData(request.user, urlPath, request.GET)
    elif request.method == 'DELETE':
        if not request.user.is_authenticated:
            raise PermissionDenied("current user is not authenticated")
        return api.delete(request.user, urlPath, request.GET)
    elif request.method == 'POST':
        if not request.user.is_authenticated:
            raise PermissionDenied("current user is not authenticated")
        hostURL = ("https://" if request.is_secure() else "http://") + request.get_host();
        return api.updateValues(request.user, urlPath, request.POST, hostURL)
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
        languageCode = request.POST.get('languageCode', 'en')
        context = Context(languageCode, request.user)
        user = context.user
        results['user'] = user.getData(['system access', 'email'], context)
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
        languageCode = request.POST.get('languageCode', 'en')
        
        with transaction.atomic():
            results = userviews.newUserResults(request)
            context = Context(languageCode, request.user, propertyList=propertyList)
            userInstance = context.user
            results["user"] = { "id": userInstance.id.hex, "description" : userInstance.description(languageCode) }
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

# Resets the password for the specified email address based on the key.
def setResetPassword(request):
    try:
        if request.method != "POST":
            raise Exception("setResetPassword only responds to POST requests")

        POST = request.POST
        resetKey = POST['resetkey']
        email = POST['email']
        password = POST['password']
        languageCode = POST.get('languageCode', 'en')
        
        LogRecord.emit(request.user, 'setResetPassword', email)

        if get_user_model().objects.filter(email=email).count() == 0:
            raise Exception("This email address is not recognized.");
        
        query_set = PasswordReset.objects.filter(id=resetKey)
        if query_set.count() == 0:  
            raise Exception("This reset key is not recognized.");
        
        pr = query_set.get()
        pr.updatePassword(email, password)
        
        user = authenticate(email=email, password=password)
        if user is not None:
            if user.is_active:
                login(request, user)
            else:
                raise Exception('This account is disabled.')
        else:
            raise Exception('This login is invalid.');

        results = {}
        context = Context(languageCode, request.user)
        users = User.select_related(User.objects.filter(pk=context.user.id), ['path', 'system access', 'email'])
        results['user'] = users[0].getData(['path', 'system access', 'email'], context)
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
            
    return JsonResponse(results)

def updateUsername(request, urlPath=None):
    if request.method != "POST":
        raise Http404("updateUsername only responds to POST methods")
    
    try:
        with transaction.atomic():
            newUsername = request.POST.get('newUsername', '').lower()
            languageCode = request.POST.get('languageCode', 'en')
            context = Context(languageCode, request.user)
            
            if not urlPath:
                root = context.user
            else:
                tokens = cssparser.tokenizeHTML(urlPath)
                qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
                if qs.count() == 0:
                    raise ValueError("path was not recognized: %s" % path)
                else:
                    root = qs[0]
                    if qsType != User:
                        raise ValueError("item to update is not a user: %s" % root.description(context.languageCode))
                    if not context.canAdminister(root):
                        raise PermissionDenied("you do not have permission to update this user's email")
            
            emails = root.currentEmailsQuerySet
            
            if root.id == context.user.id:
                results = userviews.updateUsernameResults(request, newUsername)
                context.authUser = request.user
            else:
                root.authUser.updateEmail(newUsername)
                results = {}
                
            emails[0].update({'text': newUsername}, context, {})
               
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
        
    return JsonResponse(results)

def features(request):
    template = loader.get_template('doc/features.html')
    args = {
        'jsversion': settings.JS_VERSION,
        'cdn_url': settings.CDN_URL,
    }
        
    return HttpResponse(template.render(args))

