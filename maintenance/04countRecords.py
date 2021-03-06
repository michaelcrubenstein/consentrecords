import django; django.setup()
from consentrecords.models import *

print("Addresses	%s" % Address.objects.count())
print("Address Histories	%s" % AddressHistory.objects.count())
print("Comments	%s" % Comment.objects.count())
print("Comment Histories	%s" % CommentHistory.objects.count())
print("Comment Prompts	%s" % CommentPrompt.objects.count())
print("Comment Prompt Histories	%s" % CommentPromptHistory.objects.count())
print("Comment Prompt Texts	%s" % CommentPromptText.objects.count())
print("Comment Prompt Text Histories	%s" % CommentPromptTextHistory.objects.count())
print("Disqualifying Tags	%s" % DisqualifyingTag.objects.count())
print("Disqualifying Tag Histories	%s" % DisqualifyingTagHistory.objects.count())
print("Engagements	%s" % Engagement.objects.count())
print("Engagement Histories	%s" % EngagementHistory.objects.count())
print("Enrollments	%s" % Enrollment.objects.count())
print("Enrollment Histories	%s" % EnrollmentHistory.objects.count())
print("Experiences	%s" % Experience.objects.count())
print("Experience Custom Services	%s" % ExperienceCustomService.objects.count())
print("Experience Custom Service Histories	%s" % ExperienceCustomServiceHistory.objects.count())
print("Experience Histories	%s" % ExperienceHistory.objects.count())
print("Experience Prompts	%s" % ExperiencePrompt.objects.count())
print("Experience Prompt Histories	%s" % ExperiencePromptHistory.objects.count())
print("Experience Prompt Services	%s" % ExperiencePromptService.objects.count())
print("Experience Prompt Service Histories	%s" % ExperiencePromptServiceHistory.objects.count())
print("Experience Prompt Texts	%s" % ExperiencePromptText.objects.count())
print("Experience Prompt Text Histories	%s" % ExperiencePromptTextHistory.objects.count())
print("Experience Services	%s" % ExperienceService.objects.count())
print("Experience Service Histories	%s" % ExperienceServiceHistory.objects.count())
print("Grant Targets	%s" % GrantTarget.objects.count())
print("Grant Target Histories	%s" % GrantTargetHistory.objects.count())
print("Groups	%s" % Group.objects.count())
print("Group Grants	%s" % GroupGrant.objects.count())
print("Group Grant Histories	%s" % GroupGrantHistory.objects.count())
print("Group Members	%s" % GroupMember.objects.count())
print("Group Member Histories	%s" % GroupMemberHistory.objects.count())
print("Group Names	%s" % GroupName.objects.count())
print("Group Name Histories	%s" % GroupNameHistory.objects.count())
print("Inquiries	%s" % Inquiry.objects.count())
print("Inquiry Histories	%s" % InquiryHistory.objects.count())
print("Notifications	%s" % Notification.objects.count())
print("Notification Arguments	%s" % NotificationArgument.objects.count())
print("Notification Argument Histories	%s" % NotificationArgumentHistory.objects.count())
print("Notification Histories	%s" % NotificationHistory.objects.count())
print("Offerings	%s" % Offering.objects.count())
print("OfferingHistories	%s" % OfferingHistory.objects.count())
print("OfferingNames	%s" % OfferingName.objects.count())
print("OfferingNameHistories	%s" % OfferingNameHistory.objects.count())
print("OfferingServices	%s" % OfferingService.objects.count())
print("OfferingServiceHistories	%s" % OfferingServiceHistory.objects.count())
print("Organizations	%s" % Organization.objects.count())
print("OrganizationHistories	%s" % OrganizationHistory.objects.count())
print("OrganizationNames	%s" % OrganizationName.objects.count())
print("OrganizationNameHistories	%s" % OrganizationNameHistory.objects.count())
print("Paths	%s" % Path.objects.count())
print("PathHistories	%s" % PathHistory.objects.count())
print("Periods	%s" % Period.objects.count())
print("Period Histories	%s" % PeriodHistory.objects.count())
print("Services	%s" % Service.objects.count())
print("Service Histories	%s" % ServiceHistory.objects.count())
print("Service Implications	%s" % ServiceImplication.objects.count())
print("Service Implication Histories	%s" % ServiceImplicationHistory.objects.count())
print("Service Names	%s" % ServiceName.objects.count())
print("Service Name Histories	%s" % ServiceNameHistory.objects.count())
print("Service Offering Labels	%s" % ServiceOfferingLabel.objects.count())
print("Service Offering Label Histories	%s" % ServiceOfferingLabelHistory.objects.count())
print("Service Organization Labels	%s" % ServiceOrganizationLabel.objects.count())
print("Service Organization Label Histories	%s" % ServiceOrganizationLabelHistory.objects.count())
print("Service Site Labels	%s" % ServiceSiteLabel.objects.count())
print("Service Site Label Histories	%s" % ServiceSiteLabelHistory.objects.count())
print("Sessions	%s" % Session.objects.count())
print("Session Histories	%s" % SessionHistory.objects.count())
print("SessionNames	%s" % SessionName.objects.count())
print("Session Name Histories	%s" % SessionNameHistory.objects.count())
print("Sites	%s" % Site.objects.count())
print("Site Histories	%s" % SiteHistory.objects.count())
print("SiteNames	%s" % SiteName.objects.count())
print("Site Name Histories	%s" % SiteNameHistory.objects.count())
print("Streets	%s" % Street.objects.count())
print("Street Histories	%s" % StreetHistory.objects.count())
print("Transactions	%s" % Transaction.objects.count())
print("Users	%s" % User.objects.count())
print("User Emails	%s" % UserEmail.objects.count())
print("User Email Histories	%s" % UserEmailHistory.objects.count())
print("User Grants	%s" % UserGrant.objects.count())
print("User Grant Histories	%s" % UserGrantHistory.objects.count())
print("User Histories	%s" % UserHistory.objects.count())
print("UserUserGrantRequests	%s" % UserUserGrantRequest.objects.count())
print("UserUserGrantRequest Histories	%s" % UserUserGrantRequestHistory.objects.count())
