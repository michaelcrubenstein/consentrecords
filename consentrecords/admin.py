from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import Instance, DeletedInstance, Value, DeletedValue, Transaction

class InstanceAdmin(admin.ModelAdmin):

    list_display = ('id', 'typeID', 'parent', '_description', 'transaction')

    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 'transaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 'transaction')
    search_fields = ('typeID', )

class DeletedInstanceAdmin(admin.ModelAdmin):

    fieldsets = (
        (None, {'fields': ('id', 'transaction')}),
    )
    readonly_fields = ('id','transaction')
    search_fields = ('id',)

class InstanceInline(admin.StackedInline):
    model = Instance
    extra = 0
    
class DeletedInstanceInline(admin.StackedInline):
    model = DeletedInstance
    extra = 0
    
class ValueAdmin(admin.ModelAdmin):

    list_display = ('id', 'instance', 'field', 'objectValue', 'instanceid', 'fieldID', 'stringValue', 'position', 'transaction')

    fieldsets = (
        (None, {'fields': ('id', 'instance', 'field',  'objectValue', 'instanceid', 'fieldID', 'stringValue','position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'field', 'instanceid', 'fieldID', 'stringValue', 'objectValue', 'position','transaction')
    search_fields = ('instance', 'instanceid', 'fieldID', 'stringValue')

class DeletedValueAdmin(admin.ModelAdmin):

    fieldsets = (
        (None, {'fields': ('id', 'transaction')}),
    )
    readonly_fields = ('id','transaction')
    search_fields = ('id',)

class ValueInline(admin.StackedInline):
    model = Value
    extra = 0
    
class DeletedValueInline(admin.StackedInline):
    model = DeletedValue
    extra = 0
    
class TransactionAdmin(admin.ModelAdmin):

    list_display = ('id', 'user', 'creation_time', 'time_zone_offset')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'creation_time', 'time_zone_offset')}),
    )
    readonly_fields = ('id','user', 'creation_time', 'time_zone_offset')
    search_fields = ('id',)
    
    inlines = [InstanceInline, DeletedInstanceInline, ValueInline, DeletedValueInline]

admin.site.register(Instance, InstanceAdmin)
admin.site.register(DeletedInstance, DeletedInstanceAdmin)
admin.site.register(Value, ValueAdmin)
admin.site.register(DeletedValue, DeletedValueAdmin)
admin.site.register(Transaction, TransactionAdmin)
