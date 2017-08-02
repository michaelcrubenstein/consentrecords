# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
from django.db.models import F, Q, Prefetch

django.setup()

from consentrecords.models import *

nullString = "-"

def printExperienceCustomService(i):
    print("%s\t%s\n\t%s\n\t%s" % \
        (i.id, 
         i.text or nullString,
         str(i.asker) if i.asker else nullString,
         i.question or nullString,
         ))
         
def printExperience(i):
    print("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s" % \
        (i.id, str(i.organization) if i.organization else nullString, 
         i.customOrganization or nullString,
         str(i.site) if i.site else nullString,
         i.customSite or nullString,
         str(i.offering) if i.offering else nullString,
         i.customOffering or nullString,
         i.start or nullString,
         i.end or nullString,
         i.timeframe or nullString,
         ))
    for j in i.experienceImplications.all():
        print("\tImplied Service: %s" % str(j.service))

def printExperienceCustomService(i):
    print("%s\t%s\t%s" % \
        (i.id, 
         i.position or nullString,
         i.name or nullString,
         ))
         
def printExperienceImplication(i):
    print("%s\t%s\t%s" % \
        (i.id, 
         str(i.experience) if i.experience else nullString,
         str(i.service) if i.service else nullString,
         ))
         
def printExperienceService(i):
    print("%s\t%s\t%s" % \
        (i.id, 
         i.position or nullString,
         str(i.service) if i.service else nullString,
         ))
         
def printPath(i):
    print("%s\t%s\t%s\t%s\t%s\t%s" % \
        (i.id, i.parent, i.birthday or nullString, i.name or nullString, 
         i.specialAccess or nullString, 
         i.canAnswerExperience or nullString,
        ))

def printTranslation(i):
    print("%s\t%s\t%s" % \
        (i.id, 
         i.text or nullString,
         i.languageCode or nullString,
         ))
         
def printUser(i):
    print("%s\t%s\t%s\t%s" % 
        (i.id, i.firstName or nullString, i.lastName or nullString, i.birthday or nullString,
        ))
         
def revertExperience(h):
    i = h.instance

    i.organization = h.organization
    i.customOrganization = h.customOrganization
    i.site = h.site
    i.customSite = h.customSite
    i.offering = h.offering
    i.customOffering = h.customOffering
    i.start = h.start
    i.end = h.end
    i.timeframe = h.timeframe

    i.lastTransaction = h.transaction
    h.delete()
    i.save()
    i.checkImplications()

def revertExperienceService(h):
    i = h.instance

    i.position = h.position
    i.service = h.service

    i.lastTransaction = h.transaction
    h.delete()
    i.save()

def revertExperienceCustomService(h):
    i = h.instance

    i.position = h.position
    i.name = h.name

    i.lastTransaction = h.transaction
    h.delete()
    i.save()

def printTransaction(t):
    print("Transaction\t%s\t%s\t%s" % (t.id, t.user, t.creation_time))
    
    fieldsTitle = "\ttext/asker/comments"
    if t.createdComments.count():
        print("\nCreated Comments" + fieldsTitle)
        for i in t.createdComments.all():
            printComment(i)
    if t.changedComments.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged Comments" + fieldsTitle)
        for i in t.changedComments.exclude(lastTransaction=F('transaction')):
            printComment(i)
    if t.deletedComments.count():
        print("\nDeleted Comments" + fieldsTitle)
        for i in t.deletedComments.all():
            printComment(i)
    if t.commentHistories.count():
        print("\Comment Histories" + fieldsTitle)
        for i in t.commentHistories.all():
            printComment(i)

    fieldsTitle = "\torganization\tcustom organization\tsite\tcustom site\toffering\tcustom offering\tstart\tend\ttimeframe"
    pluralName = "Experiences"
    singularName = "Experience"
    if t.createdExperiences.count():
        print("\nCreated {0: <24}".format(pluralName) + fieldsTitle)
        for i in t.createdExperiences.all():
            printExperience(i)
    if t.changedExperiences.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged {0: <24}".format(pluralName) + fieldsTitle)
        for i in t.changedExperiences.exclude(lastTransaction=F('transaction')):
            printExperience(i)
    if t.deletedExperiences.count():
        print("\nDeleted {0: <24}".format(pluralName) + fieldsTitle)
        for i in t.deletedExperiences.all():
            printExperience(i)
    if t.experienceHistories.count():
        print("\n{0: <21} Histories".format(singularName) + fieldsTitle)
        for i in t.experienceHistories.all():
            printExperience(i)

    fieldsTitle = "\tposition\tname"
    if t.createdExperienceCustomServices.count():
        print("\nCreated Experience Custom Services" + fieldsTitle)
        for i in t.createdExperienceCustomServices.all():
            printExperienceCustomService(i)
    if t.changedExperienceCustomServices.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged Experience Custom Services" + fieldsTitle)
        for i in t.changedExperienceCustomServices.exclude(lastTransaction=F('transaction')):
            printExperienceCustomService(i)
    if t.deletedExperienceCustomServices.count():
        print("\nDeleted Experience Custom Services" + fieldsTitle)
        for i in t.deletedExperienceCustomServices.all():
            printExperienceCustomService(i)
    if t.experienceCustomServiceHistories.count():
        print("\nExperience Custom Histories" + fieldsTitle)
        for i in t.experienceCustomServiceHistories.all():
            printExperienceCustomService(i)

    fieldsTitle = "\tposition\tservice"
    if t.createdExperienceServices.count():
        print("\nCreated Experience Services" + fieldsTitle)
        for i in t.createdExperienceServices.all():
            printExperienceService(i)
    if t.changedExperienceServices.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged Experience Services" + fieldsTitle)
        for i in t.changedExperienceServices.exclude(lastTransaction=F('transaction')):
            printExperienceService(i)
    if t.deletedExperienceServices.count():
        print("\nDeleted Experience Services" + fieldsTitle)
        for i in t.deletedExperienceServices.all():
            printExperienceService(i)
    if t.experienceServiceHistories.count():
        print("\nExperience Service Histories" + fieldsTitle)
        for i in t.experienceServiceHistories.all():
            printExperienceService(i)

    fieldsTitle = "\tuser\tbirthday\tname\tspecial access\tcan answer experience"
    if t.createdPaths.count():
        print("\nCreated Paths" + fieldsTitle)
        for i in t.createdPaths.all():
            printPath(i)
    if t.changedPaths.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged Paths" + fieldsTitle)
        for i in t.changedPaths.exclude(lastTransaction=F('transaction')):
            printPath(i)
    if t.deletedPaths.count():
        print("\nDeleted Paths" + fieldsTitle)
        for i in t.deletedPaths.all():
            printPath(i)
    if t.pathHistories.count():
        print("\nPathHistories" + fieldsTitle)
        for i in t.pathHistories.all():
            printPath(i)

    fieldsTitle = "\tfirst name\tlast name\tbirthday"
    if t.createdUsers.count():
        print("\nCreated Users" + fieldsTitle)
        for i in t.createdUsers.all():
            printUser(i)
    if t.changedUsers.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged Users" + fieldsTitle)
        for i in t.changedUsers.exclude(lastTransaction=F('transaction')):
            printUser(i)
    if t.deletedUsers.count():
        print("\nDeleted Users" + fieldsTitle)
        for i in t.deletedUsers.all():
            printUser(i)
    if t.userHistories.count():
        print("\nUser Histories" + fieldsTitle)
        for i in t.userHistories.all():
            printUser(i)

    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administered', db_index=True, null=True, on_delete=dbmodels.CASCADE)

if __name__ == "__main__":
    with transaction.atomic():
        t = Transaction.objects.order_by('-creation_time')[0]
        
        printTransaction(t)
        if '-yes' in sys.argv:
            for i in t.changedExperiences.exclude(transaction=t):
                h = i.history.order_by('-transaction__creation_time')[0]
                revertExperience(h)
            for i in t.deletedExperiences.all():
                i.deleteTransaction=None
                i.save()
                i.checkImplications()
                
            for i in t.changedExperienceServices.exclude(transaction=t):
                h = i.history.order_by('-transaction__creation_time')[0]
                revertExperienceService(h)
            for i in t.deletedExperienceServices.all():
                i.deleteTransaction=None
                i.save()
                i.createImplications()

            for i in t.changedExperienceCustomServices.exclude(transaction=t):
                h = i.history.order_by('-transaction__creation_time')[0]
                revertExperienceCustomService(h)
            for i in t.deletedExperienceCustomServices.all():
                i.deleteTransaction=None
                i.save()

# 
#         if t.deletedValue.count():
#             sys.stderr.write('Restoring %s values\n'%t.deletedValue.count())
#     
#         if t.deletedInstance.count():
#             sys.stderr.write('Restoring %s instances\n'%t.deletedInstance.count())
#     
#         for v in t.deletedValue.all():
#             v.deleteTransaction=None
#             v.save()
#     
#         instances = list(t.deletedInstance.all())
#         if len(instances):
#             for i in instances:
#                 if i.typeID.defaultCustomAccess:
#                     i.accessSource = i
#                     i.save()
#             
#             foundOne = False
#             while not foundOne:
#                 foundOne = False
#                 for i in instances:
#                     print(i)
#                     i.refresh_from_db()
#                     i.parent.refresh_from_db()
#                     if not i.accessSource and i.parent.accessSource:
#                         i.accessSource = i.parent.accessSource
#                         i.save()
#                         foundOne = True
#                     
#             for i in instances:
#                 i.deleteTransaction=None
#                 i.save()
#             
#         if t.value_set.count():
#             sys.stderr.write('Deleting %s values\n'%t.value_set.count())
#     
#         if t.instance_set.count():
#             sys.stderr.write('Deleting %s instances\n'%t.instance_set.count())
    
            print(t.delete())
    
            sys.stderr.write('Transaction deleted: %s\n'%t)