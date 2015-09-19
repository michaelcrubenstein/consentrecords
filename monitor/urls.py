from django.conf.urls import patterns, include, url

from monitor import views

urlpatterns = patterns(
    '',
    url(r'^getrecords/', views.getRecords, name='getRecords'),
)
