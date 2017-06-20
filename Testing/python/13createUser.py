import django; django.setup()
from django.db import transaction
import profile
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

data = [{'clientID': '0', 'first name': 'Foo',
        'last name': 'User1',
        'birthday': '2000-01-01',
        'emails': [{'clientID': '1', 
                    'text': 'foouser1@pathadvisor.com',
                   },
                   ],
        'path': {'clientID': '3',
                   'birthday': '2000-01',
                   'name': 'fooUser1',
                   'can answer experience': 'yes',
            'experiences': [{ 'clientID': '4',
                              'organization': 'organization[name>text=Boston Public Schools]',
                              'site': 'organization[name>text=Boston Public Schools]/site[name>text="Jackson/Mann K-8"]',
                              'offering': 'organization[name>text=Boston Public Schools]/site[name>text="Jackson/Mann K-8"]/offering[name>text=Grade 8]',
                              'start': '2013-09',
                              'end': '2014-05',
                              'timeframe': 'Previous',
                              'services': [{'clientID': '5', 
                                            'service': 'service[name>text=Grade 8'}],
                              'comments': [{'clientID': '6',
                                            'text': 'I had a great teacher, especially for science.'}],
                            },
                            { 'clientID': '7',
                              'custom organization': 'Cambridge City Hall',
                              'custom site': 'Cambridge, MA',
                              'custom offering': 'Mayor',
                              'custom services': [{'clientID': '8',
                                                   'name': 'Political Leader'}],
                              'services': [{'clientID': '9', 
                                            'service': 'service[name>text=Job'}],
                            },
                           ],
                     },
        'user grant requests': [{'clientID': '10',
                   'grantee': 'user[email>text="michaelcrubenstein@gmail.com"]'
                   },
                   {'clientID': '11',
                    'grantee': 'user[email>text="elizabethskavish@gmail.com"]'
                   }],
       },
       ]
with transaction.atomic():
    for d in data:
        newIDs = {}
        context = Context('en', mr)
        newItem = User.create(d, context, newIDs=newIDs)
        print(str(newItem), newIDs)


def parse(path, context, resultClass):
    print("### %s, context" % path)
    tokens = cssparser.tokenizeHTML(path)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
    qs2 = qs2.distinct()
    return qs2

data = [{'name': 'crn.FollowerAccept',
         'arguments': ['user[email>text="elizabethskavish@gmail.com"]']
        },
        {'name': 'crn.ExperienceCommentRequested',
         'arguments': ['user[email>text="elizabethskavish@gmail.com"]/path',
                       'experience/%s' % newIDs['4'],
                       'comment/%s' % newIDs['6'],
                      ]
        },
        {'name': 'crn.ExperienceQuestionAnswered',
         'arguments': ['path/%s' % newIDs['3'],
                       'experience/%s' % newIDs['4'],
                      ]
        },
        {'name': 'crn.ExperienceSuggestion',
         'arguments': ['user[email>text="elizabethskavish@gmail.com"]/path',
                       'service[name>text=Job]',
                      ]
        },
       ]
with transaction.atomic():
    for d in data:
        newIDs = {}
        context = Context('en', mr)
        user = parse('user[email>text="foouser1@pathadvisor.com"]', context, User)[0]
        newItem = Notification.create(user, d, context, newIDs=newIDs)
        print(str(newItem), newIDs)
