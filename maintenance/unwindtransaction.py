# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
from django.db.models import F, Q, Prefetch

django.setup()

from consentrecords.models import *

nullString = "-"

def printAddress(i):
    print("%s\t%s\t%s\t%s" % \
        (i.id, 
         i.city or nullString,
         i.state or nullString,
         i.zipCode or nullString,
         ))
         
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
         (i.position if (i.position != None) else nullString),
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
         (i.position if (i.position != None) else nullString),
         str(i.service) if i.service else nullString,
         ))
         
def printNotification(i):
    print("%s\t%s\t%s\t%s" % \
        (i.id, 
         str(i.parent),
         i.name or nullString,
         i.isFresh or nullString,
         ))
    for na in i.notificationArguments.filter(deleteTransaction__isnull=True).order_by('position'):
        print("\t%s\t%s\t%s" % \
              (na.id, na.position, na.argument))
         
def printOrganization(i):
    print("%s\t%s\t%s\t%s\t%s" % \
        (i.id, i.webSite or nullString, 
         str(i.inquiryAccessGroup) if i.inquiryAccessGroup else nullString,
         i.publicAccess or nullString,
         str(i.primaryAdministrator) if i.primaryAdministrator else nullString,
        ))

def printPath(i):
    print("%s\t%s\t%s\t%s\t%s\t%s" % \
        (i.id, i.parent, i.birthday or nullString, i.name or nullString, 
         i.specialAccess or nullString, 
         i.canAnswerExperience or nullString,
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
          
def printInstance(i):
	print(i.dataString)
         
def revertChanged(changed):
    for i in changed.exclude(transaction=t):
        h = i.history.order_by('-transaction__creation_time')[0]
        i.revert(h)
        i.lastTransaction = h.transaction
        h.delete()
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
        print("\n{0: <32}".format(singularName + " Histories") + fieldsTitle)
        for i in histories.all():
            f(i)

def printTransaction(t):
    print("Transaction\t%s\t%s\t%s" % (t.id, t.user, t.creation_time))
    
    printTable("\tcity\tstate\tzip code",
               "Addresses", "Address",
               printAddress,
               t.createdAddresses, t.changedAddresses, 
               t.deletedAddresses, t.addressHistories)

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

    printTable("\tweb site\tminimum age\tmaximum age\tminimum grade\tmaximum grade",
               "Offerings", "Offering",
               printInstance,
               t.createdOfferings, t.changedOfferings, 
               t.deletedOfferings, t.offeringHistories)

    printTable("\ttext\tlanguageCode",
               "Offering Names", "Offering Name",
               printInstance,
               t.createdOfferingNames, t.changedOfferingNames, 
               t.deletedOfferingNames, t.offeringNameHistories)

    printTable("\ttext\tlanguageCode",
               "Offering Names", "Offering Name",
               printInstance,
               t.createdOfferingNames, t.changedOfferingNames, 
               t.deletedOfferingNames, t.offeringNameHistories)

    printTable("\tweb site\tinquiry access group\tpublic access\tprimary administrator",
               "Organizations", "Organization",
               printOrganization,
               t.createdOrganizations, t.changedOrganizations, 
               t.deletedOrganizations, t.organizationHistories)

    printTable("\ttext\tlanguageCode",
               "Organization Names", "Organization Name",
               printInstance,
               t.createdOrganizationNames, t.changedOrganizationNames, 
               t.deletedOrganizationNames, t.organizationNameHistories)

    printTable("\tuser\tbirthday\tscreen name\tspecial access\tcan answer",
               "Paths", "Path",
               printPath,
               t.createdPaths, t.changedPaths, 
               t.deletedPaths, t.pathHistories)

    printTable("\tweb site",
               "Sites", "Site",
               printInstance,
               t.createdSites, t.changedSites, 
               t.deletedSites, t.siteHistories)

    printTable("\ttext\tlanguageCode",
               "Site Names", "Site Name",
               printInstance,
               t.createdSiteNames, t.changedSiteNames, 
               t.deletedSiteNames, t.siteNameHistories)

    printTable("\tfirst name\tlast name\tbirthday",
               "Users", "User",
               printUser,
               t.createdUsers, t.changedUsers, 
               t.deletedUsers, t.userHistories)

    printTable("\tposition\ttext",
               "User Emails", "User Email",
               printInstance,
               t.createdUserEmails, t.changedUserEmails, 
               t.deletedUserEmails, t.userEmailHistories)

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
            revertChanged(t.changedComments)
            revertDeleted(t.deletedComments)
                
            revertChanged(t.changedExperiences)
            deleted = list(t.deletedExperiences.all())
            revertDeleted(t.deletedExperiences)
            for i in deleted:
                i.checkImplications()
                
            revertChanged(t.changedExperienceServices)
            deleted = list(t.deletedExperienceServices.all())
            revertDeleted(t.deletedExperienceServices)
            for i in deleted:
                i.createImplications()

            revertChanged(t.changedExperienceCustomServices)
            revertDeleted(t.deletedExperienceCustomServices)

            revertChanged(t.changedNotifications)
            revertDeleted(t.deletedNotifications)

            revertDeleted(t.deletedNotificationArguments)

            revertChanged(t.changedOfferings)
            revertDeleted(t.deletedOfferings)

            revertChanged(t.changedOfferingNames)
            revertDeleted(t.deletedOfferings)

            revertChanged(t.changedOrganizations)
            revertDeleted(t.deletedOrganizations)

            revertChanged(t.changedOrganizationNames)
            revertDeleted(t.deletedOrganizationNames)

            revertChanged(t.changedPaths)
            revertDeleted(t.deletedPaths)

            revertChanged(t.changedServices)
            revertDeleted(t.deletedServices)

            revertChanged(t.changedServiceNames)
            revertDeleted(t.deletedServices)

            revertChanged(t.changedSites)
            revertDeleted(t.deletedSites)

            revertChanged(t.changedSiteNames)
            revertDeleted(t.deletedSiteNames)

            revertChanged(t.changedUsers)
            revertDeleted(t.deletedUsers)

            revertChanged(t.changedUserEmails)
            revertDeleted(t.deletedUserEmails)

            revertChanged(t.changedUserGrants)
            revertDeleted(t.deletedUserGrants)

            revertChanged(t.changedUserUserGrantRequests)
            revertDeleted(t.deletedUserUserGrantRequests)

            n, d = t.delete()

            sys.stderr.write('\nTransaction deleted: %s\n'%t)
            for key in d.keys():
                if d[key]: print(d[key], key)
    
