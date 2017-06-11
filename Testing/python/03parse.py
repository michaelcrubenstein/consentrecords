import django; django.setup()
from consentrecords.models import *
from consentrecords import pathparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
context = Context('en', mr)
escontext = Context('en', User.objects.filter(emails__text='elizabethskavish@gmail.com')[0])
anoncontext = Context('en', None)

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
data = [Path.getData(i, ['parents'], anoncontext) for i in qs2]
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
data = [Path.getData(i, ['parents'], anoncontext) for i in qs2]
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
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('position')
qs2, accessType = ExperienceService.getSubClause(qs, None, accessType)
qs2 = ExperienceService.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

path = 'experience/%s/service/%s' % (experienceID, customServiceID)
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
qs = qs.order_by('position')
qs2, accessType = ExperienceService.getSubClause(qs, None, accessType)
qs2 = ExperienceService.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
print(data)

path = 'service'
print("### %s, anoncontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, None)
print("accessType: %s" % accessType)
qs2, accessType = Service.getSubClause(qs, None, accessType)
print("accessType: %s" % accessType)
qs2 = Service.select_related(qs2.distinct())
data = [i.getData([], anoncontext) for i in qs2]
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
print("### %s, mrcontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
qs2, accessType = UserUserAccessRequest.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [i.getData([], context) for i in UserUserAccessRequest.select_related(qs2)]
print(data)

path = 'organization'
print("### %s, mrcontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
qs2, accessType = Organization.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [i.getData([], context) for i in Organization.select_related(qs2)]
print(data)

path = 'organization[name>text=Beacon Academy]/name'
print("### %s, mrcontext" % path)
tokens = pathparser._tokenize(path)
qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
qs2, accessType = OrganizationName.getSubClause(qs, escontext.user, accessType)
qs2 = qs2.distinct()
data = [i.getData([], context) for i in OrganizationName.select_related(qs2)]
print(data)

