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

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^user/', include('custom_user.urls')),
    url(r'^monitor/', include('monitor.urls')),
    url(r'^$', views.home, name='home'),
    url(r'^configure/initializefacts/', views.initializeFacts, name='initializeFacts'),
    url(r'^configure/configuration', views.configuration, name='configuration'),
    url(r'^configure/submit/createinstance/', views.submitCreateInstance, name='submitCreateInstance'),
    url(r'^configure/submit/updateValues/', views.submitUpdateValues, name='submitUpdateValues'),
    url(r'^configure/submit/addValue/', views.submitAddValue, name='submitAddValue'),
    url(r'^configure/get/rootobjects/', views.getRootObjects, name='getRootObjects'),
    url(r'^configure/get/data/', views.getData, name='getData'),
    url(r'^configure/get/addConfiguration/', views.getAddConfiguration, name='getAddConfiguration'),
    url(r'^configure/get/elements/', views.getElements, name='getElements'),
    url(r'^configure/get/enumerations/', views.getEnumerations, name='getEnumerations'),
    url(r'^configure/get/enumerationvalues/', views.getEnumerationValues, name='getEnumerationValues'),
]
