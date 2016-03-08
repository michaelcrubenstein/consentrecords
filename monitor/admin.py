from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from monitor.models import *

class LogRecordAdmin(admin.ModelAdmin):
    list_display=('id', 'creation_time', 'user', 'name', 'message')
    fieldsets = (
        (None, {'fields': ('id', 'creation_time', 'user', 'name', 'message')}),
    )
    readonly_fields = ('id', 'creation_time', 'user', 'name', 'message')
    search_fields=('id', 'user__email', 'name', 'message')
      
admin.site.register(LogRecord, LogRecordAdmin)
