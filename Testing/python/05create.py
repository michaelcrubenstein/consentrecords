import django; django.setup()
from django.db import transaction
import profile
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

data = {'clientID': '0',
        'web site': 'http://www.fooorganization.com',
        'names': [{'clientID': '1', 'text': 'Foo Organization', 'languageCode': 'en'}],
        'sites': [{'clientID': '2',
                   'web site': 'http://www.foosite.com',
                  'names': [{'clientID': '3', 'text': 'Foo Site', 'languageCode': 'en'}],
                  'address': {'clientID': '4', 
                              'city': 'Foo City',
                              'state': 'MA',
                              'zip code': '02222',
                              'streets': [{'clientID': '5', 'position': '0', 'text': '123 Foo Street'}]
                             },
                  'offerings': [{'clientID': '6',
                                'web site': 'http://www.foooffering.com',
                                'minimum age': '10',
                                'maximum age': '13',
                                'minimum grade': '5',
                                'maximum grade': '7',
                                'names': [{'clientID': '7', 'text': 'Foo Offering', 'languageCode': 'en'}],
                                'services': [{'clientID': '8', 'position': '0', 'service': 'service[name>text=Job]'}],
                                'sessions': [{'clientID': '8.1', 
                                              'registration deadline': '2017-11-11',
                                              'start': '2017-11-12',
                                              'end': '2017-11-25',
                                              'canRegister': 'yes',
                                              'names': [{'clientID': '8.2', 'text': 'Foo Session', 'languageCode': 'en'}],
                                              'inquiries': [],
                                              'enrollments': [],
                                              'engagements': [],
                                              'periods': [{'clientID': '8.3', 'weekday': '6', 'start time': '12:00', 'end time': '14:00'}]
                                             }],
                           }],
                 }],
        'groups': [{'clientID': '9',
                    'names': [{'clientID': '10', 'text': 'Foo Group', 'languageCode': 'en'}],
                    'members': [{'clientID': '11', 'user': 'user[email>text="michaelcrubenstein@gmail.com"]'},
                                {'clientID': '12', 'user': 'user[email>text="elizabethskavish@gmail.com"]'},
                               ],
                   }],
         'inquiry access group': 'this/group[name>text=Foo Group]',
       }
newIDs = {}
with transaction.atomic():
    context = Context('en', mr)
    newItem = Organization.create(data, context, newIDs=newIDs)
    print(str(newItem), newIDs)
with transaction.atomic():
    context = Context('en', mr)
    newItem.markDeleted(context)
