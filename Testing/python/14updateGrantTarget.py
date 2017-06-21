import django; django.setup()
from django.db import transaction
import profile
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

def parse(path, context, resultClass):
    print("### %s, context" % path)
    tokens = cssparser.tokenizeHTML(path)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
    qs2 = qs2.distinct()
    return qs2

data = {'public access': 'find',
        'primary administrator': 'user[email>text="elizabethskavish@gmail.com"]',
        'user grants': [{'clientID': '1', 'grantee': 'user[path>screen name=tu28]', 'privilege': 'read'}],
        'group grants': [{'clientID': '2', 
                          'grantee': 'organization[name>text=theBase]/group[name>text=theBase Employees]', 
                          'privilege': 'read'}],
       }
with transaction.atomic():
	newIDs = {}
	context = Context('en', mr)
	newItem = parse('user[email>text="foouser1@pathadvisor.com"]', context, User)[0]
	grantTarget = parse('grant target/%s' % newItem.id.hex, context, GrantTarget)[0]
	grantTarget.update(data, context, newIDs)
	print(str(grantTarget), newIDs)
