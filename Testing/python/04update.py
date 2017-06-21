import django; django.setup()
from django.db import transaction
import profile
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]
context = Context('en', mr)
escontext = Context('en', es)
anoncontext = Context('en', None)

def getInstance(path, context, resultClass):
    print("### %s, context" % path)
    tokens = cssparser.tokenizeHTML(path)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
    qs2 = qs2.distinct()
    return qs2[0]

i = getInstance('service[name>text=Employment]', context, Service)
serviceName = getInstance('service/%s/name' % i.id.hex, context, ServiceName)

context = Context('en', mr)
changes = {'stage': 'Working', 
           'names': [{'id': serviceName.id.hex, 'text': 'Employment'}, {'clientID': '1', 'text': 'Empleo', 'languageCode': 'sp'}] }
with transaction.atomic():
    newIDs = i.update(changes, context)
    print(context.transaction.id, context.transaction.creation_time, newIDs)

context = Context('en', mr)
changes = {'stage': '', 
           'names': [{'id': serviceName.id.hex, 'text': 'Job'}, {'id': newIDs['1'], 'delete': 'delete'}] }
with transaction.atomic():
    newIDs = i.update(changes, context)
    print(context.transaction.id, context.transaction.creation_time, newIDs)


