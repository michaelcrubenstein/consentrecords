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

from django.contrib.auth import views as auth_views
from consentrecords import views

urlpatterns = [
    url('^', include('django.contrib.auth.urls')),
    url(r'^accounts/login/$', auth_views.login, name='authLogin'),
    url(r'^admin/', admin.site.urls),
    url(r'^monitor/', include('monitor.urls')),
    url(r'^developer/', include('developer.urls')),

    url(r'^b/', include('b.urls')),
    
    url(r'^$', views.home, name='home'),
    url(r'^org/$', views.orgHome),
    url(r'^find/([A-Fa-f0-9]{32})/([A-Fa-f0-9]{32})/', views.find),
    url(r'^find/', views.find),
    url(r'^for/([^/@]+@[^/@]+\.[^/@]+)/', views.showPathway),
    url(r'^add/([A-Fa-f0-9]{32})/', views.addExperience),
    url(r'^add/', views.addToPathway),
    url(r'^accept/([^/@]+@[^/@]+\.[^/@]+)/', views.accept),
    url(r'^ignore/([^/@]+@[^/@]+\.[^/@]+)/', views.ignore),
    url(r'^accept/([A-Fa-f0-9]{32})/', views.accept),
    url(r'^ignore/([A-Fa-f0-9]{32})/', views.ignore),
    url(r'^search/', views.search),
    url(r'^settings/', views.userSettings),
    url(r'^signup/([^/@]+@[^/@]+\.[^/@]+)/', views.signup),
    url(r'^signup/', views.signup),
    url(r'^experience/([^/]+)/', views.showExperience),
    url(r'^prompt/([^/]+)/', views.welcomePrompt),
    url(r'^wordcloud/', views.wordclouds),

    url(r'^commentprompts/', views.showCommentPrompts),
    url(r'^organizations/', views.showOrganizations),
    url(r'^services/', views.showServices),
    url(r'^users/', views.showUsers),

    url(r'^user/passwordreset/([A-Fa-f0-9]{32})/', views.passwordReset),
    url(r'^user/setresetpassword/', views.setResetPassword),
    url(r'^submitsignin/', views.submitsignin, name='submitSignin'),
    url(r'^submitnewuser/', views.submitNewUser, name='submitNewUser'),
    url(r'^user/updateusername/', views.updateUsername, name='updateUsername'),
    url(r'^user/acceptFollower/(.*)/', views.acceptFollower),
    url(r'^user/acceptFollower/', views.acceptFollower),
    url(r'^user/requestAccess/', views.requestAccess, name='requestAccess'),
    url(r'^user/', include('custom_user.urls')),

    url(r'^local/updatevalues/(.*)/', views.updateValues, name='updateValues'),
    url(r'^local/updatevalues/', views.updateValues, name='updateValues'),
    
    url(r'^api/updatevalues/(.*)/', views.updateValues),
    url(r'^api/addvalue/', views.ApiEndpoint.as_view()),
    url(r'^api/deleteinstances/', views.ApiEndpoint.as_view()),
    url(r'^api/deletevalue/', views.ApiEndpoint.as_view()),
    
    url(r'^api/(.*)/servicecounts/', views.handleServiceCounts),
    url(r'^api/(.*)/followingcounts/(.*)/', views.handleFollowingCounts),
    url(r'^api/(.*)/', views.handleURL),
    url(r'^api/$', views.handleURL),
    
    url(r'^doc/features/', views.features),
]
