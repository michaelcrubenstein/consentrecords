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

with transaction.atomic():
    newIDs = {}
    context = Context('en', mr)
    org = parse('organization[name>text=Beacon Academy]', context, Organization)[0]
    name = org.names.all()[0]

    data = {'web site': 'www.beaconacademy.com', 
            'names': [{'id':name.id.hex, 'text': 'Beacon'}]
            }

    org.update(data, context, newIDs)
        
data = {'web site': 'www.beaconacademy.org', 
        'names': [{'id':name.id.hex, 'text': 'Beacon Academy'}]
        }

with transaction.atomic():
    newIDs = {}
    context = Context('en', mr)
    org.update(data, context, newIDs)
        
