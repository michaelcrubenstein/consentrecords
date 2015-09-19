from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm, ReadOnlyPasswordHashField
from django import forms

from consentrecords.models import Fact, DeletedFact, Transaction

class FactAdmin(admin.ModelAdmin):

    list_display = ('id', 'subject', 'verb', 'directObject', 'verbString', 'transaction')

    fieldsets = (
        (None, {'fields': ('id', 'subject', 'verb', 'directObject', 'transaction')}),
    )
    readonly_fields = ('id','subject','verb','directObject','transaction')
    search_fields = ('subject','verb','directObject',)

class DeletedFactAdmin(admin.ModelAdmin):

    fieldsets = (
        (None, {'fields': ('id', 'transaction')}),
    )
    readonly_fields = ('id','transaction')
    search_fields = ('id',)

class FactInline(admin.StackedInline):
    model = Fact
    extra = 0
    
class DeletedFactInline(admin.StackedInline):
    model = DeletedFact
    extra = 0
    
class TransactionFactAdmin(admin.ModelAdmin):

    list_display = ('id', 'user', 'creation_time', 'time_zone_offset')
    fieldsets = (
        (None, {'fields': ('id', 'user', 'creation_time', 'time_zone_offset')}),
    )
    readonly_fields = ('id','user', 'creation_time', 'time_zone_offset')
    search_fields = ('id',)
    
    inlines = [FactInline, DeletedFactInline]

admin.site.register(Fact, FactAdmin)
admin.site.register(DeletedFact, DeletedFactAdmin)
admin.site.register(Transaction, TransactionFactAdmin)
