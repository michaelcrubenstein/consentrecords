from django.conf import settings
from django.contrib import admin
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.db.utils import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.template import RequestContext, loader
from django.views.decorators.csrf import requires_csrf_token

import logging
import traceback

from custom_user.emailer import Emailer
from custom_user.models import PasswordReset

from monitor.models import LogRecord

__author__ = 'mrubenstein'

# Displays the html page for signing in.
def signin(request):
    LogRecord.emit(request.user, 'custom_user/signin', '')

    template = loader.get_template('custom_user/signin.html')
    
    backURL = request.GET.get(u'backURL', "/")
        
    context = RequestContext(request, {
        'backURL' : backURL,
    })
    return HttpResponse(template.render(context))

# Displays a web page in which a user can specify an email address for 
# resetting their password.
def forgotPassword(request):
    LogRecord.emit(request.user, 'custom_user/forgotPassword', '')
    if not request.user.is_authenticated:
        return signin(request)
    
    template = loader.get_template('custom_user/forgotpassword.html')
    backURL = request.GET.get('backURL', '/')
    nextURL = request.GET.get('nextURL', '/')
        
    context = RequestContext(request, {
        'backURL': backURL,
        'nextURL': nextURL,
    })
    return HttpResponse(template.render(context))

# Displays a web page in which a user can specify a new password based on a key.
def password(request):
    LogRecord.emit(request.user, 'custom_user/password', '')

    if not request.user.is_authenticated:
        return signin(request)
    
    template = loader.get_template('custom_user/password.html')
    backURL = request.GET.get('back', '/')
        
    context = RequestContext(request, {
        'user': request.user,
        'backURL': backURL,
    })
    return HttpResponse(template.render(context))

def passwordReset(request):
    LogRecord.emit(request.user, 'custom_user/passwordReset', '')

    if not request.user.is_authenticated:
        return signin(request)
    
    template = loader.get_template('custom_user/passwordreset.html')
    resetKey = request.GET.get('key', "")
        
    context = RequestContext(request, {
        'resetkey': resetKey
    })
    return HttpResponse(template.render(context))

# Creates a record so that a user can reset their password via email.
def resetPassword(request):
    LogRecord.emit(request.user, 'custom_user/resetPassword', '')

    results = {'success':False, 'error': u'request format invalid'}
    try:
        if request.method != "POST":
            raise Exception("resetPassword only responds to POST requests")

        POST = request.POST
        email = request.POST['email']
        
        if get_user_model().objects.filter(email=email).count() == 0:
            raise Exception("This email address is not recognized.");
            
        newKey = PasswordReset.createPasswordReset(email)
        if request.is_secure():
            protocol = "https://"
        else: 
            protocol = "http://"
        
        Emailer.sendResetPasswordEmail(settings.PASSWORD_RESET_SENDER, email, 
            protocol + request.get_host() + settings.PASSWORD_RESET_PATH + "?key=" + newKey)
        
        results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)

# Resets the password for the specified email address based on the key.
def setResetPassword(request):
    LogRecord.emit(request.user, 'custom_user/setResetPassword', '')

    results = {'success':False, 'error': u'request format invalid'}
    try:
        logger = logging.getLogger(__name__)
        logger.error("%s" % "Start setResetPassword")

        if request.method != "POST":
            raise Exception("setResetPassword only responds to POST requests")

        POST = request.POST
        resetKey = request.POST['resetkey']
        email = request.POST['email']
        password = request.POST['password']
        
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
                results = {'success':True}
            else:
                raise Exception('This account is disabled.')
        else:
            raise Exception('This login is invalid.');

        results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
            
    return JsonResponse(results)

# Displays a URL so that the user can sign up for the system.
def signup(request):
    LogRecord.emit(request.user, 'custom_user/signup', '')

    template = loader.get_template('custom_user/signup.html')

    backURL = request.GET.get('backURL', '/')
    nextURL = request.GET.get('nextURL', '/')

    context = RequestContext(request, {
        'backURL' : backURL,
        'nextURL' : nextURL,
    })
    return HttpResponse(template.render(context))
    
class AccountDisabledError(ValueError):
    def __str__(self):
        return "This account is disabled."

class AuthFailedError(ValueError):
    def __str__(self):
        return "This login is invalid."

def signinResults(request):
    try:
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(username=username, password=password)
        if user is not None:
            if user.is_active:
                login(request, user)
                return {'success':True}
            else:
                raise AccountDisabledError()
        else:
            raise AuthFailedError();
    except AccountDisabledError as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % str(e))
        return {'success':False, 'error': str(e)}
    except AuthFailedError as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % str(e))
        return {'success':False, 'error': str(e)}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return {'success':False, 'error': str(e)}

# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    LogRecord.emit(request.user, 'custom_user/submitsignin', '')
            
    return JsonResponse(signinResults(request))
    
def submitSignout(request):
    LogRecord.emit(request.user, 'custom_user/submitsignout', '')
    try:
        logout(request)
        results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}

    return JsonResponse(results)
    
def checkUnusedEmail(request):
    LogRecord.emit(request.user, 'custom_user/checkUnusedEmail', '')

    results = {'success':False, 'error': 'checkUnusedEmail failed'}
    try:
        if request.method != "POST":
            raise Exception("checkUnusedEmail only responds to POST requests")

        email = request.POST['email']
        
        manager = get_user_model().objects
        if manager.filter(email=manager.normalize_email(email)).count() > 0:
            results = {'success':False, 'error': 'That email address has already been used to sign up.'}
        else:
            results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        logger.error("%s" % str(request.POST))
        results = {'success':False, 'error': str(e)}
    
    return JsonResponse(results)

def newUserResults(request):
    results = {'success':False, 'error': 'newUser failed'}
    try:
        if request.method != "POST":
            raise Exception("newUser only responds to POST requests")

        username = request.POST['username']
        password = request.POST['password']
        firstName = request.POST['firstName']
        lastName = request.POST['lastName']

        manager = get_user_model().objects
        with transaction.atomic():
            constituent = manager.create_user(email=username, password=password, 
                                              firstName = firstName, lastName = lastName)
                                                             
            user = authenticate(username=username, password=password)
            if user is not None:
                if user.is_active:
                    login(request, user)
                    if request.user is None:
                        return {'success':False, 'error': 'user login failed.'}
                    else:
                        return {'success':True}
                else:
                    return {'success':False, 'error': 'this user is disabled.'}
                    # Return a 'disabled account' error message
            else:
                return {'success':False, 'error': 'This login is invalid.'}
    except IntegrityError as e:
        return {'success':False, 'error': 'That email address has already been used to sign up.'}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return {'success':False, 'error': str(e)}

def newUser(request):
    LogRecord.emit(request.user, 'custom_user/newUser', '')
    
    return JsonResponse(newUserResults(results))

def updatePassword(request):
    LogRecord.emit(request.user, 'custom_user/updatePassword', '')

    results = {'success':False, 'error': 'updatePassword failed'}
    try:
        if request.method != "POST":
            raise Exception("UpdatePassword only responds to POST requests")
        if not request.user.is_authenticated:
            raise Exception("The current login is invalid")
            
        POST = request.POST;
        oldPassword = POST.get('oldPassword', '')
        newPassword = POST.get('newPassword', '')
        
        testUser = authenticate(username=request.user.email, password=oldPassword)
        if testUser is not None:
            if testUser.is_active:
                testUser.set_password(newPassword)
                testUser.save(using=get_user_model().objects._db)
                login(request, testUser)
            else:
                raise AccountDisabledError()
                # Return a 'disabled account' error message
        else:
            raise AuthFailedError()

        results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
    
    return JsonResponse(results)
