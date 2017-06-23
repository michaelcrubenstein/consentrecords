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

class DescriptionAdmin(admin.ModelAdmin):

    list_display = ('id', 'text', 'instance')
    fieldsets = (
        (None, {'fields': ('id', 'text', 'instance')}),
    )
    readonly_fields = ('id', 'text', 'instance')
    search_fields = ('id', 'text', 'instance__id')

admin.site.register(Instance, InstanceAdmin)
admin.site.register(Value, ValueAdmin)
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

### An Inline for access records.   
class AccessInline(TabularInline):
    list_display = ('id', 'privilege', 'grantee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'privilege', 'grantee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'privilege', 'grantee', 't_creationTime', 'deleteTransaction')

    ordering = ['privilege', 'id']
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
    list_display = ('id', 't_creationTime', 'firstName', 'lastName', 'birthday')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'firstName', 'lastName', 'birthday')}),
    )
    readonly_fields = ('id', 't_creationTime', 'firstName', 'lastName', 'birthday')

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
    
class UserUserGrantRequestInline(TabularInline):
    model = UserUserGrantRequest
    list_display = ('id', 'grantee', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'grantee', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'grantee', 't_creationTime', 'deleteTransaction')

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

class PathInline(TabularInline):
    model = Path
    list_display = ('id', '__str__', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 'transaction__id', 'deleteTransaction__id')

    fk_name = 'parent'
    
class UserAdmin(ModelAdmin):
    list_display = ('id', 'firstName', 'lastName', 'birthday', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'firstName', 'lastName', 'birthday', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'firstName', 'lastName', 'birthday', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'emails__text', 'firstName', 'lastName', 'birthday', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [UserHistoryInline, UserEmailInline, UserUserGrantRequestInline, NotificationInline, PathInline]

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
        (None, {'fields': ('id', 'parent', 'parent_id', 'position', 'text', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'parent', 'parent_id', 'position', 'text', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'parent__id', 'position', 'text', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    inlines = [UserEmailHistoryInline]

admin.site.register(UserEmail, UserEmailAdmin)

class UserUserGrantRequestHistoryInline(TabularInline):
    model = UserUserGrantRequestHistory
    list_display = ('id', 't_creationTime', 'grantee')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'grantee')}),
    )
    readonly_fields = ('id', 't_creationTime', 'grantee')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class UserUserGrantRequestAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'grantee', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'grantee', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'grantee', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'grantee', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [UserUserGrantRequestHistoryInline]

admin.site.register(UserUserGrantRequest, UserUserGrantRequestAdmin)

class CommentHistoryInline(TabularInline):
    model = CommentHistory
    list_display = ('id', 't_creationTime', 'text', 'question', 'asker')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'text', 'question', 'asker')}),
    )
    readonly_fields = ('id', 't_creationTime', 'text', 'question', 'asker')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class CommentAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'text', 'question', 'asker', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'text', 'question', 'asker', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'text', 'question', 'asker', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'text', 'question', 'asker', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [CommentHistoryInline]

admin.site.register(Comment, CommentAdmin)

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

class ExperienceHistoryInline(TabularInline):
    model = ExperienceHistory
    list_display = ('id', 't_creationTime', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe')}),
    )
    readonly_fields = ('id', 't_creationTime', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ExperienceServiceInline(TabularInline):
    model = ExperienceService
    list_display = ('id', 'service', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'service', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'service', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class ExperienceCustomServiceInline(TabularInline):
    model = ExperienceCustomService
    list_display = ('id', 'name', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'name', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'name', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class CommentInline(TabularInline):
    model = Comment
    list_display = ('id', 'text', 'question', 'asker', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'text', 'question', 'asker', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'text', 'question', 'asker', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class ExperienceAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['transaction__creation_time']
    inlines = [ExperienceHistoryInline, ExperienceServiceInline, ExperienceCustomServiceInline, CommentInline]
        
admin.site.register(Experience, ExperienceAdmin)

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

class ExperienceCustomServiceHistoryInline(TabularInline):
    model = ExperienceCustomServiceHistory
    list_display = ('id', 't_creationTime', 'name')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'name')}),
    )
    readonly_fields = ('id', 't_creationTime', 'name')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ExperienceCustomServiceAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'name', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'name', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'name', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'name', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [ExperienceCustomServiceHistoryInline]

admin.site.register(ExperienceCustomService, ExperienceCustomServiceAdmin)

class ExperienceServiceHistoryInline(TabularInline):
    model = ExperienceServiceHistory
    list_display = ('id', 't_creationTime','position',  'service')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'position', 'service')}),
    )
    readonly_fields = ('id', 't_creationTime', 'position', 'service')

    ordering = ['transaction__creation_time', 'position']
    show_change_link = True
    fk_name = 'instance'

class ExperienceServiceAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'position', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'position', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'position', 'service', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'position', 'service', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [ExperienceServiceHistoryInline]

admin.site.register(ExperienceService, ExperienceServiceAdmin)

class GroupNameInline(NameInline):
    model = GroupName
    
class GroupMemberInline(TabularInline):
    model = GroupMember
    list_display = ('id', 'user', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'user', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'user', 't_creationTime', 'deleteTransaction')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'parent'
    
class GroupAdmin(ModelAdmin):
    list_display = ('id', '__str__', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'transaction__id', 'deleteTransaction__id')

    inlines = [GroupNameInline, GroupMemberInline]
        
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

class GroupMemberHistoryInline(TabularInline):
    model = GroupMemberHistory
    list_display = ('id', 't_creationTime', 'user')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'user')}),
    )
    readonly_fields = ('id', 't_creationTime', 'user')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

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
    list_display = ('id', '__str__', 'position', 'service', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'position', 'service', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'position', 'service', 't_creationTime', 'deleteTransaction')
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

class OfferingServiceHistoryInline(TabularInline):
    model = OfferingServiceHistory
    list_display = ('id', 't_creationTime', 'position', 'service')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'position', 'service')}),
    )
    readonly_fields = ('id', 't_creationTime', 'position', 'service')

    ordering = ['transaction__creation_time', 'position']
    show_change_link = True
    fk_name = 'instance'

class OfferingServiceAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'position', 'service', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'parent', 'position', 'service', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'parent', 'position', 'service', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'service__id', 'transaction__id', 'deleteTransaction__id')

    inlines = [OfferingServiceHistoryInline]

admin.site.register(OfferingService, OfferingServiceAdmin)

class OrganizationHistoryInline(TabularInline):
    model = OrganizationHistory
    list_display = ('id', 't_creationTime', 'webSite', 'inquiryAccessGroup')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'webSite', 'inquiryAccessGroup')}),
    )
    readonly_fields = ('id', 't_creationTime', 'webSite', 'inquiryAccessGroup')

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

class SiteInline(TabularInline):
    model = Site
    list_display = ('id', '__str__', 'webSite', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'webSite', 'transaction__id', 'deleteTransaction__id')

class OrganizationAdmin(ModelAdmin):
    list_display = ('id', '__str__', 'webSite', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('names__text', 'id', 'webSite', 'inquiryAccessGroup__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [OrganizationHistoryInline, OrganizationNameInline, GroupInline, 
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

class PathHistoryInline(TabularInline):
    model = PathHistory
    list_display = ('id', 't_creationTime', 'name', 'birthday', 'specialAccess', 'canAnswerExperience')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'name', 'birthday', 'specialAccess', 'canAnswerExperience')}),
    )
    readonly_fields = ('id', 't_creationTime', 'name', 'birthday', 'specialAccess', 'canAnswerExperience')

    ordering = ['transaction__creation_time']
    fk_name = 'instance'

class ExperienceInline(TabularInline):
    model = Experience
    list_display = ('id', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'organization', 'customOrganization', 'site', 'customSite', 'offering', 'customOffering', 'start', 'end', 'timeframe', 't_creationTime', 'deleteTransaction')

    ordering = ['start', 'end', 'transaction__creation_time']
    fk_name = 'parent'
    
class PathAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'name', 'birthday', 'specialAccess', 'canAnswerExperience', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    ordering = ['transaction__creation_time']
    inlines = [PathHistoryInline, ExperienceInline]
        
admin.site.register(Path, PathAdmin)

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

class ServiceImplicationHistoryInline(TabularInline):
    model = ServiceImplicationHistory
    list_display = ('id', 't_creationTime', 'impliedService')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'impliedService')}),
    )
    readonly_fields = ('id', 't_creationTime', 'impliedService')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class ServiceImplicationAdmin(ModelAdmin):
    list_display = ('id', 'parent', 'impliedService', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('parent', 'parent_id', 'id', 'impliedService', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('parent', 'parent_id', 'id', 'impliedService', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'impliedService', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [ServiceImplicationHistoryInline]

admin.site.register(ServiceImplication, ServiceImplicationAdmin)

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

class GrantTargetHistoryInline(TabularInline):
    model = GrantTargetHistory
    list_display = ('id', 't_creationTime', 'publicAccess', 'primaryAdministrator')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'publicAccess', 'primaryAdministrator')}),
    )
    readonly_fields = ('id', 't_creationTime', 'publicAccess', 'primaryAdministrator')

    ordering = ['transaction__creation_time']
    show_change_link = True
    fk_name = 'instance'

class UserGrantInline(TabularInline):
    model = UserGrant
    list_display = ('id', 'grantee', 'privilege', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'grantee', 'privilege', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'grantee', 'privilege', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'grantee', 'privilege', 'transaction__id', 'deleteTransaction__id')

class GroupGrantInline(TabularInline):
    model = GroupGrant
    list_display = ('id', 'grantee', 'privilege', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'grantee', 'privilege', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'grantee', 'privilege', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'grantee', 'privilege', 'transaction__id', 'deleteTransaction__id')

class GrantTargetAdmin(ModelAdmin):
    list_display = ('id', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'publicAccess', 'primaryAdministrator__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    inlines = [GrantTargetHistoryInline, UserGrantInline, GroupGrantInline]
        
admin.site.register(GrantTarget, GrantTargetAdmin)

class UserGrantHistoryInline(TabularInline):
    model = UserGrantHistory
    list_display = ('id', 'grantee', 'privilege', 't_creationTime')
    fieldsets = (
        (None, {'fields': ('id', 'grantee', 'privilege', 't_creationTime')}),
    )
    readonly_fields = ('id', 'grantee', 'privilege', 't_creationTime')
    search_fields = ('id', 'grantee', 'privilege', 'transaction__id')

class GroupGrantHistoryInline(TabularInline):
    model = GroupGrantHistory
    list_display = ('id', 'grantee', 'privilege', 't_creationTime')
    fieldsets = (
        (None, {'fields': ('id', 'grantee', 'privilege', 't_creationTime')}),
    )
    readonly_fields = ('id', 'grantee', 'privilege', 't_creationTime')
    search_fields = ('id', 'grantee', 'privilege', 'transaction__id')

class LastModifiedCommentPromptInline(TabularInline):
    model = CommentPrompt
    
    list_display = ('id', '__str__', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'transaction__id', 'deleteTransaction__id')

    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Comment Prompt'
    verbose_name_plural = 'Last Modified Comment Prompts'

class CreatedCommentPromptInline(LastModifiedCommentPromptInline):
    fk_name = 'transaction'
    verbose_name = 'Created Comment Prompt'
    verbose_name_plural = 'Created Comment Prompts'

class DeletedCommentPromptInline(LastModifiedCommentPromptInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Comment Prompt'
    verbose_name_plural = 'Deleted Comment Prompts'

class CreatedCommentPromptTextInline(CommentPromptTextInline):
    fk_name = 'transaction'
    verbose_name = 'Created Comment Prompt Text'
    verbose_name_plural = 'Created Comment Prompt Texts'

class LastModifiedCommentPromptTextInline(CommentPromptTextInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Comment Prompt Text'
    verbose_name_plural = 'Last Modified Comment Prompt Texts'

class DeletedCommentPromptTextInline(CommentPromptTextInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Comment Prompt Text'
    verbose_name_plural = 'Deleted Comment Prompt Texts'

class TransactionCommentPromptTextHistoryInline(CommentPromptTextHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Comment Prompt Text History'
    verbose_name_plural = 'Comment Prompt Text Histories'

class LastModifiedServiceInline(TabularInline):
    model = Service

    list_display = ('id', '__str__', 'stage', 't_creationTime', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'stage', 't_creationTime', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'stage', 't_creationTime', 'deleteTransaction')
    search_fields = ('id', 'stage', 'transaction__id', 'deleteTransaction__id')
    
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Service'
    verbose_name_plural = 'Last Modified Services'

class CreatedServiceInline(LastModifiedServiceInline):
    fk_name = 'transaction'
    verbose_name = 'Created Service'
    verbose_name_plural = 'Created Services'

class DeletedServiceInline(LastModifiedServiceInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Service'
    verbose_name_plural = 'Deleted Services'

class TransactionServiceHistoryInline(ServiceHistoryInline):
    fk_name = 'transaction'
 
class CreatedServiceNameInline(ServiceNameInline):
    fk_name = 'transaction'
    verbose_name = 'Created Service Name'
    verbose_name_plural = 'Created Service Names'

class LastModifiedServiceNameInline(ServiceNameInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Service Name'
    verbose_name_plural = 'Last Modified Service Names'

class DeletedServiceNameInline(ServiceNameInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Service Name'
    verbose_name_plural = 'Deleted Service Names'

class TransactionServiceNameHistoryInline(ServiceNameHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Service Name History'
    verbose_name_plural = 'Service Name Histories'

class CreatedServiceOrganizationLabelInline(ServiceOrganizationLabelInline):
    fk_name = 'transaction'
    verbose_name = 'Created Service Organization Label'
    verbose_name_plural = 'Created Service Organization Labels'

class LastModifiedServiceOrganizationLabelInline(ServiceOrganizationLabelInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Service Organization Label'
    verbose_name_plural = 'Last Modified Service Organization Labels'

class DeletedServiceOrganizationLabelInline(ServiceOrganizationLabelInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Service Organization Label'
    verbose_name_plural = 'Deleted Service Organization Labels'

class TransactionServiceOrganizationLabelHistoryInline(ServiceOrganizationLabelHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Service Organization Label History'
    verbose_name_plural = 'Service Organization Label Histories'

class CreatedServiceSiteLabelInline(ServiceSiteLabelInline):
    fk_name = 'transaction'
    verbose_name = 'Created Service Site Label'
    verbose_name_plural = 'Created Service Site Labels'

class LastModifiedServiceSiteLabelInline(ServiceSiteLabelInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Service Site Label'
    verbose_name_plural = 'Last Modified Service Site Labels'

class DeletedServiceSiteLabelInline(ServiceSiteLabelInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Service Site Label'
    verbose_name_plural = 'Deleted Service Site Labels'

class TransactionServiceSiteLabelHistoryInline(ServiceSiteLabelHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Service Site Label History'
    verbose_name_plural = 'Service Site Label Histories'

class CreatedServiceOfferingLabelInline(ServiceOfferingLabelInline):
    fk_name = 'transaction'
    verbose_name = 'Created Service Offering Label'
    verbose_name_plural = 'Created Service Offering Labels'

class LastModifiedServiceOfferingLabelInline(ServiceOfferingLabelInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Service Offering Label'
    verbose_name_plural = 'Last Modified Service Offering Labels'

class DeletedServiceOfferingLabelInline(ServiceOfferingLabelInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Service Offering Label'
    verbose_name_plural = 'Deleted Service Offering Labels'

class TransactionServiceOfferingLabelHistoryInline(ServiceOfferingLabelHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Service Offering Label History'
    verbose_name_plural = 'Service Offering Label Histories'

class CreatedServiceImplicationInline(ServiceImplicationInline):
    fk_name = 'transaction'
    verbose_name = 'Created Service Implication'
    verbose_name_plural = 'Created Service Implications'

class LastModifiedServiceImplicationInline(ServiceImplicationInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Service Implication'
    verbose_name_plural = 'Last Modified Service Implications'

class DeletedServiceImplicationInline(ServiceImplicationInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Service Implication'
    verbose_name_plural = 'Deleted Service Implications'

class TransactionServiceImplicationHistoryInline(ServiceImplicationHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Service Implication History'
    verbose_name_plural = 'Service Implication Histories'

class TransactionOrganizationInline(TabularInline):
    model = Organization
    
    list_display = ('id', '__str__', 'webSite', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'webSite', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'webSite', 'inquiryAccessGroup', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('names__text', 'id', 'webSite', 'inquiryAccessGroup__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Organization'
    verbose_name_plural = 'Last Modified Organizations'

class CreatedOrganizationInline(TransactionOrganizationInline):
    fk_name = 'transaction'
    verbose_name = 'Created Organization'
    verbose_name_plural = 'Created Organizations'

class DeletedOrganizationInline(TransactionOrganizationInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Organization'
    verbose_name_plural = 'Deleted Organizations'

class TransactionOrganizationHistoryInline(OrganizationHistoryInline):
    fk_name = 'transaction'
 
class CreatedOrganizationNameInline(OrganizationNameInline):
    fk_name = 'transaction'
    verbose_name = 'Created Organization Name'
    verbose_name_plural = 'Created Organization Names'

class LastModifiedOrganizationNameInline(OrganizationNameInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Organization Name'
    verbose_name_plural = 'Last Modified Organization Names'

class DeletedOrganizationNameInline(OrganizationNameInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Organization Name'
    verbose_name_plural = 'Deleted Organization Names'

class TransactionOrganizationNameHistoryInline(OrganizationNameHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Organization Name History'
    verbose_name_plural = 'Organization Name Histories'

class CreatedGroupInline(GroupInline):
    fk_name = 'transaction'
    verbose_name = 'Created Group'
    verbose_name_plural = 'Created Groups'

class DeletedGroupInline(GroupInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Group'
    verbose_name_plural = 'Deleted Groups'

class CreatedGroupNameInline(GroupNameInline):
    fk_name = 'transaction'
    verbose_name = 'Created Group Name'
    verbose_name_plural = 'Created Group Names'

class LastModifiedGroupNameInline(GroupNameInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Group Name'
    verbose_name_plural = 'Last Modified Group Names'

class DeletedGroupNameInline(GroupNameInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Group Name'
    verbose_name_plural = 'Deleted Group Names'

class TransactionGroupNameHistoryInline(GroupNameHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Group Name History'
    verbose_name_plural = 'Group Name Histories'

class CreatedGroupMemberInline(GroupMemberInline):
    fk_name = 'transaction'
    verbose_name = 'Created Group Member'
    verbose_name_plural = 'Created Group Members'

class LastModifiedGroupMemberInline(GroupMemberInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Group Member'
    verbose_name_plural = 'Last Modified Group Members'

class DeletedGroupMemberInline(GroupMemberInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Group Member'
    verbose_name_plural = 'Deleted Group Members'

class TransactionGroupMemberHistoryInline(GroupMemberHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Group Member History'
    verbose_name_plural = 'Group Member Histories'

class CreatedSiteInline(SiteInline):
    fk_name = 'transaction'
    verbose_name = 'Created Site'
    verbose_name_plural = 'Created Sites'

class LastModifiedSiteInline(SiteInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Site'
    verbose_name_plural = 'Last Modified Sites'

class DeletedSiteInline(SiteInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Site'
    verbose_name_plural = 'Deleted Sites'

class TransactionSiteHistoryInline(SiteHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Site History'
    verbose_name_plural = 'Site Histories'

class CreatedSiteNameInline(SiteNameInline):
    fk_name = 'transaction'
    verbose_name = 'Created Site Name'
    verbose_name_plural = 'Created Site Names'

class LastModifiedSiteNameInline(SiteNameInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Site Name'
    verbose_name_plural = 'Last Modified Site Names'

class DeletedSiteNameInline(SiteNameInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Site Name'
    verbose_name_plural = 'Deleted Site Names'

class TransactionSiteNameHistoryInline(SiteNameHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Site Name History'
    verbose_name_plural = 'Site Name Histories'

class CreatedAddressInline(AddressInline):
    fk_name = 'transaction'
    verbose_name = 'Created Address'
    verbose_name_plural = 'Created Addresses'

class LastModifiedAddressInline(AddressInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Address'
    verbose_name_plural = 'Last Modified Addresses'

class DeletedAddressInline(AddressInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Address'
    verbose_name_plural = 'Deleted Addresses'

class TransactionAddressHistoryInline(AddressHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Address History'
    verbose_name_plural = 'Address Histories'

class CreatedStreetInline(StreetInline):
    fk_name = 'transaction'
    verbose_name = 'Created Street'
    verbose_name_plural = 'Created Streets'

class LastModifiedStreetInline(StreetInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Street'
    verbose_name_plural = 'Last Modified Streets'

class DeletedStreetInline(StreetInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Street'
    verbose_name_plural = 'Deleted Streets'

class TransactionStreetHistoryInline(StreetHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Street History'
    verbose_name_plural = 'Street Histories'

class CreatedOfferingInline(OfferingInline):
    fk_name = 'transaction'
    verbose_name = 'Created Offering'
    verbose_name_plural = 'Created Offerings'

class LastModifiedOfferingInline(OfferingInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Offering'
    verbose_name_plural = 'Last Modified Offerings'

class DeletedOfferingInline(OfferingInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Offering'
    verbose_name_plural = 'Deleted Offerings'

class TransactionOfferingHistoryInline(OfferingHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Offering History'
    verbose_name_plural = 'Offering Histories'

class CreatedOfferingNameInline(OfferingNameInline):
    fk_name = 'transaction'
    verbose_name = 'Created Offering Name'
    verbose_name_plural = 'Created Offering Names'

class LastModifiedOfferingNameInline(OfferingNameInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Offering Name'
    verbose_name_plural = 'Last Modified Offering Names'

class DeletedOfferingNameInline(OfferingNameInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Offering Name'
    verbose_name_plural = 'Deleted Offering Names'

class TransactionOfferingNameHistoryInline(OfferingNameHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Offering Name History'
    verbose_name_plural = 'Offering Name Histories'

class CreatedOfferingServiceInline(OfferingServiceInline):
    fk_name = 'transaction'
    verbose_name = 'Created Offering Service'
    verbose_name_plural = 'Created Offering Services'

class LastModifiedOfferingServiceInline(OfferingServiceInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Offering Service'
    verbose_name_plural = 'Last Modified Offering Services'

class DeletedOfferingServiceInline(OfferingServiceInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Offering Service'
    verbose_name_plural = 'Deleted Offering Services'

class TransactionOfferingServiceHistoryInline(OfferingServiceHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Offering Service History'
    verbose_name_plural = 'Offering Service Histories'

class CreatedSessionInline(SessionInline):
    fk_name = 'transaction'
    verbose_name = 'Created Session'
    verbose_name_plural = 'Created Sessions'

class LastModifiedSessionInline(SessionInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Session'
    verbose_name_plural = 'Last Modified Sessions'

class DeletedSessionInline(SessionInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Session'
    verbose_name_plural = 'Deleted Sessions'

class TransactionSessionHistoryInline(SessionHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Session History'
    verbose_name_plural = 'Session Histories'

class CreatedSessionNameInline(SessionNameInline):
    fk_name = 'transaction'
    verbose_name = 'Created Session Name'
    verbose_name_plural = 'Created Session Names'

class LastModifiedSessionNameInline(SessionNameInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Session Name'
    verbose_name_plural = 'Last Modified Session Names'

class DeletedSessionNameInline(SessionNameInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Session Name'
    verbose_name_plural = 'Deleted Session Names'

class TransactionSessionNameHistoryInline(SessionNameHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Session Name History'
    verbose_name_plural = 'Session Name Histories'

class CreatedEngagementInline(EngagementInline):
    fk_name = 'transaction'
    verbose_name = 'Created Engagement'
    verbose_name_plural = 'Created Engagements'

class LastModifiedEngagementInline(EngagementInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Engagement'
    verbose_name_plural = 'Last Modified Engagements'

class DeletedEngagementInline(EngagementInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Engagement'
    verbose_name_plural = 'Deleted Engagements'

class TransactionEngagementHistoryInline(EngagementHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Engagement History'
    verbose_name_plural = 'Engagement Histories'

class CreatedEnrollmentInline(EnrollmentInline):
    fk_name = 'transaction'
    verbose_name = 'Created Enrollment'
    verbose_name_plural = 'Created Enrollments'

class LastModifiedEnrollmentInline(EnrollmentInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Enrollment'
    verbose_name_plural = 'Last Modified Enrollments'

class DeletedEnrollmentInline(EnrollmentInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Enrollment'
    verbose_name_plural = 'Deleted Enrollments'

class TransactionEnrollmentHistoryInline(EnrollmentHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Enrollment History'
    verbose_name_plural = 'Enrollment Histories'

class CreatedInquiryInline(InquiryInline):
    fk_name = 'transaction'
    verbose_name = 'Created Inquiry'
    verbose_name_plural = 'Created Inquiries'

class LastModifiedInquiryInline(InquiryInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Inquiry'
    verbose_name_plural = 'Last Modified Inquiries'

class DeletedInquiryInline(InquiryInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Inquiry'
    verbose_name_plural = 'Deleted Inquiries'

class TransactionInquiryHistoryInline(InquiryHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Inquiry History'
    verbose_name_plural = 'Inquiry Histories'

class CreatedPeriodInline(PeriodInline):
    fk_name = 'transaction'
    verbose_name = 'Created Period'
    verbose_name_plural = 'Created Periods'

class LastModifiedPeriodInline(PeriodInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Period'
    verbose_name_plural = 'Last Modified Periods'

class DeletedPeriodInline(PeriodInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Period'
    verbose_name_plural = 'Deleted Periods'

class TransactionPeriodHistoryInline(PeriodHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Period History'
    verbose_name_plural = 'Period Histories'

class LastModifiedExperiencePromptInline(TabularInline):
    model = ExperiencePrompt
    list_display = ('id', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'name', 'organization', 'site', 'offering', 'domain', 'stage', 'timeframe', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'name', 'organization__id', 'organization__names__text', 
                     'site__id', 'site__names__text', 'offering__id', 'offering__names__text', 
                     'domain__id', 'domain__names__text', 'stage', 'timeframe', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')

    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Experience Prompt'
    verbose_name_plural = 'Last Modified Experience Prompts'
    ordering = ['name', 'transaction__creation_time']
        
class CreatedExperiencePromptInline(LastModifiedExperiencePromptInline):
    fk_name = 'transaction'
    verbose_name = 'Created Experience Prompt'
    verbose_name_plural = 'Created Experience Prompts'

class DeletedExperiencePromptInline(LastModifiedExperiencePromptInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Experience Prompt'
    verbose_name_plural = 'Deleted Experience Prompts'

class TransactionExperiencePromptHistoryInline(ExperiencePromptHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Experience Prompt History'
    verbose_name_plural = 'Experience Prompt Histories'

class CreatedExperiencePromptTextInline(ExperiencePromptTextInline):
    fk_name = 'transaction'
    verbose_name = 'Created Experience Prompt Text'
    verbose_name_plural = 'Created Experience Prompt Texts'

class LastModifiedExperiencePromptTextInline(ExperiencePromptTextInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Experience Prompt Text'
    verbose_name_plural = 'Last Modified Experience Prompt Texts'

class DeletedExperiencePromptTextInline(ExperiencePromptTextInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Experience Prompt Text'
    verbose_name_plural = 'Deleted Experience Prompt Texts'

class TransactionExperiencePromptTextHistoryInline(ExperiencePromptTextHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Experience Prompt Text History'
    verbose_name_plural = 'Experience Prompt Text Histories'

class CreatedExperiencePromptServiceInline(ExperiencePromptServiceInline):
    fk_name = 'transaction'
    verbose_name = 'Created Experience Prompt Service'
    verbose_name_plural = 'Created Experience Prompt Services'

class LastModifiedExperiencePromptServiceInline(ExperiencePromptServiceInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Experience Prompt Service'
    verbose_name_plural = 'Last Modified Experience Prompt Services'

class DeletedExperiencePromptServiceInline(ExperiencePromptServiceInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Experience Prompt Service'
    verbose_name_plural = 'Deleted Experience Prompt Services'

class TransactionExperiencePromptServiceHistoryInline(ExperiencePromptServiceHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Experience Prompt Service History'
    verbose_name_plural = 'Experience Prompt Service Histories'

class CreatedDisqualifyingTagInline(DisqualifyingTagInline):
    fk_name = 'transaction'
    verbose_name = 'Created Disqualifying Tag'
    verbose_name_plural = 'Created Disqualifying Tags'

class LastModifiedDisqualifyingTagInline(DisqualifyingTagInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Disqualifying Tag'
    verbose_name_plural = 'Last Modified Disqualifying Tags'

class DeletedDisqualifyingTagInline(DisqualifyingTagInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Disqualifying Tag'
    verbose_name_plural = 'Deleted Disqualifying Tags'

class TransactionDisqualifyingTagHistoryInline(DisqualifyingTagHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Disqualifying Tag History'
    verbose_name_plural = 'Disqualifying Tag Histories'

class LastModifiedUserInline(TabularInline):
    model = User

    list_display = ('id', 'firstName', 'lastName', 'birthday', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'firstName', 'lastName', 'birthday', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'firstName', 'lastName', 'birthday', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'emails__text', 'firstName', 'lastName', 'birthday', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified User'
    verbose_name_plural = 'Last Modified Users'

class CreatedUserInline(LastModifiedUserInline):
    fk_name = 'transaction'
    verbose_name = 'Created User'
    verbose_name_plural = 'Created Users'

class DeletedUserInline(LastModifiedUserInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted User'
    verbose_name_plural = 'Deleted Users'

class TransactionUserHistoryInline(UserHistoryInline):
    fk_name = 'transaction'
 
class CreatedUserEmailInline(UserEmailInline):
    fk_name = 'transaction'
    verbose_name = 'Created User Email'
    verbose_name_plural = 'Created User Emails'

class LastModifiedUserEmailInline(UserEmailInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified User Email'
    verbose_name_plural = 'Last Modified User Emails'

class DeletedUserEmailInline(UserEmailInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted User Email'
    verbose_name_plural = 'Deleted User Emails'

class TransactionUserEmailHistoryInline(UserEmailHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'User Email History'
    verbose_name_plural = 'User Email Histories'

class CreatedUserUserGrantRequestInline(UserUserGrantRequestInline):
    fk_name = 'transaction'
    verbose_name = 'Created User User Grant Request'
    verbose_name_plural = 'Created User User Grant Requests'

class LastModifiedUserUserGrantRequestInline(UserUserGrantRequestInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified User User Grant Request'
    verbose_name_plural = 'Last Modified User User Grant Requests'

class DeletedUserUserGrantRequestInline(UserUserGrantRequestInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted User User Grant Request'
    verbose_name_plural = 'Deleted User User Grant Requests'

class TransactionUserUserGrantRequestHistoryInline(UserUserGrantRequestHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'User User Grant Request History'
    verbose_name_plural = 'User User Grant Request Histories'

class CreatedNotificationInline(NotificationInline):
    fk_name = 'transaction'
    verbose_name = 'Created Notification'
    verbose_name_plural = 'Created Notifications'

class LastModifiedNotificationInline(NotificationInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Notification'
    verbose_name_plural = 'Last Modified Notifications'

class DeletedNotificationInline(NotificationInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Notification'
    verbose_name_plural = 'Deleted Notifications'

class TransactionNotificationHistoryInline(NotificationHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Notification History'
    verbose_name_plural = 'Notification Histories'

class CreatedNotificationArgumentInline(NotificationArgumentInline):
    fk_name = 'transaction'
    verbose_name = 'Created Notification Argument'
    verbose_name_plural = 'Created Notification Arguments'

class LastModifiedNotificationArgumentInline(NotificationArgumentInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Notification Argument'
    verbose_name_plural = 'Last Modified Notification Arguments'

class DeletedNotificationArgumentInline(NotificationArgumentInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Notification Argument'
    verbose_name_plural = 'Deleted Notification Arguments'

class TransactionNotificationArgumentHistoryInline(NotificationArgumentHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Notification Argument History'
    verbose_name_plural = 'Notification Argument Histories'

class CreatedPathInline(PathInline):
    fk_name = 'transaction'
    verbose_name = 'Created Path'
    verbose_name_plural = 'Created Paths'

class LastModifiedPathInline(PathInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Path'
    verbose_name_plural = 'Last Modified Paths'

class DeletedPathInline(PathInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Path'
    verbose_name_plural = 'Deleted Paths'

class TransactionPathHistoryInline(PathHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Path History'
    verbose_name_plural = 'Path Histories'

class CreatedExperienceInline(ExperienceInline):
    fk_name = 'transaction'
    verbose_name = 'Created Experience'
    verbose_name_plural = 'Created Experiences'

class LastModifiedExperienceInline(ExperienceInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Experience'
    verbose_name_plural = 'Last Modified Experiences'

class DeletedExperienceInline(ExperienceInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Experience'
    verbose_name_plural = 'Deleted Experiences'

class TransactionExperienceHistoryInline(ExperienceHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Experience History'
    verbose_name_plural = 'Experience Histories'

class CreatedExperienceServiceInline(ExperienceServiceInline):
    fk_name = 'transaction'
    verbose_name = 'Created Experience Service'
    verbose_name_plural = 'Created Experience Services'

class LastModifiedExperienceServiceInline(ExperienceServiceInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Experience Service'
    verbose_name_plural = 'Last Modified Experience Services'

class DeletedExperienceServiceInline(ExperienceServiceInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Experience Service'
    verbose_name_plural = 'Deleted Experience Services'

class TransactionExperienceServiceHistoryInline(ExperienceServiceHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Experience Service History'
    verbose_name_plural = 'Experience Service Histories'

class CreatedExperienceCustomServiceInline(ExperienceCustomServiceInline):
    fk_name = 'transaction'
    verbose_name = 'Created Experience Custom Service'
    verbose_name_plural = 'Created Experience Custom Services'

class LastModifiedExperienceCustomServiceInline(ExperienceCustomServiceInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Experience Custom Service'
    verbose_name_plural = 'Last Modified Experience Custom Services'

class DeletedExperienceCustomServiceInline(ExperienceCustomServiceInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Experience Custom Service'
    verbose_name_plural = 'Deleted Experience Custom Services'

class TransactionExperienceCustomServiceHistoryInline(ExperienceCustomServiceHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Experience Custom Service History'
    verbose_name_plural = 'Experience Custom Service Histories'

class CreatedCommentInline(CommentInline):
    fk_name = 'transaction'
    verbose_name = 'Created Comment'
    verbose_name_plural = 'Created Comments'

class LastModifiedCommentInline(CommentInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Comment'
    verbose_name_plural = 'Last Modified Comments'

class DeletedCommentInline(CommentInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Comment'
    verbose_name_plural = 'Deleted Comments'

class TransactionCommentHistoryInline(CommentHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Comment History'
    verbose_name_plural = 'Comment Histories'

class LastModifiedGrantTargetInline(TabularInline):
    model = GrantTarget

    list_display = ('id', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    fieldsets = (
        (None, {'fields': ('id', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')}),
    )
    readonly_fields = ('id', 'publicAccess', 'primaryAdministrator', 't_creationTime', 'lastTransaction', 'deleteTransaction')
    search_fields = ('id', 'publicAccess', 'primaryAdministrator__id', 'transaction__id', 'lastTransaction__id', 'deleteTransaction__id')
    
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Grant Target'
    verbose_name_plural = 'Last Modified Grant Targets'

class CreatedGrantTargetInline(LastModifiedGrantTargetInline):
    fk_name = 'transaction'
    verbose_name = 'Created Grant Target'
    verbose_name_plural = 'Created Grant Targets'

class DeletedGrantTargetInline(LastModifiedGrantTargetInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Grant Target'
    verbose_name_plural = 'Deleted Grant Targets'

class TransactionGrantTargetHistoryInline(GrantTargetHistoryInline):
    fk_name = 'transaction'
 
class CreatedUserGrantInline(UserGrantInline):
    fk_name = 'transaction'
    verbose_name = 'Created User Grant'
    verbose_name_plural = 'Created User Grants'

class LastModifiedUserGrantInline(UserGrantInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified User Grant'
    verbose_name_plural = 'Last Modified User Grants'

class DeletedUserGrantInline(UserGrantInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted User Grant'
    verbose_name_plural = 'Deleted User Grants'

class TransactionUserGrantHistoryInline(UserGrantHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'User Grant History'
    verbose_name_plural = 'User Grant Histories'

class CreatedGroupGrantInline(GroupGrantInline):
    fk_name = 'transaction'
    verbose_name = 'Created Group Grant'
    verbose_name_plural = 'Created Group Grants'

class LastModifiedGroupGrantInline(GroupGrantInline):
    fk_name = 'lastTransaction'
    verbose_name = 'Last Modified Group Grant'
    verbose_name_plural = 'Last Modified Group Grants'

class DeletedGroupGrantInline(GroupGrantInline):
    fk_name = 'deleteTransaction'
    verbose_name = 'Deleted Group Grant'
    verbose_name_plural = 'Deleted Group Grants'

class TransactionGroupGrantHistoryInline(GroupGrantHistoryInline):
    fk_name = 'transaction'
    verbose_name = 'Group Grant History'
    verbose_name_plural = 'Group Grant Histories'

class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'creation_time')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'creation_time')}),
    )
    readonly_fields = ('id', 'user', 'creation_time')
    search_fields = ('id', 'user__id', 'user__email')
    
    ordering = ['-creation_time']
    
    inlines = [\
               DeletedCommentPromptInline, 
               DeletedCommentPromptTextInline, 
               DeletedServiceInline, 
               DeletedServiceNameInline, 
               DeletedServiceOrganizationLabelInline, 
               DeletedServiceSiteLabelInline, 
               DeletedServiceOfferingLabelInline, 
               DeletedServiceImplicationInline, 
               DeletedOrganizationInline, 
               DeletedOrganizationNameInline, 
               DeletedGroupInline,
               DeletedGroupNameInline,
               DeletedGroupMemberInline,
               DeletedSiteInline, 
               DeletedSiteNameInline, 
               DeletedAddressInline, 
               DeletedStreetInline, 
               DeletedOfferingInline, 
               DeletedOfferingNameInline, 
               DeletedOfferingServiceInline, 
               DeletedSessionInline, 
               DeletedSessionNameInline, 
               DeletedEngagementInline, 
               DeletedEnrollmentInline, 
               DeletedInquiryInline, 
               DeletedPeriodInline, 
               DeletedExperiencePromptInline, 
               DeletedExperiencePromptTextInline, 
               DeletedExperiencePromptServiceInline, 
               DeletedDisqualifyingTagInline, 
               DeletedUserInline, 
               DeletedUserEmailInline, 
               DeletedUserUserGrantRequestInline, 
               DeletedNotificationInline, 
               DeletedNotificationArgumentInline, 
               DeletedPathInline, 
               DeletedExperienceInline, 
               DeletedExperienceServiceInline, 
               DeletedExperienceCustomServiceInline, 
               DeletedCommentInline, 
               DeletedGrantTargetInline, 
               DeletedUserGrantInline, 
               DeletedGroupGrantInline, 
               CreatedCommentPromptInline, LastModifiedCommentPromptInline,
               CreatedCommentPromptTextInline, LastModifiedCommentPromptTextInline, TransactionCommentPromptTextHistoryInline,
               CreatedServiceInline, LastModifiedServiceInline, TransactionServiceHistoryInline,
               CreatedServiceNameInline, LastModifiedServiceNameInline, TransactionServiceNameHistoryInline,
               CreatedServiceOrganizationLabelInline, LastModifiedServiceOrganizationLabelInline, TransactionServiceOrganizationLabelHistoryInline,
               CreatedServiceSiteLabelInline, LastModifiedServiceSiteLabelInline, TransactionServiceSiteLabelHistoryInline,
               CreatedServiceOfferingLabelInline, LastModifiedServiceOfferingLabelInline, TransactionServiceOfferingLabelHistoryInline,
               CreatedServiceImplicationInline, LastModifiedServiceImplicationInline, TransactionServiceImplicationHistoryInline,
               CreatedOrganizationInline, TransactionOrganizationInline, TransactionOrganizationHistoryInline,
               CreatedOrganizationNameInline, LastModifiedOrganizationNameInline, TransactionOrganizationNameHistoryInline,
               CreatedGroupInline, 
               CreatedGroupNameInline, LastModifiedGroupNameInline, TransactionGroupNameHistoryInline,
               CreatedGroupMemberInline, LastModifiedGroupMemberInline, TransactionGroupMemberHistoryInline,
               CreatedSiteInline, LastModifiedSiteInline, TransactionSiteHistoryInline,
               CreatedSiteNameInline, LastModifiedSiteNameInline, TransactionSiteNameHistoryInline,
               CreatedAddressInline, LastModifiedAddressInline, TransactionAddressHistoryInline,
               CreatedStreetInline, LastModifiedStreetInline, TransactionStreetHistoryInline,
               CreatedOfferingInline, LastModifiedOfferingInline, TransactionOfferingHistoryInline,
               CreatedOfferingNameInline, LastModifiedOfferingNameInline, TransactionOfferingNameHistoryInline,
               CreatedOfferingServiceInline, LastModifiedOfferingServiceInline, TransactionOfferingServiceHistoryInline,
               CreatedSessionInline, LastModifiedSessionInline, TransactionSessionHistoryInline,
               CreatedSessionNameInline, LastModifiedSessionNameInline, TransactionSessionNameHistoryInline,
               CreatedEngagementInline, LastModifiedEngagementInline, TransactionEngagementHistoryInline,
               CreatedEnrollmentInline, LastModifiedEnrollmentInline, TransactionEnrollmentHistoryInline,
               CreatedInquiryInline, LastModifiedInquiryInline, TransactionInquiryHistoryInline,
               CreatedPeriodInline, LastModifiedPeriodInline, TransactionPeriodHistoryInline,
               CreatedExperiencePromptInline, LastModifiedExperiencePromptInline, TransactionExperiencePromptHistoryInline,
               CreatedExperiencePromptTextInline, LastModifiedExperiencePromptTextInline, TransactionExperiencePromptTextHistoryInline,
               CreatedExperiencePromptServiceInline, LastModifiedExperiencePromptServiceInline, TransactionExperiencePromptServiceHistoryInline,
               CreatedDisqualifyingTagInline, LastModifiedDisqualifyingTagInline, TransactionDisqualifyingTagHistoryInline,
               CreatedUserInline, LastModifiedUserInline, TransactionUserHistoryInline,
               CreatedUserEmailInline, LastModifiedUserEmailInline, TransactionUserEmailHistoryInline,
               CreatedUserUserGrantRequestInline, LastModifiedUserUserGrantRequestInline, TransactionUserUserGrantRequestHistoryInline,
               CreatedNotificationInline, LastModifiedNotificationInline, TransactionNotificationHistoryInline,
               CreatedNotificationArgumentInline, LastModifiedNotificationArgumentInline, TransactionNotificationArgumentHistoryInline,
               CreatedPathInline, LastModifiedPathInline, TransactionPathHistoryInline,
               CreatedExperienceInline, LastModifiedExperienceInline, TransactionExperienceHistoryInline,
               CreatedExperienceServiceInline, LastModifiedExperienceServiceInline, TransactionExperienceServiceHistoryInline,
               CreatedExperienceCustomServiceInline, LastModifiedExperienceCustomServiceInline, TransactionExperienceCustomServiceHistoryInline,
               CreatedCommentInline, LastModifiedCommentInline, TransactionCommentHistoryInline,
               CreatedGrantTargetInline, LastModifiedGrantTargetInline, TransactionGrantTargetHistoryInline,
               CreatedUserGrantInline, LastModifiedUserGrantInline, TransactionUserGrantHistoryInline,
               CreatedGroupGrantInline, LastModifiedGroupGrantInline, TransactionGroupGrantHistoryInline,
               InstanceInline, DeletedInstanceInline, ValueInline, DeletedValueInline, 
              ]

admin.site.register(Transaction, TransactionAdmin)
