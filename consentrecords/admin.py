from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import Instance, Value, Transaction, Description
from consentrecords.models import AccessRecord

class AccessRecordInline(admin.TabularInline):
    model = AccessRecord
    fk_name = 'id'
    list_display = ('id', 'source',)
    readonly_fields = ('id', 'source',)
    
class DescriptionInline(admin.TabularInline):
    model = Description
    extra = 0
    list_display = ('text', 'language',)
    readonly_fields = ('text', 'language',)

class InstanceInline(admin.TabularInline):
    model = Instance
    extra = 0
    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 'transaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 'transaction')
    show_change_link = True
    fk_name = 'transaction'

class DeletedInstanceInline(InstanceInline):
    fk_name = 'deleteTransaction'
        
class ValueInline(admin.TabularInline):
    model = Value
    extra = 0
    list_display = ('id', 'instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction')
    fieldsets = (
        (None, {'fields': ('id', 'instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position','transaction')
    show_change_link = True
    fk_name = 'transaction'
    
class InstanceValueInline(ValueInline):
    fk_name = 'instance'
    
class DeletedValueInline(ValueInline):
    fk_name = 'deleteTransaction'
    
class InstanceAdmin(admin.ModelAdmin):

    list_display = ('id', 'typeID', 'parent', '_description', 'transaction', 'deleteTransaction')

    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 'transaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 'transaction')
    search_fields = ('id', 'typeID__id', 'typeID__description__text', 'description__text')

    inlines = [AccessRecordInline, InstanceValueInline]
    
class ValueAdmin(admin.ModelAdmin):

    list_display = ('id', 'instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction', 'deleteTransaction')

    fieldsets = (
        (None, {'fields': ('id', 'instance', 'instance_id', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id','instance', 'instance_id', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position','transaction', 'deleteTransaction')
    search_fields = (['id', 'stringValue', 'referenceValue__value__stringValue'])
    
class TransactionAdmin(admin.ModelAdmin):

    list_display = ('id', 'user', 'creation_time', 'time_zone_offset')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'creation_time', 'time_zone_offset')}),
    )
    readonly_fields = ('id', 'user', 'creation_time', 'time_zone_offset')
    search_fields = ('id',)
    
    inlines = [InstanceInline, DeletedInstanceInline, ValueInline, DeletedValueInline]

class DescriptionAdmin(admin.ModelAdmin):

    list_display = ('id', 'language', 'text', 'instance')
    fieldsets = (
        (None, {'fields': ('id', 'language', 'text', 'instance')}),
    )
    readonly_fields = ('id', 'language', 'text', 'instance')
    search_fields = ('id', 'language', 'text', 'instance__id')

class AccessRecordAdmin(admin.ModelAdmin):
    list_display=('id', 'source')
    fieldsets = (
        (None, {'fields': ('id', 'source')}),
    )
    readonly_fields = ('id', 'source')
    search_fields=('id__description__text', 'source__description__text')
      
admin.site.register(Instance, InstanceAdmin)
admin.site.register(Value, ValueAdmin)
admin.site.register(Transaction, TransactionAdmin)
admin.site.register(AccessRecord, AccessRecordAdmin)
admin.site.register(Description, DescriptionAdmin)
