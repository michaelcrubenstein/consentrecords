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

from consentrecords.b import views

urlpatterns = [
    
    url(r'^$', views.home),
    url(r'^find/([A-Fa-f0-9]{32})/([A-Fa-f0-9]{32})/', views.find),
    url(r'^find/', views.find),
    url(r'^for/([^/@]+@[^/@]+\.[^/@]+)/', views.showPathway),
    url(r'^for/([A-Fa-f0-9]{32})/', views.showPathway),
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

    url(r'^user/forgotpassword/', views.forgotPassword),
    url(r'^user/passwordreset/([A-Fa-f0-9]{32})/', views.passwordReset),

    url(r'^commentprompts/', views.showCommentPrompts),
    url(r'^organizations/', views.showOrganizations),
    url(r'^services/', views.showServices),
    url(r'^users/', views.showUsers),

    url(r'^org/$', views.orgHome),
    url(r'^org/organization/(.*)/site/(.*)/offering/(.*)/session/(.*)/$', views.orgBase),
    url(r'^org/organization/(.*)/$', views.orgBase),
]
