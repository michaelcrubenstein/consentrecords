from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import Instance, Value, Transaction, Description

class DescriptionInline(admin.TabularInline):
    model = Description
    extra = 0
    list_display = ('text', 'language',)
    readonly_fields = ('text', 'language',)

class InstanceInline(admin.TabularInline):
    model = Instance
    extra = 0
    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 'transaction', 'accessSource', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 'transaction', 'deleteTransaction')
    show_change_link = True
    fk_name = 'transaction'

class DeletedInstanceInline(InstanceInline):
    fk_name = 'deleteTransaction'
        
class ValueInline(admin.TabularInline):
    model = Value
    extra = 0
    list_display = ('id', 'instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id','instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 't_creationTime', 'deleteTransaction')

    def queryset(self, request):
        qs = super(InstanceAdmin, self).queryset(request)
        qs = qs.annotate('transaction__creation_time')
        return qs

    def t_creationTime(self, obj):
        return obj.transaction.creation_time
    t_creationTime.admin_order_field = 'transaction__creation_time'
    
    show_change_link = True
    fk_name = 'transaction'
    
class InstanceValueInline(ValueInline):
    fk_name = 'instance'
    
class DeletedValueInline(ValueInline):
    fk_name = 'deleteTransaction'
    
class InstanceAdmin(admin.ModelAdmin):

    list_display = ('id', 'typeID', 'parent', '_description', 't_creationTime', 'accessSource', 'deleteTransaction')

    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', '_description', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', '_description', 't_creationTime')
    search_fields = ('id', 'typeID__id', 'parent__id', 'typeID__description__text', 'description__text', 'parent__description__text')

    def queryset(self, request):
        qs = super(InstanceAdmin, self).queryset(request)
        qs = qs.annotate('transaction__creation_time')
        return qs

    def t_creationTime(self, obj):
        return obj.transaction.creation_time
    t_creationTime.admin_order_field = 'transaction__creation_time'
    
    inlines = [InstanceValueInline]
    
class ValueAdmin(admin.ModelAdmin):

    list_display = ('id', 'instance', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction', 'deleteTransaction')

    fieldsets = (
        (None, {'fields': ('id', 'instance', 'instance_id', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position', 'transaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id','instance', 'instance_id', 'field', 'stringValue', 'referenceValue', 'languageCode', 'position','transaction', 'deleteTransaction')
    search_fields = (['id', 'instance__id', 'stringValue', 'referenceValue__value__stringValue'])
    
class TransactionAdmin(admin.ModelAdmin):

    list_display = ('id', 'user', 'creation_time')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'creation_time')}),
    )
    readonly_fields = ('id', 'user', 'creation_time')
    search_fields = ('id', 'user__id', 'user__email')
    
    inlines = [InstanceInline, DeletedInstanceInline, ValueInline, DeletedValueInline]

class DescriptionAdmin(admin.ModelAdmin):

    list_display = ('id', 'text', 'instance')
    fieldsets = (
        (None, {'fields': ('id', 'text', 'instance')}),
    )
    readonly_fields = ('id', 'text', 'instance')
    search_fields = ('id', 'text', 'instance__id')

admin.site.register(Instance, InstanceAdmin)
admin.site.register(Value, ValueAdmin)
admin.site.register(Transaction, TransactionAdmin)
admin.site.register(Description, DescriptionAdmin)
