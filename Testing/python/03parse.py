import django; django.setup()
import profile
from consentrecords.models import *
from consentrecords import pathparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
context = Context('en', mr)
escontext = Context('en', User.objects.filter(emails__text='elizabethskavish@gmail.com')[0])
anoncontext = Context('en', None)

def getData(path, context, resultClass, fields=[]):
    print("### %s, context" % path)
    tokens = pathparser._tokenize(path)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
    qs2 = qs2.distinct()
    return [i.getData(fields, context) for i in resultClass.select_related(qs2)]
    
def showData(path, context, resultClass, fields=[]):
    data = getData(path, context, resultClass, fields)
    print(data)
    return data

print("### User")
path = "user"
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('emails__text')
qs2, accessType = User.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
print(qs2)

print("### User by email")
path = 'user[email>text="michaelcrubenstein@gmail.com"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('emails__text')
qs2, accessType = User.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
print(qs2)

print("### User by first name")
path = 'user[first name="Elizabeth"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('emails__text')
qs2, accessType = User.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
print(qs2)

print("### User by last name")
path = 'user[last name="Skavish"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('emails__text')
qs2, accessType = User.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
print(qs2)

print("### User by birthday")
path = 'user[birthday<"1964-01-01"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs2, accessType = User.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [qsType.headData(i, escontext) for i in qs2]
data.sort(key=lambda i:i['description'])
print(data)

print("### User by path>screen name")
path = 'user[path>screen name=tu28]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('emails__text')
qs2, accessType = User.getSubClause(qs, None, accessType)
qs2 = qs2.distinct()
data = User.headData(qs2[0], anoncontext)
print(data)

print("### User by id")
userID = data['id']
path = 'user/' + userID
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('emails__text')
qs2, accessType = User.getSubClause(qs, None, accessType)
qs2 = qs2.distinct()
data = User.headData(qs2[0], anoncontext)
print(data)

print("### User by id to Path, escontext")
print("escontext.is_administrator: %s" % escontext.user.is_administrator)
path = 'user/' + userID + "/path"
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, escontext.user, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = Path.headData(qs2[0], escontext)
print(data)

print("### User by id to Path, anonymous context")
path = 'user/' + userID + "/path"
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, None, accessType)
qs2 = qs2.distinct()
data = Path.headData(qs2[0], anoncontext)
print("accessType: %s" % accessType)
print(data)
pathID = data['id']

print("### Path by id, anonymous context")
path = 'path/' + pathID
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = Path.headData(qs2[0], anoncontext)
print(data)

path = 'path/%s/experience' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
print("accessType: %s" % accessType)
qs2, accessType = Experience.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = [Experience.headData(i, anoncontext) for i in qs2]
print(data)

path = 'path[experience>service>service>name>text=Grade 8]'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = [i.getData(['parents'], anoncontext) for i in qs2]
print(data)

path = 'path[experience[service>service>implies>service>name>text=College]|[offering>service>service>implies>service>name>text=College]]'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = [i.getData(['parents'], anoncontext) for i in qs2]
print(data)
                                                                                                                         
path = 'path[experience[service>service>implies>service>name>text=Job]|[offering>service>service>implies>service>name>text=Job]]'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = [i.getData(['parents'], anoncontext) for i in qs2]
print(data)

path = 'path[experience[service>service>implies>service>name>text=Job]|[offering>service>service>implies>service>name>text=Job]]' +\
       '[experience[service>service>implies>service>name>text=College]|[offering>service>service>implies>service>name>text=College]]' + \
       '[experience[service>service>implies>service>name>text=Business Founder]|[offering>service>service>implies>service>name>text=Business Founder]]'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Path.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = [i.getData(['parents'], anoncontext) for i in qs2]
print(data)
pathID = data[0]['id']

path = 'path/%s/experience' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('start')
qs2, accessType = Path.getSubClause(qs, None, accessType)
qs2 = qs2.distinct()
data = [i.getData([], anoncontext) for i in qs2]
print(list(map(lambda i: i['start'], data)))

path = 'path/%s/experience[custom service]' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('start')
qs2, accessType = Experience.getSubClause(qs, None, accessType)
qs2 = Experience.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(list(map(lambda i: i['custom services'], data)))
experienceID = data[0]['id']
customServiceID = data[0]['custom services'][0]['id']

path = 'path/%s/experience[custom service]/custom service' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
qs2, accessType = ExperienceCustomService.getSubClause(qs, None, accessType)
qs2 = ExperienceCustomService.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

path = 'experience/%s/custom service/%s' % (experienceID, customServiceID)
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
qs2, accessType = ExperienceCustomService.getSubClause(qs, None, accessType)
qs2 = ExperienceCustomService.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

path = 'path/%s/experience[service]' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('start')
qs2, accessType = Experience.getSubClause(qs, None, accessType)
qs2 = Experience.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(list(map(lambda i: i['services'], data)))
experienceID = data[0]['id']
customServiceID = data[0]['services'][0]['id']

path = 'path/%s/experience[service]/service' % pathID
data = showData('path/%s/experience[service]/service' % pathID, anoncontext, ExperienceService)
data = showData('path/%s/experience[service>service>implies>service>name>text=Job]' % pathID, anoncontext, Experience)

path = 'experience/%s/service/%s' % (experienceID, customServiceID)
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('position')
qs2, accessType = ExperienceService.getSubClause(qs, None, accessType)
qs2 = ExperienceService.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

path = 'path/%s/experience[comment]' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = Experience.getSubClause(qs, None, accessType)
qs2 = Experience.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

path = 'path/%s/experience[custom offering=Chem3D Architect]/comment' % pathID
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = Comment.getSubClause(qs, None, accessType)
qs2 = Comment.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

data = showData('access source/%s' % userID, context, AccessSource)
userAccessID = data[0]['user accesses'][0]['id']
groupAccessID = data[0]['group accesses'][0]['id']
data = showData('user access/%s' % userAccessID, context, UserAccess)
data = showData('group access/%s' % groupAccessID, context, UserAccess)

data = showData('access source/%s' % userID, anoncontext, AccessSource)
data = showData('access source/%s' % userID, escontext, AccessSource)

data = getData('service', anoncontext, Service)
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

path = 'service[name>text=Business Founder]/name'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = ServiceName.getSubClause(qs, None, accessType)
qs2 = ServiceName.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

path = 'service[name>text=Grade 8]/organization label'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = ServiceName.getSubClause(qs, None, accessType)
qs2 = ServiceName.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

path = 'service[name>text=Grade 8]/site label'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = ServiceName.getSubClause(qs, None, accessType)
qs2 = ServiceName.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

path = 'service[name>text=Business Founder]/site label'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = ServiceName.getSubClause(qs, None, accessType)
qs2 = ServiceName.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

path = 'service[name>text=Job]/offering label'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = ServiceName.getSubClause(qs, None, accessType)
qs2 = ServiceName.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

path = 'service[name>text=Business Founder]/implies'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs2, accessType = ServiceImplication.getSubClause(qs, None, accessType)
qs2 = ServiceImplication.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
data.sort(key=lambda i: i['description'])
print(list(map(lambda d: d['description'], data)))

print("escontext.is_administrator: %s" % escontext.user.is_administrator)
path = 'user/%s/notification' % userID
print("### %s, escontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('name')
print("accessType: %s" % accessType)
qs2, accessType = Notification.getSubClause(qs, escontext.user, accessType)
print("accessType: %s" % accessType)
qs2 = qs2.distinct()
data = [i.getData([], escontext) for i in Notification.select_related(qs2)]
print(data)

notificationID = data[0]['id']
path = 'notification/%s/argument' % notificationID
print("### %s, escontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs2, accessType = NotificationArgument.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [i.getData([], escontext) for i in NotificationArgument.select_related(qs2)]
print(data)

path = 'user/%s/email' % userID
print("### %s, escontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, escontext.user)
qs2, accessType = UserEmail.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [i.getData([], escontext) for i in UserEmail.select_related(qs2)]
print(data)

path = 'user/%s/user access request' % mr.id.hex
print("### %s, escontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
qs2, accessType = UserUserAccessRequest.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [i.getData([], context) for i in UserUserAccessRequest.select_related(qs2)]
print(data)

showData('organization', escontext, Organization)
showData('organization[name>text=Beacon Academy]/name', context, OrganizationName)
showData('organization[name>text=theBase]/group', context, Group)
showData('organization[name>text=theBase]/group[name>text=theBase Employees]/name', context, GroupName)
showData('organization[name>text=theBase]/group[name>text=theBase Employees]/member', context, GroupMember)
showData('organization[name>text=theBase]/group[name>text=theBase Employees]/member/user', context, User)

data = showData('organization[name>text=BCYF]/site', escontext, Site)
siteID = data[0]['id']
siteName = data[0]['description']

data = showData('site/%s' % siteID, escontext, Site)
data = showData('site[name>text=%s]' % siteName, escontext, Site)
data = showData('site/%s' % siteID, escontext, Site, fields=['offerings'])

data = showData('site[name>text=%s]/name' % siteName, escontext, SiteName)
data = showData('site[name>text=%s]/offering' % siteName, escontext, Offering)
data = showData('organization[name>text=theBase]/site/offering', escontext, Offering)
offeringID = data[0]['id']
offeringName = data[0]['description']

data = showData('offering/%s/name' % offeringID, escontext, OfferingName)
offeringNameID = data[0]['id']
data = showData('offering name/%s' % offeringNameID, escontext, OfferingName)

data = showData('offering[name>text=%s]/service' % offeringName, escontext, OfferingService)
offeringServiceID = data[0]['id']
offeringServiceName = data[0]['service']['description']
data = showData('offering service/%s' % offeringServiceID, escontext, OfferingService)
data = showData('offering service[service>name>text=%s]' % offeringServiceName, escontext, OfferingService)

data = showData('offering/%s/session' % offeringID, escontext, Session)
sessionID = data[0]['id']

data = showData('session/%s/engagement' % sessionID, escontext, Engagement)
data = showData('session/%s/enrollment' % sessionID, escontext, Enrollment)
data = showData('session/%s/inquiry' % sessionID, escontext, Inquiry)

data = showData('engagement[user>email>text="michaelcrubenstein@gmail.com"]', context, Engagement)
data = showData('enrollment[user>email>text="michaelcrubenstein@gmail.com"]', context, Enrollment)
data = showData('inquiry[user>email>text="testuser5@consentrecords.org"]', context, Inquiry)

data = showData('period', context, Period)

data = showData('organization[name>text=theBase]/site/address', escontext, Address)
data = showData('organization[name>text=theBase]/site/address/street', escontext, Street)

data = showData('comment prompt', escontext, CommentPrompt)
commentPromptID = data[0]['id']
data = showData('comment prompt/%s/translation' % commentPromptID, escontext, CommentPromptText)

data = showData('experience prompt', escontext, ExperiencePrompt)
data = showData('experience prompt/organization', escontext, Organization)
data = showData('experience prompt/site', escontext, Site)
data = showData('experience prompt/offering', escontext, Offering)
data = showData('experience prompt[domain]/domain', escontext, Service)
data = showData('experience prompt/disqualifying tag', escontext, DisqualifyingTag)
disqualifyingTagID = data[0]['id']
data = showData('experience prompt/service[service>name>text=Grade 8]', escontext, ExperiencePromptService)

data = showData('disqualifying tag/%s' % disqualifyingTagID, escontext, DisqualifyingTag)
data = showData('disqualifying tag[service>name>text=Grade 8]', escontext, DisqualifyingTag)

