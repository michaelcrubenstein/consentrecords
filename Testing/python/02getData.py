import django; django.setup()
from consentrecords.models import *
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
context = Context('en', mr)
escontext = Context('en', User.objects.filter(emails__text='elizabethskavish@gmail.com')[0])
anoncontext = Context('en', None)

print("### Path")
mrp = mr.paths.all()[0]
print(mrp.getData([], context))
print(mrp.getData(['parents'], context))
print(mrp.getData(['parents', 'user'], context))
print(mrp.getData(['user access', 'group access'], context))
print(mrp.getData(['experience'], context))

print("### User")
print(mr.getData([], context))
print(mr.getData(['system access'], context))
print(mr.getData(['system access'], escontext))
print(mr.getData(['user access', 'group access', 'user access request'], context))
print(mr.getData(['user access', 'group access'], escontext))
print(mr.getData(['path'], context))
print(mr.getData(['notification'], context))

print ("### Notifications")
notifications = Notification.select_related(mr.notifications.filter(deleteTransaction__isnull=True))
print([i.getData([], context) for i in notifications])

print ("### Experience")
print([i.getData([], context) for i in mrp.experiences.filter(deleteTransaction__isnull=True)])
print([i.getData(['offering'], context) for i in mrp.experiences.filter(deleteTransaction__isnull=True)])
print([i.getData(['offering', 'service'], context) for i in mrp.experiences.filter(deleteTransaction__isnull=True)])
print([i.getData(['offering', 'service'], anoncontext) for i in mrp.experiences.filter(deleteTransaction__isnull=True)])
print([i.getData(['organization', 'site', 'offering', 'service'], anoncontext) for i in mrp.experiences.filter(deleteTransaction__isnull=True)])

print ("### Comments")
comments = Comment.select_related(Experience.objects.filter(offering__services__service__names__text='Math Tutoring', 
                                     parent=mrp, 
                                     deleteTransaction__isnull=True)[0]\
                     .comments.filter(deleteTransaction__isnull=True)\
                     .order_by('transaction__creation_time'))
print ([i.getData([], escontext) for i in comments])

org = Organization.objects.filter(names__text='Beacon Academy', deleteTransaction__isnull=True)[0]
print ("### Organization")
print(org.getData([], context))

print ("### Group")
groups = Group.select_related(org.groups.filter(deleteTransaction__isnull=True))
print([i.getData([], escontext) for i in groups])

print ("### Organizations")
orgs = Organization.select_head_related(Organization.objects.filter(deleteTransaction__isnull=True))
orgsData = [i.headData(escontext) for i in orgs]
orgsData.sort(key=lambda i: i['description'])
print(orgsData)

print ("### Site")
print([i.getData([], anoncontext) for i in org.sites.filter(deleteTransaction__isnull=True)])
print ("### Site with address")
print([i.getData(['address'], anoncontext) for i in org.sites.filter(deleteTransaction__isnull=True)])

site = org.sites.get(deleteTransaction__isnull=True)
print ("### Offering Heads")
print([i.headData(anoncontext) for i in site.offerings.filter(deleteTransaction__isnull=True)])
print ("### Offering")
print([i.getData([], anoncontext) for i in site.offerings.filter(deleteTransaction__isnull=True)])

offering = site.offerings.get(names__text='Jump Year', deleteTransaction__isnull=True)
print ("### Offering with Services")
print(offering.getData(['service'], anoncontext))
print ("### Offering with Sessions")
print(offering.getData(['session'], anoncontext))

print ("### Offering with session of data")
offerings = Offering.select_related(Offering.objects.filter(deleteTransaction__isnull=True, names__text='Winter Conditioning and Training'))
offering = offerings[0]
data = offering.getData(['session'], anoncontext)
print(data)

sessionHead = data['sessions'][-1]
session = Session.select_related(Session.objects.filter(pk=sessionHead['id']))[0]
print(session.getData([], escontext))

print ("### Engagements")
engagements = Engagement.select_related(session.engagements.filter(deleteTransaction__isnull=True))
print([i.getData([], escontext) for i in engagements])

print ("### Enrollments")
enrollments = Enrollment.select_related(session.enrollments.filter(deleteTransaction__isnull=True))
print([i.getData([], escontext) for i in enrollments])

print ("### Inquiries")
inquiries = Inquiry.select_related(session.inquiries.filter(deleteTransaction__isnull=True))
print([i.getData([], escontext) for i in inquiries])

services = Service.select_related(Service.objects.filter(deleteTransaction__isnull=True))
print ("### Services")
servicesData = [i.getData([], anoncontext) for i in services]
servicesData.sort(key=lambda i: i['description'])
print(servicesData)

print ("### Job Service")
service = Service.select_related(Service.objects.filter(names__text='Job', deleteTransaction__isnull=True))[0]
print (service.getData([], anoncontext))

print ("### Grade 10 Service")
service = Service.select_related(Service.objects.filter(names__text='Grade 10', deleteTransaction__isnull=True))[0]
print (service.getData([], anoncontext))

print ("### Comment Prompts")
commentPrompts = CommentPrompt.select_related(CommentPrompt.objects.filter(deleteTransaction__isnull=True))
print ([i.getData([], escontext) for i in commentPrompts])

print ("### Experience Prompts")
experiencePrompts = ExperiencePrompt.select_related(ExperiencePrompt.objects.filter(deleteTransaction__isnull=True))
print ([i.getData([], escontext) for i in experiencePrompts])

