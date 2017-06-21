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
    i = parse('organization[name>text=theBase]/site', context, Organization)[0]
    name = i.names.all()[0]
    address = i.addresses.all()[0]
    street = address.streets.all()[0]
    oldNameText = name.text
    oldCity = address.city
    oldState = address.state
    oldZipCode = address.zipCode
    oldStreetText = street.text

    data = {'names': [{'id':name.id.hex, 'text': 'Foo Name'}],
            'addresses': [{'id': address.id.hex, 'city': 'Foo City', 'state': 'FL', 'zip code': '44444',
                           'streets': [{'id': street.id.hex, 'text': '543 Oak Street'},
                                       {'clientID': '2', 'text': 'Suite 666'}]
                          }
                         ],
            }

    i.update(data, context, newIDs)
        
data = {'names': [{'id':name.id.hex, 'text': oldNameText}],
        'addresses': [{'id': address.id.hex, 'city': oldCity, 'state': oldState, 'zip code': oldZipCode,
                           'streets': [{'id': street.id.hex, 'text': oldStreetText},
                                       {'id': newIDs['2'], 'delete': 'delete'}]
                          }
                         ],
        }

with transaction.atomic():
    newIDs = {}
    context = Context('en', mr)
    i.update(data, context, newIDs)
        
