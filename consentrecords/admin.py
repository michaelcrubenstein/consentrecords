from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import Instance, DeletedInstance, Value, DeletedValue, Transaction, Description
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
    list_display = ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction')
    fieldsets = (
        (None, {'fields': ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'fieldID', 'stringValue', 'referenceValue', 'languageCode', 'position','transaction')
    show_change_link = True
    fk_name = 'transaction'
    
class InstanceValueInline(ValueInline):
    fk_name = 'instance'
    
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
    search_fields = ('id', 'typeID__id', 'typeID__description__text', 'description__text')

    inlines = [DeletedInstanceInline, AccessRecordInline, DescriptionInline, InstanceValueInline]
    
class ValueAdmin(admin.ModelAdmin):

    list_display = ('id', 'instance', 'fieldID', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction')

    fieldsets = (
        (None, {'fields': ('id', 'instance', 'instance_id', 'fieldID', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction')}),
    )
    readonly_fields = ('id','instance', 'instance_id', 'fieldID', 'stringValue', 'referenceValue', 'languageCode', 'position','transaction')
    search_fields = ('id', 'instance_id', 'stringValue', 'referenceValue__value__stringValue')
    
    inlines= [DeletedValueInline]

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
    search_fields=('id_description', 'source__description')
      
admin.site.register(Instance, InstanceAdmin)
admin.site.register(DeletedInstance, DeletedInstanceAdmin)
admin.site.register(Value, ValueAdmin)
admin.site.register(DeletedValue, DeletedValueAdmin)
admin.site.register(Transaction, TransactionAdmin)
admin.site.register(AccessRecord, AccessRecordAdmin)
admin.site.register(Description, DescriptionAdmin)
