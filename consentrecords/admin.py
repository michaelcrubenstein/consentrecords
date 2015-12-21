from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import Instance, DeletedInstance, Value, DeletedValue, Transaction

class InstanceInline(admin.TabularInline):
    model = Instance
    extra = 0
    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 'transaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 'transaction')
    show_change_link = True
    
class DeletedInstanceInline(admin.TabularInline):
    model = DeletedInstance
    extra = 0
    fieldsets = (
        (None, {'fields': ('id', 'transaction')}),
    )
    readonly_fields = ('id', 'transaction',)
    show_change_link = True
    
class ValueInline(admin.TabularInline):
    model = Value
    extra = 0
    list_display = ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'position', 'transaction')
    fieldsets = (
        (None, {'fields': ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'fieldID', 'stringValue', 'referenceValue', 'position','transaction')
    show_change_link = True
    
class InstanceValueInline(admin.TabularInline):
    model = Value
    fk_name = 'instance'
    extra = 0
    list_display = ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'position', 'transaction')
    fieldsets = (
        (None, {'fields': ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'fieldID', 'stringValue', 'referenceValue', 'position','transaction')
    show_change_link = True
    
class DeletedValueInline(admin.TabularInline):
    model = DeletedValue
    extra = 0
    readonly_fields = ('id', 'transaction',)
    show_change_link = True
    
class DeletedInstanceAdmin(admin.ModelAdmin):

    fieldsets = (
        (None, {'fields': ('id', 'transaction')}),
    )
    readonly_fields = ('id','transaction')
    search_fields = ('id',)

class InstanceAdmin(admin.ModelAdmin):

    list_display = ('id', 'typeID', 'parent', '_description', 'transaction')

    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 'transaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 'transaction')
    search_fields = ('id',)

    inlines = [DeletedInstanceInline, InstanceValueInline]
    
class ValueAdmin(admin.ModelAdmin):

    list_display = ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'position', 'transaction')

    fieldsets = (
        (None, {'fields': ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'fieldID', 'stringValue', 'referenceValue', 'position','transaction')
    search_fields = ('id', 'stringValue')

class DeletedValueAdmin(admin.ModelAdmin):

    fieldsets = (
        (None, {'fields': ('id', 'transaction')}),
    )
    readonly_fields = ('id','transaction')
    search_fields = ('id',)

class TransactionAdmin(admin.ModelAdmin):

    list_display = ('id', 'user', 'creation_time', 'time_zone_offset')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'creation_time', 'time_zone_offset')}),
    )
    readonly_fields = ('id', 'user', 'creation_time', 'time_zone_offset')
    search_fields = ('id',)
    
    inlines = [InstanceInline, DeletedInstanceInline, ValueInline, DeletedValueInline]

admin.site.register(Instance, InstanceAdmin)
admin.site.register(DeletedInstance, DeletedInstanceAdmin)
admin.site.register(Value, ValueAdmin)
admin.site.register(DeletedValue, DeletedValueAdmin)
admin.site.register(Transaction, TransactionAdmin)
