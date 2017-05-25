from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import *

class DescriptionInline(admin.TabularInline):
    model = Description
    extra = 0
    list_display = ('text', 'language',)
    readonly_fields = ('text', 'language',)

class InstanceInline(admin.TabularInline):
    model = Instance
    extra = 0
    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', 'deleteTransaction')

    def queryset(self, request):
        qs = super(InstanceAdmin, self).queryset(request)
        qs = qs.annotate('transaction__creation_time')
        return qs

    def t_creationTime(self, obj):
        return obj.transaction.creation_time
    t_creationTime.admin_order_field = 'transaction__creation_time'
    
    show_change_link = False
    fk_name = 'transaction'

class DeletedInstanceInline(InstanceInline):
    fieldsets = (
        (None, {'fields': ('id', 'typeID', 'parent', 't_creationTime')}),
    )
    readonly_fields = ('id', 'typeID', 'parent', 't_creationTime')

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

class TabularInline(admin.TabularInline):
    extra = 0
    can_delete = False
    
    def queryset(self, request):
        qs = super(TabularInline, self).queryset(request)
        qs = qs.annotate('transaction__creation_time')
        return qs

    def t_creationTime(self, obj):
        return obj.transaction.creation_time
    t_creationTime.admin_order_field = 'transaction__creation_time'
    
class ModelAdmin(admin.ModelAdmin):
    def queryset(self, request):
        qs = super(ModelAdmin, self).queryset(request)
        qs = qs.annotate('transaction__creation_time')
        return qs

    def t_creationTime(self, obj):
        return obj.transaction.creation_time
    t_creationTime.admin_order_field = 'transaction__creation_time'

class UserHistoryInline(TabularInline):
    model = UserHistory
    list_display = ('id', 't_creationTime', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator')}),
    )
    readonly_fields = ('id', 't_creationTime', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class UserEmailInline(TabularInline):
    model = UserEmail
    list_display = ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')

    ordering = ['position']
    show_change_link = True
    fk_name = 'parent'
    
class UserUserAccessInline(TabularInline):
    model = UserUserAccess
    list_display = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')

    ordering = ['privilege', 'id']
    show_change_link = True
    fk_name = 'parent'
    
class UserGroupAccessInline(TabularInline):
    model = UserGroupAccess
    list_display = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')

    ordering = ['privilege', 'id']
    show_change_link = True
    fk_name = 'parent'
    
class UserUserAccessRequestInline(TabularInline):
    model = UserUserAccessRequest
    list_display = ('id', 'accessee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'accessee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'accessee', 't_creationTime', 'deleteTransaction')

    ordering = ['id']
    show_change_link = True
    fk_name = 'parent'
    
class UserAdmin(ModelAdmin):
    list_display = ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [UserHistoryInline, UserEmailInline, UserUserAccessInline, UserGroupAccessInline, UserUserAccessRequestInline]

admin.site.register(User, UserAdmin)

class UserEmailHistoryInline(TabularInline):
    model = UserEmailHistory
    list_display = ('id', 'position', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'position', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'position', 't_creationTime', 'text')

    ordering = ['position', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class UserEmailAdmin(ModelAdmin):
    list_display = ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'position', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'position', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [UserEmailHistoryInline]

admin.site.register(UserEmail, UserEmailAdmin)

class OrganizationHistoryInline(TabularInline):
    model = OrganizationHistory
    list_display = ('id', 't_creationTime', 'webSite', 'publicAccess', 'inquiryAccessGroup')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'webSite', 'publicAccess', 'inquiryAccessGroup')}),
    )
    readonly_fields = ('id', 't_creationTime', 'webSite', 'publicAccess', 'inquiryAccessGroup')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class OrganizationNameInline(TabularInline):
    model = OrganizationName
    list_display = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')

    ordering = ['languageCode']
    show_change_link = True
    fk_name = 'parent'
    
class GroupInline(TabularInline):
    model = Group
    list_display = ('id', '__str__', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'transaction__id', 'deleteTransaction__id')

class OrganizationUserAccessInline(TabularInline):
    model = OrganizationUserAccess
    list_display = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')

    ordering = ['privilege', 'id']
    show_change_link = True
    fk_name = 'parent'
    
class OrganizationGroupAccessInline(TabularInline):
    model = OrganizationGroupAccess
    list_display = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'privilege', 'accessee', 't_creationTime', 'deleteTransaction')

    ordering = ['privilege', 'id']
    show_change_link = True
    fk_name = 'parent'
    
class OrganizationAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'webSite', 'publicAccess', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 'publicAccess', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 'publicAccess', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('names__text', 'id', 'webSite', 'publicAccess', 'inquiryAccessGroup__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [OrganizationHistoryInline, OrganizationNameInline, GroupInline, OrganizationUserAccessInline, OrganizationGroupAccessInline]
        
admin.site.register(Organization, OrganizationAdmin)

class OrganizationNameHistoryInline(TabularInline):
    model = OrganizationNameHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class OrganizationNameAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [OrganizationNameHistoryInline]
        
admin.site.register(OrganizationName, OrganizationNameAdmin)

class GroupNameInline(TabularInline):
    model = GroupName
    list_display = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')

    ordering = ['languageCode']
    show_change_link = True
    fk_name = 'parent'
    
class GroupAdmin(ModelAdmin):
    list_display = ('id', '__str__', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'transaction__id', 'deleteTransaction__id')

    inlines = [GroupNameInline]
        
admin.site.register(Group, GroupAdmin)

class GroupNameHistoryInline(TabularInline):
    model = GroupNameHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class GroupNameAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [GroupNameHistoryInline]
        
admin.site.register(GroupName, GroupNameAdmin)

class ServiceHistoryInline(TabularInline):
    model = ServiceHistory
    list_display = ('id', 't_creationTime', 'stage')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'stage')}),
    )
    readonly_fields = ('id', 't_creationTime', 'stage')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ServiceNameInline(TabularInline):
    model = ServiceName
    list_display = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')

    ordering = ['languageCode']
    show_change_link = True
    fk_name = 'parent'
    
class ServiceAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'stage', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'stage', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'stage', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'stage', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [ServiceHistoryInline, ServiceNameInline]

admin.site.register(Service, ServiceAdmin)

class ServiceNameHistoryInline(TabularInline):
    model = ServiceNameHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ServiceNameAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [ServiceNameHistoryInline]
        
admin.site.register(ServiceName, ServiceNameAdmin)

