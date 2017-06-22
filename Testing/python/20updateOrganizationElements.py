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
                                              'inquiries': [{'clientID': '8.4', 'user': 'user[email>text=michaelcrubenstein@gmail.com]'}, {'clientID': '8.5', 'user': 'user[email>text=elizabethskavish@gmail.com]'}],
                                              'enrollments': [{'clientID': '8.6', 'user': 'user[email>text=michaelcrubenstein@gmail.com]'}],
                                              'engagements': [{'clientID': '8.7', 'user': 'user[email>text=michaelcrubenstein@gmail.com]'}],
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
    data = {'registration deadline': '2018-01-01',
            'start': '2018-01-02',
            'end': '',
            'can register': 'no',
            'names': [{'id': newIDs['8.2'], 'text': 'Bar Session'},
                      {'clientID': '8.2', 'text': 'Biff Session', 'languageCode': 'sp'}],
            'enrollments': [{'id': newIDs['8.6'], 'delete': 'delete'}, {'clientID': '8.6', 'user': 'user[email>text=testUser28@pathadvisor.com]'}],
            'engagements': [{'id': newIDs['8.7'], 'delete': 'delete'}, {'clientID': '8.7', 'user': 'user[email>text=testUser28@pathadvisor.com]'}],
            'inquiries': [{'id': newIDs['8.4'], 'user': 'user[email>text=testUser28@pathadvisor.com]'}, {'id': newIDs['8.5'], 'delete': 'delete'}],
            'periods': [{'id': newIDs['8.3'], 'weekday': '5', 'start time': '11:00', 'end time': '14:00'}],
           }
    newIDs2 = {}
    context = Context('en', mr)
    i = Session.objects.filter(pk=newIDs['8.1'])[0]
    i.update(data, context, newIDs2)
    print(i)
        
with transaction.atomic():
    context = Context('en', mr)
    data = {'minimum age': '7', 'maximum age': '12', 'minimum grade': '2', 'maximum grade': '6',
            'web site': 'www.foo.com',
            'names': [{'id':newIDs['7'], 'text': 'Foo Name'}],
            'services': [{'id': newIDs['8'], 'service': 'service[name>text=Exercise]'},
                         {'clientID': '2', 'service': 'service[name>text=Soccer]'}],
            }
    newIDs3 = {}
    i = Offering.objects.filter(pk=newIDs['6'])[0]
    i.update(data, context, newIDs3)
    print(i)

with transaction.atomic():
    context = Context('en', mr)
    data = {'names': [{'id':newIDs['10'], 'text': 'Bar Group'}],
            'members': [{'id': newIDs['11'], 'user': 'user[email>text=testUser28@pathadvisor.com]'},
                        {'id': newIDs['12'], 'delete': 'delete'}],
            }
    newIDs4 = {}
    i = Group.objects.filter(pk=newIDs['9'])[0]
    i.update(data, context, newIDs4)
    print(i)

with transaction.atomic():
    context = Context('en', mr)
    newItem.markDeleted(context)
    print('Organization deleted')
