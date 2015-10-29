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
    url('^', include('django.contrib.auth.urls')),
    url(r'^accounts/login/$', 'django.contrib.auth.views.login'),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^o/', include('oauth2_provider.urls', namespace='oauth2_provider')),
    url(r'^user/', include('custom_user.urls')),
    url(r'^monitor/', include('monitor.urls')),
    url(r'^developer/', include('developer.urls')),
    url(r'^$', views.home, name='home'),
    url(r'^find/([A-Fa-f0-9]{32})/([A-Fa-f0-9]{32})/', views.find),
    url(r'^list', views.list, name='list'),

    url(r'^submitsignin/', views.submitsignin, name='submitSignin'),
    url(r'^submitnewuser/', views.submitNewUser, name='submitNewUser'),

    url(r'^configure/initializefacts/', views.initializeFacts, name='initializeFacts'),

    url(r'^local/getuserid/', views.getUserID),
    url(r'^local/getdata/', views.getData),
    url(r'^local/getconfiguration/', views.getConfiguration),
    url(r'^local/selectall/', views.selectAll),
    
    url(r'^local/createinstance/', views.createInstance, name='createInstance'),
    url(r'^local/updatevalues/', views.updateValues, name='updateValues'),
    url(r'^local/addvalue/', views.addValue, name='addValue'),
    url(r'^local/deleteinstances/', views.deleteInstances, name='deleteInstances'),
    url(r'^local/deletevalue/', views.deleteValue, name='deleteValue'),
    
    url(r'^api/getuserid/', views.getUserID),
    url(r'^api/getdata/', views.getData),
    url(r'^api/getconfiguration/', views.getConfiguration),
    url(r'^api/selectall/', views.selectAll),
    
    url(r'^api/createinstance/', views.ApiEndpoint.as_view()),
    url(r'^api/updatevalues/', views.ApiEndpoint.as_view()),
    url(r'^api/addvalue/', views.ApiEndpoint.as_view()),
    url(r'^api/deleteinstances/', views.ApiEndpoint.as_view()),
    url(r'^api/deletevalue/', views.ApiEndpoint.as_view()),
]

BootStrapper.initializeUUNames()
