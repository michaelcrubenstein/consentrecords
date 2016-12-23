from django.conf.urls import url

from monitor import views

urlpatterns = [
    url(r'^log/', views.log, name='log'),
]
