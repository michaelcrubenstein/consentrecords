from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.db.utils import IntegrityError
from django.http import HttpResponse, JsonResponse, HttpResponseBadRequest
from django.shortcuts import render, redirect
from django.template import RequestContext, loader
from django.views.decorators.csrf import requires_csrf_token, ensure_csrf_cookie

import logging
import traceback

from custom_user.emailer import Emailer
from custom_user.models import PasswordReset

from monitor.models import LogRecord

__author__ = 'mrubenstein'

# Displays the html page for signing in.
@ensure_csrf_cookie
def signin(request):
    template = loader.get_template('custom_user/signin.html')
    
    backURL = request.GET.get(u'backURL', "/")
        
    args = {
        'backURL' : backURL,
    }
    return HttpResponse(template.render(args))

# Displays a web page in which a user can specify an email address for 
# resetting their password.
@ensure_csrf_cookie
def forgotPassword(request):
    if not request.user.is_authenticated():
        return signin(request)
    
    template = loader.get_template('custom_user/forgotpassword.html')
    backURL = request.GET.get('backURL', '/')
    nextURL = request.GET.get('nextURL', '/')
        
    args = {
        'backURL': backURL,
        'nextURL': nextURL,
    }
    return HttpResponse(template.render(args))

# Displays a web page in which a user can change their password.
@ensure_csrf_cookie
def password(request):
    if not request.user.is_authenticated():
        return signin(request)
    
    template = loader.get_template('custom_user/password.html')
    backURL = request.GET.get('back', '/')
        
    args = {
        'user': request.user,
        'backURL': backURL,
    }
    return HttpResponse(template.render(args))

# Displays a web page in which a user can specify a new password based on a key.
@ensure_csrf_cookie
def passwordReset(request, resetKey):
    # Don't rely on authentication.
    
    template = loader.get_template('custom_user/passwordreset.html')
        
    args = {
        'resetkey': resetKey
    }
    return HttpResponse(template.render(args))

# Creates a PasswordReset record and sends an email with its key so that a user 
# can reset their password via email.
def resetPassword(request):
    try:
        if request.method != 'POST':
            raise Exception("resetPassword only responds to POST requests")

        POST = request.POST
        email = request.POST['email']
        
        LogRecord.emit(request.user, 'create PasswordReset', email)

        if get_user_model().objects.filter(email=email).count() == 0:
            raise Exception("This email address is not recognized.");
            
        newKey = PasswordReset.createPasswordReset(email)
        protocol = 'https://' if request.is_secure() else 'http://'
        
        Emailer.sendResetPasswordEmail(email, 
            protocol + request.get_host() + settings.PASSWORD_RESET_PATH + newKey + '/',
            protocol + request.get_host())
        
        results = {}
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
        resetKey = request.POST['resetkey']
        email = request.POST['email']
        password = request.POST['password']
        
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
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
            
    return JsonResponse(results)

# Displays a URL so that the user can sign up for the system.
@ensure_csrf_cookie
def signup(request):
    template = loader.get_template('custom_user/signup.html')

    backURL = request.GET.get('backURL', '/')
    nextURL = request.GET.get('nextURL', '/')

    args = {
        'backURL' : backURL,
        'nextURL' : nextURL,
    }
    return HttpResponse(template.render(args))
    
class AccountDisabledError(ValueError):
    def __str__(self):
        return "This account is disabled."

class AuthFailedError(ValueError):
    def __str__(self):
        return "This login is invalid."

def signinResults(request):
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(username=username, password=password)
        if user is not None:
            if user.is_active:
                login(request, user)
                return {}
            else:
                raise AccountDisabledError()
        else:
            raise AuthFailedError();

# Handles a post operation that contains the users username (email address) and password.
def submitsignin(request):
    try:
        return JsonResponse(signinResults(request))
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
    
def submitSignout(request):
    try:
        logout(request)
        results = {}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))

    return JsonResponse(results)
    
def checkUnusedEmail(request):
    try:
        if request.method != "POST":
            raise Exception("checkUnusedEmail only responds to POST requests")

        email = request.POST['email']
        
        manager = get_user_model().objects
        if manager.filter(email=manager.normalize_email(email)).count() > 0:
            raise RuntimeError('That email address has already been used to sign up.')
        else:
            results = {}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        logger.error("%s" % str(request.POST))
        return HttpResponseBadRequest(reason=str(e))
    
    return JsonResponse(results)

def newUserResults(request):
    try:
        if request.method != "POST":
            raise RuntimeError("newUser only responds to POST requests")

        data = request.POST
        username = data['username']
        password = data['password']
        firstName = data.get('firstName', None)
        lastName = data.get('lastName', None)

        manager = get_user_model().objects
        with transaction.atomic():
            constituent = manager.create_user(email=username, password=password, 
                                              firstName = firstName, lastName = lastName)
                                                             
            user = authenticate(username=username, password=password)
            if user is not None:
                if user.is_active:
                    login(request, user)
                    if request.user is None:
                        raise RuntimeError('user login failed.')
                    else:
                        return {}
                else:
                    raise RuntimeError('this user is disabled.')
                    # Return a 'disabled account' error message
            else:
                raise RuntimeError('This login is invalid.')
    except IntegrityError as e:
        raise RuntimeError('That email address has already been used to sign up.')

def newUser(request):
    try:
        return JsonResponse(newUserResults(results))
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))

def updateUsernameResults(request):
    if request.method != "POST":
        raise Exception("UpdateUsername only responds to POST requests")
    if not request.user.is_authenticated():
        raise Exception("The current login is invalid")
        
    POST = request.POST;
    password = POST.get('password', '')
    newUsername = POST.get('newUsername', '')
    
    testUser = authenticate(username=request.user.email, password=password)
    if testUser is not None:
        if testUser.is_active:
            testUser.email = newUsername
            testUser.save(using=get_user_model().objects._db)
            login(request, testUser)
        else:
            raise AccountDisabledError()
            # Return a 'disabled account' error message
    else:
        raise AuthFailedError()

    return {}

def updatePassword(request):
    try:
        if request.method != "POST":
            raise Exception("UpdatePassword only responds to POST requests")
        if not request.user.is_authenticated():
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

        results = {}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        return HttpResponseBadRequest(reason=str(e))
    
    return JsonResponse(results)
