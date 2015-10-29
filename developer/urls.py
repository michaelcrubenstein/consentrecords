from __future__ import absolute_import
from django.conf.urls import patterns, url

from developer import views

urlpatterns = patterns(
    '',
    url(r'^$', views.index),
    url(r'^data/$', views.data.index),
    url(r'^business/$', views.business.index),
    url(r'^business/api/', views.business.api),
    url(r'^business/reference/', views.business.reference),
    url(r'^business/paths/', views.business.paths),
    url(r'^business/pathexamples/', views.business.pathexamples),
    url(r'^business/datatypes/', views.business.datatypes),
    url(r'^presentation/', views.presentation.index),
    url(r'^presentation/model/', views.presentation.model),
    url(r'^presentation/styles/', views.presentation.styles),
    url(r'^presentation/views/', views.presentation.views),
    url(r'^configuration/', views.configuration.index),
    url(r'^configuration/configuration/', views.configuration.configuration),
    url(r'^configuration/organization/', views.configuration.organization),
)

