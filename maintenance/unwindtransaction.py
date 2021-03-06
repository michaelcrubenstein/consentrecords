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
    if changed and changed.exclude(lastTransaction=F('transaction')).count():
        print("\nChanged {0: <24}".format(pluralName) + fieldsTitle)
        for i in changed.exclude(lastTransaction=F('transaction')):
            f(i)
    if deleted.count():
        print("\nDeleted {0: <24}".format(pluralName) + fieldsTitle)
        for i in deleted.all():
            f(i)
    if histories and histories.count():
        print("\n{0: <32}".format(singularName + " Histories") + fieldsTitle)
        for i in histories.all():
            f(i)

def printTransaction(t):
    print("Transaction\t%s\t%s\t%s" % (t.id, t.user, t.creation_time))
    
    printTable("\tcity\tstate\tzip code",
               "Addresses", "Address",
               printInstance,
               t.createdAddresses, t.changedAddresses, 
               t.deletedAddresses, t.addressHistories)

    printTable("\ttext/asker/comments",
               "Comments", "Comment",
               printInstance,
               t.createdComments, t.changedComments, 
               t.deletedComments, t.commentHistories)

    printTable("",
               "Comment Prompts", "Comment Prompt",
               printInstance,
               t.createdCommentPrompts, t.changedCommentPrompts, 
               t.deletedCommentPrompts, t.commentPromptHistories)

    printTable("\ttext\tlanguageCode",
               "Comment Prompt Translations", "Comment Prompt Translation",
               printInstance,
               t.createdCommentPromptTexts, t.changedCommentPromptTexts, 
               t.deletedCommentPromptTexts, t.commentPromptTextHistories)

    printTable("\torganization\tcustom organization\tsite\tcustom site\toffering\tcustom offering\tstart\tend\ttimeframe",
               "Experiences", "Experience",
               printInstance,
               t.createdExperiences, t.changedExperiences, 
               t.deletedExperiences, t.experienceHistories)

    printTable("\tposition\tname",
               "Experience Custom Services", "Experience Custom Service",
               printInstance,
               t.createdExperienceCustomServices, t.changedExperienceCustomServices, 
               t.deletedExperienceCustomServices, t.experienceCustomServiceHistories)

    printTable("\tposition\tservice",
               "Experience Services", "Experience Service",
               printInstance,
               t.createdExperienceServices, t.changedExperienceServices, 
               t.deletedExperienceServices, t.experienceServiceHistories)

    printTable("",
               "Groups", "Group",
               printInstance,
               t.createdGroups, None, 
               t.deletedGroups, None)

    printTable("\tuser\tgrantee\tprivilege",
               "Group Grants", "Group Grant",
               printInstance,
               t.createdGroupGrants, t.changedGroupGrants, 
               t.deletedGroupGrants, t.groupAccessHistories)

    printTable("\ttext\tlanguageCode",
               "Group Names", "Group Name",
               printInstance,
               t.createdGroupNames, t.changedGroupNames, 
               t.deletedGroupNames, t.groupNameHistories)

    printTable("\tuser",
               "Group Members", "Group Member",
               printInstance,
               t.createdGroupMembers, t.changedGroupMembers, 
               t.deletedGroupMembers, t.groupMemberHistories)

    printTable("\tuser",
               "Inquiries", "Inquiry",
               printInstance,
               t.createdInquiries, t.changedInquiries, 
               t.deletedInquiries, t.inquiryHistories)

    printTable("\tuser\tname\tis fresh",
               "Notifications", "Notification",
               printInstance,
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

    printTable("\tposition\tservice",
               "Offering Service", "Offering Service",
               printInstance,
               t.createdOfferingServices, t.changedOfferingServices, 
               t.deletedOfferingServices, t.offeringServiceHistories)

    printTable("\tweb site\tinquiry access group\tpublic access\tprimary administrator",
               "Organizations", "Organization",
               printInstance,
               t.createdOrganizations, t.changedOrganizations, 
               t.deletedOrganizations, t.organizationHistories)

    printTable("\ttext\tlanguageCode",
               "Organization Names", "Organization Name",
               printInstance,
               t.createdOrganizationNames, t.changedOrganizationNames, 
               t.deletedOrganizationNames, t.organizationNameHistories)

    printTable("\tuser\tbirthday\tscreen name\tspecial access\tpublic access\tcan answer",
               "Paths", "Path",
               printInstance,
               t.createdPaths, t.changedPaths, 
               t.deletedPaths, t.pathHistories)

    printTable("\tweekday\tstart time\tend time",
               "Periods", "Period",
               printInstance,
               t.createdPeriods, t.changedPeriods, 
               t.deletedPeriods, t.periodHistories)

    printTable("\tstage",
               "Services", "Service",
               printInstance,
               t.createdServices, t.changedServices, 
               t.deletedServices, t.serviceHistories)

    printTable("\ttext\tlanguageCode",
               "Service Names", "Service Name",
               printInstance,
               t.createdServiceNames, t.changedServiceNames, 
               t.deletedServiceNames, t.serviceNameHistories)

    printTable("\ttext\tlanguageCode",
               "Service Organization Labels", "Service Organization Label",
               printInstance,
               t.createdServiceOrganizationLabels, t.changedServiceOrganizationLabels, 
               t.deletedServiceOrganizationLabels, t.serviceOrganizationLabelHistories)

    printTable("\ttext\tlanguageCode",
               "Service Site Labels", "Service Site Label",
               printInstance,
               t.createdServiceSiteLabels, t.changedServiceSiteLabels, 
               t.deletedServiceSiteLabels, t.serviceSiteLabelHistories)

    printTable("\ttext\tlanguageCode",
               "Service Offering Labels", "Service Offering Label",
               printInstance,
               t.createdServiceOfferingLabels, t.changedServiceOfferingLabels, 
               t.deletedServiceOfferingLabels, t.serviceOfferingLabelHistories)

    printTable("\timplied service",
               "Service Implications", "Service Implication",
               printInstance,
               t.createdServiceImplications, t.changedServiceImplications, 
               t.deletedServiceImplications, t.serviceImplicationHistories)

    printTable("\tregistration deadline\tstart\tend\tcan register",
               "Sessions", "Session",
               printInstance,
               t.createdSessions, t.changedSessions, 
               t.deletedSessions, t.sessionHistories)

    printTable("\ttext\tlanguageCode",
               "Session Names", "Session Name",
               printInstance,
               t.createdSessionNames, t.changedSessionNames, 
               t.deletedSessionNames, t.sessionNameHistories)

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

    printTable("\tposition\ttext",
               "Streets", "Street",
               printInstance,
               t.createdStreets, t.changedStreets, 
               t.deletedStreets, t.streetHistories)

    printTable("\tfirst name\tlast name\tbirthday\tpublic access\tprimary administrator\ttip level",
               "Users", "User",
               printInstance,
               t.createdUsers, t.changedUsers, 
               t.deletedUsers, t.userHistories)
    
    authUsers = list(filter(lambda au: not au.is_anonymous and User.getAuthorizedUserQuerySet(au).count() == 1, 
                            map(lambda u: u.authUser, t.createdUsers.all())))
        
    for au in authUsers:
        print('Deleting Authentication User: %s' % str(au))

    printTable("\tposition\ttext",
               "User Emails", "User Email",
               printInstance,
               t.createdUserEmails, t.changedUserEmails, 
               t.deletedUserEmails, t.userEmailHistories)

    printTable("\tuser\tgrantee\tprivilege",
               "User Grants", "User Grant",
               printInstance,
               t.createdUserGrants, t.changedUserGrants, 
               t.deletedUserGrants, t.userGrantHistories)

    printTable("\tgrantor\tgrantee",
               "User User Grant Requests", "User User Grant Request",
               printInstance,
               t.createdUserUserGrantRequests, t.changedUserUserGrantRequests, 
               t.deletedUserUserGrantRequests, t.userUserGrantRequestHistories)

if __name__ == "__main__":
    with transaction.atomic():
        if '-id' in sys.argv:
            id = sys.argv[sys.argv.index('-id') + 1]
            t = Transaction.objects.get(id=id)
            print('id: %s' % id)
        else:
            t = Transaction.objects.order_by('-creation_time')[0]
        
        printTransaction(t)
        if '-yes' in sys.argv:
            revertChanged(t.changedAddresses)
            revertDeleted(t.deletedAddresses)
                
            revertChanged(t.changedComments)
            revertDeleted(t.deletedComments)
                
            revertChanged(t.changedCommentPrompts)
            revertDeleted(t.deletedCommentPrompts)
                
            revertChanged(t.changedCommentPromptTexts)
            revertDeleted(t.deletedCommentPromptTexts)
                
            revertChanged(t.changedEngagements)
            revertDeleted(t.deletedEngagements)
                
            revertChanged(t.changedEnrollments)
            revertDeleted(t.deletedEnrollments)
                
            revertChanged(t.changedExperiences)
            deleted = list(t.deletedExperiences.all())
            revertDeleted(t.deletedExperiences)
            for i in deleted:
                i.checkImplications()
                
            revertChanged(t.changedExperienceCustomServices)
            revertDeleted(t.deletedExperienceCustomServices)

            revertChanged(t.changedExperienceServices)
            deleted = list(t.deletedExperienceServices.all())
            revertDeleted(t.deletedExperienceServices)
            for i in deleted:
                i.createImplications()

            revertDeleted(t.deletedGroups)

            revertChanged(t.changedGroupGrants)
            revertDeleted(t.deletedGroupGrants)

            revertChanged(t.changedGroupMembers)
            revertDeleted(t.deletedGroupMembers)

            revertChanged(t.changedGroupNames)
            revertDeleted(t.deletedGroupNames)

            revertChanged(t.changedInquiries)
            revertDeleted(t.deletedInquiries)

            revertChanged(t.changedNotifications)
            revertDeleted(t.deletedNotifications)

            revertDeleted(t.deletedNotificationArguments)

            revertChanged(t.changedOfferings)
            revertDeleted(t.deletedOfferings)

            revertChanged(t.changedOfferingNames)
            revertDeleted(t.deletedOfferingNames)

            revertChanged(t.changedOfferingServices)
            revertDeleted(t.deletedOfferingServices)

            revertChanged(t.changedOrganizations)
            revertDeleted(t.deletedOrganizations)

            revertChanged(t.changedOrganizationNames)
            revertDeleted(t.deletedOrganizationNames)

            revertChanged(t.changedPaths)
            revertDeleted(t.deletedPaths)

            revertChanged(t.changedPeriods)
            revertDeleted(t.deletedPeriods)

            revertChanged(t.changedServices)
            revertDeleted(t.deletedServices)

            revertChanged(t.changedServiceImplications)
            revertDeleted(t.deletedServiceImplications)

            revertChanged(t.changedServiceNames)
            revertDeleted(t.deletedServiceNames)

            revertChanged(t.changedServiceOfferingLabels)
            revertDeleted(t.deletedServiceOfferingLabels)

            revertChanged(t.changedServiceOrganizationLabels)
            revertDeleted(t.deletedServiceOrganizationLabels)

            revertChanged(t.changedServiceSiteLabels)
            revertDeleted(t.deletedServiceSiteLabels)

            revertChanged(t.changedSessions)
            revertDeleted(t.deletedSessions)

            revertChanged(t.changedSessionNames)
            revertDeleted(t.deletedSessionNames)

            revertChanged(t.changedSites)
            revertDeleted(t.deletedSites)

            revertChanged(t.changedSiteNames)
            revertDeleted(t.deletedSiteNames)

            revertChanged(t.changedStreets)
            revertDeleted(t.deletedStreets)

            revertChanged(t.changedUsers)
            revertDeleted(t.deletedUsers)

            revertChanged(t.changedUserEmails)
            revertDeleted(t.deletedUserEmails)

            revertChanged(t.changedUserGrants)
            revertDeleted(t.deletedUserGrants)

            revertChanged(t.changedUserUserGrantRequests)
            revertDeleted(t.deletedUserUserGrantRequests)

            authUsers = list(filter(lambda au: not au.is_anonymous and User.getAuthorizedUserQuerySet(au).count() == 1, 
                                    map(lambda u: u.authUser, t.createdUsers.all())))
        
            n, d = t.delete()

            sys.stderr.write('\nTransaction deleted: %s\n'%t)
            for key in d.keys():
                if d[key]: print(d[key], key)
    
            for au in authUsers:
                print(au)
                au.delete()
