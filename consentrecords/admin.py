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
    show_change_link = True

### An Inline for the names of an element  
class NameInline(TabularInline):
    list_display = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'languageCode', 'text', 't_creationTime', 'deleteTransaction')

    ordering = ['languageCode']
    show_change_link = True
    fk_name = 'parent'
    
class ModelAdmin(admin.ModelAdmin):
    def queryset(self, request):
        qs = super(ModelAdmin, self).queryset(request)
        qs = qs.annotate('transaction__creation_time')
        return qs

    def t_creationTime(self, obj):
        return obj.transaction.creation_time
    t_creationTime.admin_order_field = 'transaction__creation_time'

class AddressHistoryInline(TabularInline):
    model = AddressHistory
    list_display = ('id', 't_creationTime', 'city', 'state', 'zipCode', )
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'city', 'state', 'zipCode', )}),
    )
    readonly_fields = ('id', 't_creationTime', 'city', 'state', 'zipCode', )

    ordering = ['transaction__creation_time']
    fk_name = 'instance'

class StreetInline(TabularInline):
    model = Street
    list_display = ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'position', 'text', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'position', 'text', 'transaction__id', 'deleteTransaction__id')

class AddressAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'city', 'state', 'zipCode', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'city', 'state', 'zipCode', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'city', 'state', 'zipCode', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'city', 'state', 'zipCode', 'transaction__id', 'deleteTransaction__id')

    inlines = [AddressHistoryInline, StreetInline]
        
admin.site.register(Address, AddressAdmin)

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
    
class NotificationInline(TabularInline):
    model = Notification
    list_display = ('id', '__str__', 'name', 'isFresh', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'name', 'isFresh', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'name', 'isFresh', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'name', 'isFresh', 'transaction__id', 'deleteTransaction__id')

class UserAdmin(ModelAdmin):
    list_display = ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'emails__text', 'firstName', 'lastName', 'birthday', 'publicAccess', 'primaryAdministrator__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [UserHistoryInline, UserEmailInline, UserUserAccessInline, UserGroupAccessInline, UserUserAccessRequestInline, NotificationInline]

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

class CommentPromptTextInline(NameInline):
    model = CommentPromptText
    
class CommentPromptAdmin(ModelAdmin):
    list_display = ('id', '__str__', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'transaction__id', 'deleteTransaction__id')

    inlines = [CommentPromptTextInline]
        
admin.site.register(CommentPrompt, CommentPromptAdmin)

class CommentPromptTextHistoryInline(TabularInline):
    model = CommentPromptTextHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class CommentPromptTextAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [CommentPromptTextHistoryInline]
        
admin.site.register(CommentPromptText, CommentPromptTextAdmin)

class DisqualifyingTagHistoryInline(TabularInline):
    model = DisqualifyingTagHistory
    list_display = ('id', 't_creationTime', 'service')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'service')}),
    )
    readonly_fields = ('id', 't_creationTime', 'service')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class DisqualifyingTagAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'service', 'service__id', 'service__names__text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['service__names__text', 'transaction__creation_time']
    inlines = [DisqualifyingTagHistoryInline]
        
admin.site.register(DisqualifyingTag, DisqualifyingTagAdmin)

class EngagementHistoryInline(TabularInline):
    model = EngagementHistory
    list_display = ('id', 't_creationTime', 'user', 'start', 'end')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'user', 'start', 'end')}),
    )
    readonly_fields = ('id', 't_creationTime', 'user', 'start', 'end')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class EngagementAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'user', 'start', 'end', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'user', 'start', 'end', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'user', 'start', 'end', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'user', 'user__id', 'user__emails__text', 'start', 'end', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['user__emails__text', 'transaction__creation_time']
    inlines = [EngagementHistoryInline]
        
admin.site.register(Engagement, EngagementAdmin)

class EnrollmentHistoryInline(TabularInline):
    model = EnrollmentHistory
    list_display = ('id', 't_creationTime', 'user')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'user')}),
    )
    readonly_fields = ('id', 't_creationTime', 'user')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class EnrollmentAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'user', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'user', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'user', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'user', 'user__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['transaction__creation_time']
    inlines = [EnrollmentHistoryInline]
        
admin.site.register(Enrollment, EnrollmentAdmin)

class ExperiencePromptHistoryInline(TabularInline):
    model = ExperiencePromptHistory
    list_display = ('id', 't_creationTime', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe')}),
    )
    readonly_fields = ('id', 't_creationTime', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class DisqualifyingTagInline(TabularInline):
    model = DisqualifyingTag
    list_display = ('id', 'service', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'service', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'service', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class ExperiencePromptServiceInline(TabularInline):
    model = ExperiencePromptService
    list_display = ('id', 'service', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'service', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'service', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class ExperiencePromptTextInline(NameInline):
    model = ExperiencePromptText
    
class ExperiencePromptAdmin(ModelAdmin):
    list_display = ('id', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'name', 'organization__id', 'organization__names__text', 
                     'site__id', 'site__names__text', 'offering__id', 'offering__names__text', 
                     'domain__id', 'domain__names__text', 'stage', 'timeframe', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['name', 'transaction__creation_time']
    inlines = [ExperiencePromptHistoryInline, DisqualifyingTagInline, ExperiencePromptServiceInline, ExperiencePromptTextInline]
        
admin.site.register(ExperiencePrompt, ExperiencePromptAdmin)

class ExperiencePromptServiceHistoryInline(TabularInline):
    model = ExperiencePromptServiceHistory
    list_display = ('id', 't_creationTime', 'service')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'service')}),
    )
    readonly_fields = ('id', 't_creationTime', 'service')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ExperiencePromptServiceAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'service', 'service__id', 'service__names__text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['service__names__text', 'transaction__creation_time']
    inlines = [ExperiencePromptServiceHistoryInline]
        
admin.site.register(ExperiencePromptService, ExperiencePromptServiceAdmin)

class ExperiencePromptTextHistoryInline(TabularInline):
    model = ExperiencePromptTextHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ExperiencePromptTextAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [ExperiencePromptTextHistoryInline]
        
admin.site.register(ExperiencePromptText, ExperiencePromptTextAdmin)

class GroupNameInline(NameInline):
    model = GroupName
    
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

class InquiryHistoryInline(TabularInline):
    model = InquiryHistory
    list_display = ('id', 't_creationTime', 'user')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'user')}),
    )
    readonly_fields = ('id', 't_creationTime', 'user')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class InquiryAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'user', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'user', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'user', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'user', 'user__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['transaction__creation_time']
    inlines = [InquiryHistoryInline]
        
admin.site.register(Inquiry, InquiryAdmin)

class NotificationHistoryInline(TabularInline):
    model = NotificationHistory
    list_display = ('id', 't_creationTime', 'name', 'isFresh')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'name', 'isFresh')}),
    )
    readonly_fields = ('id', 't_creationTime', 'name', 'isFresh')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class NotificationArgumentInline(TabularInline):
    model = NotificationArgument
    list_display = ('id', 'position', 'argument', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'position', 'argument', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'position', 'argument', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'position', 'argument', 'transaction__id', 'deleteTransaction__id')
    
    ordering = ['position']

class NotificationAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'name', 'isFresh', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'name', 'isFresh', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'name', 'isFresh', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'name', 'isFresh', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['transaction__creation_time']
    inlines = [NotificationHistoryInline, NotificationArgumentInline]
        
admin.site.register(Notification, NotificationAdmin)

class NotificationArgumentHistoryInline(TabularInline):
    model = NotificationArgumentHistory
    list_display = ('id', 't_creationTime', 'position', 'argument')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'position', 'argument')}),
    )
    readonly_fields = ('id', 't_creationTime', 'position', 'argument')

    ordering = ['transaction__creation_time', 'position']
    show_change_link = True
    fk_name = 'instance'

class NotificationArgumentAdmin(ModelAdmin):
    list_display = ('id', 'position', 'argument', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'position', 'argument', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'position', 'argument', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'position', 'argument', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [NotificationArgumentHistoryInline]
        
admin.site.register(NotificationArgument, NotificationArgumentAdmin)

class OfferingHistoryInline(TabularInline):
    model = OfferingHistory
    list_display = ('id', 't_creationTime', 'webSite')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'webSite')}),
    )
    readonly_fields = ('id', 't_creationTime', 'webSite')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class OfferingNameInline(NameInline):
    model = OfferingName
    
class OfferingServiceInline(TabularInline):
    model = OfferingService
    list_display = ('id', '__str__', 'service', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'service', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'service', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'service__id', 'transaction__id', 'deleteTransaction__id')

class SessionInline(TabularInline):
    model = Session
    list_display = ('id', '__str__', 'registrationDeadline', 'start', 'end', 'canRegister', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'registrationDeadline', 'start', 'end', 'canRegister', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'registrationDeadline', 'start', 'end', 'canRegister', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'registrationDeadline', 'start', 'end', 'canRegister', 'transaction__id', 'deleteTransaction__id')

    ordering = ['start', 'end', 'transaction__creation_time']
    
class OfferingAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'names__text', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 'transaction__id', 'deleteTransaction__id')

    inlines = [OfferingHistoryInline, OfferingNameInline, OfferingServiceInline, SessionInline]
        
admin.site.register(Offering, OfferingAdmin)

class OfferingNameHistoryInline(TabularInline):
    model = OfferingNameHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class OfferingNameAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [OfferingNameHistoryInline]
        
admin.site.register(OfferingName, OfferingNameAdmin)

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

class OrganizationNameInline(NameInline):
    model = OrganizationName
    
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
    
class SiteInline(TabularInline):
    model = Site
    list_display = ('id', '__str__', 'webSite', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'webSite', 'transaction__id', 'deleteTransaction__id')

class OrganizationAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'webSite', 'publicAccess', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 'publicAccess', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 'publicAccess', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('names__text', 'id', 'webSite', 'publicAccess', 'inquiryAccessGroup__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [OrganizationHistoryInline, OrganizationNameInline, GroupInline, 
               OrganizationUserAccessInline, OrganizationGroupAccessInline,
               SiteInline]
        
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

class PeriodHistoryInline(TabularInline):
    model = PeriodHistory
    list_display = ('id', 't_creationTime', 'weekday', 'startTime', 'endTime')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'weekday', 'startTime', 'endTime')}),
    )
    readonly_fields = ('id', 't_creationTime', 'weekday', 'startTime', 'endTime')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class PeriodAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'weekday', 'startTime', 'endTime', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'weekday', 'startTime', 'endTime', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'weekday', 'startTime', 'endTime', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'weekday', 'startTime', 'endTime', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['transaction__creation_time']
    inlines = [PeriodHistoryInline]
        
admin.site.register(Period, PeriodAdmin)

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

class ServiceNameInline(NameInline):
    model = ServiceName
    
class ServiceOrganizationLabelInline(ServiceNameInline):
    model = ServiceOrganizationLabel
    
class ServiceSiteLabelInline(ServiceNameInline):
    model = ServiceSiteLabel
    
class ServiceOfferingLabelInline(ServiceNameInline):
    model = ServiceOfferingLabel
    
class ServiceImplicationInline(TabularInline):
    model = ServiceImplication
    list_display = ('id', 'impliedService', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'impliedService', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'impliedService', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class ServiceAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'stage', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'stage', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'stage', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'stage', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [ServiceHistoryInline, ServiceNameInline, ServiceOrganizationLabelInline, ServiceSiteLabelInline, ServiceOfferingLabelInline, ServiceImplicationInline]

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

class ServiceOrganizationLabelHistoryInline(ServiceNameHistoryInline):
    model = ServiceOrganizationLabelHistory   

class ServiceOrganizationLabelAdmin(ServiceNameAdmin):
    inlines = [ServiceOrganizationLabelHistoryInline]
    
admin.site.register(ServiceOrganizationLabel, ServiceOrganizationLabelAdmin)

class ServiceSiteLabelHistoryInline(ServiceNameHistoryInline):
    model = ServiceSiteLabelHistory   

class ServiceSiteLabelAdmin(ServiceNameAdmin):
    inlines = [ServiceSiteLabelHistoryInline]
    
admin.site.register(ServiceSiteLabel, ServiceSiteLabelAdmin)

class ServiceOfferingLabelHistoryInline(ServiceNameHistoryInline):
    model = ServiceOfferingLabelHistory   

class ServiceOfferingLabelAdmin(ServiceNameAdmin):
    inlines = [ServiceOfferingLabelHistoryInline]
    
admin.site.register(ServiceOfferingLabel, ServiceOfferingLabelAdmin)

class SessionHistoryInline(TabularInline):
    model = SessionHistory
    list_display = ('id', 't_creationTime', 'registrationDeadline', 'start', 'end', 'canRegister')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'registrationDeadline', 'start', 'end', 'canRegister')}),
    )
    readonly_fields = ('id', 't_creationTime', 'registrationDeadline', 'start', 'end', 'canRegister')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class SessionNameInline(NameInline):
    model = SessionName

class InquiryInline(TabularInline):
    model = Inquiry
    list_display = ('id', 'user', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'user', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'user', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class EnrollmentInline(TabularInline):
    model = Enrollment
    list_display = ('id', 'user', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'user', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'user', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class EngagementInline(TabularInline):
    model = Engagement
    list_display = ('id', 'user', 'start', 'end', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'start', 'end', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'user', 'start', 'end', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class PeriodInline(TabularInline):
    model = Period
    list_display = ('id', 'weekday', 'startTime', 'endTime', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'weekday', 'startTime', 'endTime', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'weekday', 'startTime', 'endTime', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class SessionAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'parent', 'registrationDeadline', 'start', 'end', 'canRegister', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'registrationDeadline', 'start', 'end', 'canRegister', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'registrationDeadline', 'start', 'end', 'canRegister', 't_creationTime', 'deleteTransaction')
    search_fields = ('names__text', 'id', 'parent__names__text', 'registrationDeadline', 'start', 'end', 'canRegister', 'transaction__id', 'deleteTransaction__id')

    inlines = [SessionHistoryInline, SessionNameInline, InquiryInline, EnrollmentInline, EngagementInline, PeriodInline]
        
admin.site.register(Session, SessionAdmin)

class SessionNameHistoryInline(TabularInline):
    model = SessionNameHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class SessionNameAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [SessionNameHistoryInline]
        
admin.site.register(SessionName, SessionNameAdmin)

class SiteHistoryInline(TabularInline):
    model = SiteHistory
    list_display = ('id', 't_creationTime', 'webSite')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'webSite')}),
    )
    readonly_fields = ('id', 't_creationTime', 'webSite')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class SiteNameInline(NameInline):
    model = SiteName
    
class AddressInline(TabularInline):
    model = Address
    list_display = ('id', '__str__', 'city', 'state', 'zipCode', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'city', 'state', 'zipCode', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'city', 'state', 'zipCode', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'city', 'state', 'zipCode', 'transaction__id', 'deleteTransaction__id')

class OfferingInline(TabularInline):
    model = Offering
    list_display = ('id', '__str__', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'webSite', 'minimumAge', 'maximumAge', 'minimumGrade', 'maximumGrade', 'transaction__id', 'deleteTransaction__id')

class SiteAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'parent', 'webSite', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'webSite', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'webSite', 't_creationTime', 'deleteTransaction')
    search_fields = ('names__text', 'id', 'webSite', 'transaction__id', 'deleteTransaction__id')

    inlines = [SiteHistoryInline, SiteNameInline, AddressInline, OfferingInline]
        
admin.site.register(Site, SiteAdmin)

class SiteNameHistoryInline(TabularInline):
    model = SiteNameHistory
    list_display = ('id', 'languageCode', 't_creationTime', 'text')
    fieldsets = (
        (None, {'fields': ('id', 'languageCode', 't_creationTime', 'text')}),
    )
    readonly_fields = ('id', 'languageCode', 't_creationTime', 'text')

    ordering = ['languageCode', 'transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class SiteNameAdmin(ModelAdmin):
    list_display = ('id', 'languageCode', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'languageCode', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'languageCode', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [SiteNameHistoryInline]
        
admin.site.register(SiteName, SiteNameAdmin)

class StreetHistoryInline(TabularInline):
    model = StreetHistory
    list_display = ('id', 't_creationTime', 'position', 'text')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'position', 'text')}),
    )
    readonly_fields = ('id', 't_creationTime', 'position', 'text')

    ordering = ['transaction__creation_time', 'position']
    show_change_link = True
    fk_name = 'instance'

class StreetAdmin(ModelAdmin):
    list_display = ('id', 'position', 'text', 'parent', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'position', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'position', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'position', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [StreetHistoryInline]
        
admin.site.register(Street, StreetAdmin)

