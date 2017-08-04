# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
from django.db.models import F, Q, Prefetch

django.setup()

from consentrecords.models import *

nullString = "-"

def printComment(i):
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
         
def printNotification(i):
    print("%s\t%s\t%s\t%s" % \
        (i.id, 
         str(i.parent),
         i.name or nullString,
         i.isFresh or nullString,
         ))
    for na in i.notificationArguments.filter(deleteTransaction__isnull=True):
        
        print("\t%s\t%s\t%s" % \
              (na.id, na.position, na.argument))
         
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
        
def printUserGrant(i):
    if User.objects.filter(pk=i.grantor_id).exists():
        grantor = User.objects.get(pk=i.grantor_id)
    elif Organization.objects.filter(pk=i.grantor_id).exists():
        grantor = Organization.objects.get(pk=i.grantor_id)
    else:
        grantor = i.grantor_id
    print("%s\t%s\t%s\t%s" %
          (
            i.id, str(grantor), str(i.grantee), i.privilege or nullString
          ))
         
def printUserUserGrantRequest(i):
    print("%s\t%s\t%s" %
          (
            i.id, str(i.parent), str(i.grantee)
          ))
         
def revertComment(h, i):
    i.text = h.text
    i.question = h.question
    i.asker = h.asker

def revertExperience(h, i):
    i.organization = h.organization
    i.customOrganization = h.customOrganization
    i.site = h.site
    i.customSite = h.customSite
    i.offering = h.offering
    i.customOffering = h.customOffering
    i.start = h.start
    i.end = h.end
    i.timeframe = h.timeframe
    i.save()
    i.checkImplications()

def revertExperienceService(h, i):
    i.position = h.position
    i.service = h.service

def revertExperienceCustomService(h, i):
    i.position = h.position
    i.name = h.name

def revertNotification(h, i):
    i.isFresh = h.isFresh
    i.name = h.name

def revertGrant(h, i):
    i.grantee = h.grantee
    i.privilege = h.privilege
    
def revertUserUserGrantRequest(h, i):
    i.grantee = h.grantee

def revertChanged(changed, revertData):
    for i in changed.exclude(transaction=t):
        h = i.history.order_by('-transaction__creation_time')[0]
        revertData(h, i)    
        i.lastTransaction = h.transaction
        i.save()

def revertDeleted(deleted):
    for i in deleted.all():
        i.deleteTransaction=None
        i.save()
    
def printTable(fieldsTitle, pluralName, singularName, f, created, changed, deleted, histories):
    if created.count():
        print("\nCreated {0: <24}".format(pluralName) + fieldsTitle)
        for i in created.all():
            f(i)
    if changed.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged {0: <24}".format(pluralName) + fieldsTitle)
        for i in changed.exclude(lastTransaction=F('transaction')):
            f(i)
    if deleted.count():
        print("\nDeleted {0: <24}".format(pluralName) + fieldsTitle)
        for i in deleted.all():
            f(i)
    if histories.count():
        print("\n{0: <21} Histories".format(singularName) + fieldsTitle)
        for i in histories.all():
            f(i)

def printTransaction(t):
    print("Transaction\t%s\t%s\t%s" % (t.id, t.user, t.creation_time))
    
    printTable("\ttext/asker/comments",
               "Comments", "Comment",
               printComment,
               t.createdComments, t.changedComments, 
               t.deletedComments, t.commentHistories)

    printTable("\torganization\tcustom organization\tsite\tcustom site\toffering\tcustom offering\tstart\tend\ttimeframe",
               "Experiences", "Experience",
               printExperience,
               t.createdExperiences, t.changedExperiences, 
               t.deletedExperiences, t.experienceHistories)

    printTable("\tposition\tname",
               "Experience Custom Services", "Experience Custom Service",
               printExperienceCustomService,
               t.createdExperienceCustomServices, t.changedExperienceCustomServices, 
               t.deletedExperienceCustomServices, t.experienceCustomServiceHistories)

    printTable("\tposition\tservice",
               "Experience Services", "Experience Service",
               printExperienceService,
               t.createdExperienceServices, t.changedExperienceServices, 
               t.deletedExperienceServices, t.experienceServiceHistories)

    printTable("\tuser\tname\tis fresh",
               "Notifications", "Notification",
               printNotification,
               t.createdNotifications, t.changedNotifications, 
               t.deletedNotifications, t.notificationHistories)

    printTable("\tuser\tbirthday\tscreen name\tspecial access\tcan answer",
               "Paths", "Path",
               printPath,
               t.createdPaths, t.changedPaths, 
               t.deletedPaths, t.pathHistories)

    printTable("\tfirst name\tlast name\tbirthday",
               "Users", "User",
               printUser,
               t.createdUsers, t.changedUsers, 
               t.deletedUsers, t.userHistories)

    printTable("\tuser\tgrantee\tprivilege",
               "User Grants", "User Grant",
               printUserGrant,
               t.createdUserGrants, t.changedUserGrants, 
               t.deletedUserGrants, t.userGrantHistories)

    printTable("\tgrantor\tgrantee",
               "User User Grant Requests", "User User Grant Request",
               printUserUserGrantRequest,
               t.createdUserUserGrantRequests, t.changedUserUserGrantRequests, 
               t.deletedUserUserGrantRequests, t.userUserGrantRequestHistories)

if __name__ == "__main__":
    with transaction.atomic():
        t = Transaction.objects.order_by('-creation_time')[0]
        
        printTransaction(t)
        if '-yes' in sys.argv:
            revertChanged(t.changedComments, revertComment)
            revertDeleted(t.deletedComments)
                
            revertChanged(t.changedExperiences, revertExperience)
            deleted = list(t.deletedExperiences.all())
            revertDeleted(t.deletedExperiences)
            for i in deleted:
                i.checkImplications()
                
            revertChanged(t.changedExperienceServices, revertExperienceService)
            deleted = list(t.deletedExperienceServices.all())
            revertDeleted(t.deletedExperienceServices)
            for i in deleted:
                i.createImplications()

            revertChanged(t.changedExperienceCustomServices, revertExperienceCustomService)
            revertDeleted(t.deletedExperienceCustomServices)

            revertChanged(t.changedNotifications, revertNotification)
            revertDeleted(t.deletedNotifications)

            revertDeleted(t.deletedNotificationArguments)

            revertChanged(t.changedUserGrants, revertGrant)
            revertDeleted(t.deletedUserGrants)

            revertChanged(t.changedUserUserGrantRequests, revertUserUserGrantRequest)
            revertDeleted(t.deletedUserUserGrantRequests)

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