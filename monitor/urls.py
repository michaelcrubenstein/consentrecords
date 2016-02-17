from django.conf.urls import patterns, include, url

from monitor import views

urlpatterns = patterns(
    '',
    url(r'^log/', views.log, name='log'),
)
