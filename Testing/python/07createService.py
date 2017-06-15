import django; django.setup()
from django.db import transaction
import profile
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

data = {'clientID': '0',
        'stage': 'Working',
        'names': [{'clientID': '1', 'text': 'Foo Service', 'languageCode': 'en'}],
        'organization labels': [{'clientID': '2', 'text': 'Foo Organization Label', 'languageCode': 'en'}],
        'site labels': [{'clientID': '2', 'text': 'Foo Site Label', 'languageCode': 'en'},
                        {'clientID': '3', 'text': 'Bar Site Label', 'languageCode': 'en'},
                        ],
        'offering labels': [{'clientID': '4', 'text': 'Foo Offering Label', 'languageCode': 'en'},
                        {'clientID': '5', 'text': 'Bar Offering Label', 'languageCode': 'en'},
                        ],
        'services': [{'clientID': '6', 'service': 'service[name>text=Job]'},
                     {'clientID': '7', 'service': 'service[name>text=Foo Service]'},
                    ],
       }
newIDs = {}
with transaction.atomic():
    context = Context('en', mr)
    newItem = Service.create(data, context, newIDs=newIDs)
    print(str(newItem), newIDs)
