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
qs, tokens, qsType = RootInstance.parse(tokens, None)
qs = qs.order_by('emails__text')
qs2 = User.findableQuerySet(qs, None)
print(qs2)

print("### User by email")
path = 'user[email="michaelcrubenstein@gmail.com"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('emails__text')
qs2 = User.findableQuerySet(qs, escontext.user).distinct()
print(qs2)

print("### User by first name")
path = 'user[first name="Elizabeth"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('emails__text')
qs2 = User.findableQuerySet(qs, escontext.user)
print(qs2)

print("### User by last name")
path = 'user[last name="Skavish"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('emails__text')
qs2 = User.findableQuerySet(qs, escontext.user)
print(qs2)

print("### User by birthday")
path = 'user[birthday<"1964-01-01"]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, escontext.user)
data = [qsType.headData(i, escontext) for i in qs]
qs2 = qsType.findableQuerySet(qs, escontext.user).distinct()
data = [qsType.headData(i, escontext) for i in qs2]
data.sort(key=lambda i:i['description'])
print(data)

print("### User by path>screen name")
path = 'user[path>screen name=tu28]'
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, None)
qs = qs.order_by('emails__text')
qs2 = User.findableQuerySet(qs, None).distinct()
data = User.headData(qs2[0], anoncontext)
print(data)

print("### User by id")
id = data['id']
path = 'user/' + id
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, None)
qs = qs.order_by('emails__text')
qs2 = User.findableQuerySet(qs, None).distinct()
data = User.headData(qs2[0], anoncontext)
print(data)

print("### User by id to Path, escontext")
print("escontext.is_administrator: %s" % escontext.user.is_administrator)
path = 'user/' + id + "/path"
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, escontext.user)
qs = qs.order_by('name')
qs2 = Path.findableQuerySet(qs, escontext.user).distinct()
data = Path.headData(qs2[0], escontext)
print(data)

print("### User by id to Path, anonymous context")
path = 'user/' + id + "/path"
tokens = pathparser._tokenize(path)
qs, tokens, qsType = RootInstance.parse(tokens, None)
qs = qs.order_by('name')
qs2 = Path.findableQuerySet(qs, None).distinct()
data = Path.headData(qs2[0], anoncontext)
print(data)
