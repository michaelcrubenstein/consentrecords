from django.conf import settings
from django.contrib import admin
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.db.utils import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render, redirect
from django.template import RequestContext, loader

import logging

def index(request):
    logger = logging.getLogger(__name__)
    logger.error("index")
    template = loader.get_template('developer/index.html')
    context = RequestContext(request, {})
        
    return HttpResponse(template.render(context))
    
class data:
    def index(request):
        logger = logging.getLogger(__name__)
        logger.error("data.index")
        try:
            template = loader.get_template('developer/data/index.html')
            context = RequestContext(request, {})
            return HttpResponse(template.render(context))
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
            return HttpResponse(str(e))
            
    
class business:
    def index(request):
        template = loader.get_template('developer/business/index.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def api(request):
        template = loader.get_template('developer/business/api.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def reference(request):
        template = loader.get_template('developer/business/reference.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def paths(request):
        template = loader.get_template('developer/business/paths.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def pathexamples(request):
        template = loader.get_template('developer/business/pathexamples.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def datatypes(request):
        template = loader.get_template('developer/business/datatypes.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
class presentation:
    def index(request):
        template = loader.get_template('developer/presentation/index.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def model(request):
        template = loader.get_template('developer/presentation/model.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def styles(request):
        template = loader.get_template('developer/presentation/styles.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def views(request):
        template = loader.get_template('developer/presentation/views.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
class configuration:
    def index(request):
        template = loader.get_template('developer/configuration/index.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def configuration(request):
        template = loader.get_template('developer/configuration/configuration.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
    
    def organization(request):
        template = loader.get_template('developer/configuration/organization.html')
        context = RequestContext(request, {})
        return HttpResponse(template.render(context))
