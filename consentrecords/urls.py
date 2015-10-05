"""consentrecords URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.8/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Add an import:  from blog import urls as blog_urls
    2. Add a URL to urlpatterns:  url(r'^blog/', include(blog_urls))
"""
from django.conf.urls import include, url
from django.contrib import admin

from consentrecords import views
from consentrecords.bootstrap import BootStrapper

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^user/', include('custom_user.urls')),
    url(r'^monitor/', include('monitor.urls')),
    url(r'^$', views.home, name='home'),
    url(r'^list', views.list, name='list'),
    url(r'^servicelocator', views.serviceLocator, name='serviceLocator'),

    url(r'^submitsignin/', views.submitsignin, name='submitSignin'),
    url(r'^submitnewuser/', views.submitNewUser, name='submitNewUser'),

    url(r'^configure/initializefacts/', views.initializeFacts, name='initializeFacts'),

    url(r'^createinstance/', views.createInstance, name='createInstance'),
    url(r'^updateValues/', views.updateValues, name='updateValues'),
    url(r'^addValue/', views.addValue, name='addValue'),
    
    url(r'^selectAll/', views.selectAll, name='selectAll'),
    url(r'^get/data/', views.getData, name='getData'),
    url(r'^get/addConfiguration/', views.getAddConfiguration, name='getAddConfiguration'),
]

BootStrapper.initializeUUNames()
