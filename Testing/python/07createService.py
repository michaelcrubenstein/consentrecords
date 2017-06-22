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
        'site labels': [{'clientID': '3', 'text': 'Foo Site Label', 'languageCode': 'en'},
                        {'clientID': '4', 'text': 'Bar Site Label', 'languageCode': 'en'},
                        ],
        'offering labels': [{'clientID': '5', 'text': 'Foo Offering Label', 'languageCode': 'en'},
                        {'clientID': '6', 'text': 'Bar Offering Label', 'languageCode': 'en'},
                        ],
        'services': [{'clientID': '7', 'service': 'service[name>text=Job]'},
                     {'clientID': '8', 'service': 'service[name>text=Foo Service]'},
                    ],
       }

with transaction.atomic():
    newIDs = {}
    context = Context('en', mr)
    newItem = Service.create(data, context, newIDs=newIDs)
    print(str(newItem), newIDs)

with transaction.atomic():
    context = Context('en', mr)
    data = {'stage': 'Volunteering',
            'names': [{'id': newIDs['1'], 'text': 'Bar Service'},
                      {'clientID': '8.2', 'text': 'Biff Service', 'languageCode': 'sp'}],
            'organization labels': [{'id': newIDs['2'], 'delete': 'delete'}, 
                                    {'clientID': '1', 'text': 'Bar Organization Label', 'languageCode': 'en'}],
            'site labels': [{'id': newIDs['3'], 'text': 'Foo 2 Site Label'}, 
                            {'clientID': '3', 'text': 'Biff Site Label', 'languageCode': 'en'}],
            'offering labels': [{'id': newIDs['5'], 'text': 'Foo 2 offering label'}, 
                                {'clientID': '6', 'text': 'Biff Organization Label', 'languageCode': 'sp'}],
            'services': [{'id': newIDs['7'], 'service': 'service[name>text=Volunteer]'},
                         {'clientID': '9', 'service': 'service[name>text=Skills]'}],
           }
    newIDs2 = {}
    context = Context('en', mr)
    i = newItem
    i.update(data, context, newIDs2)
    print(i)
        
with transaction.atomic():
    context = Context('en', mr)
    newItem.markDeleted(context)
