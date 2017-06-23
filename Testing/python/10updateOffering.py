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
    i = parse('organization[name>text=theBase]/site/offering', context, Organization)[0]
    name = i.names.all()[0]
    service = i.services.all()[0]
    session = i.sessions.all()[0]
    sessionName = session.names.all()[0]
    oldNameText = name.text
    oldWebSite = i.webSite
    oldMinimumAge = i.minimumAge
    oldMaximumAge = i.maximumAge
    oldMinimumGrade = i.minimumGrade
    oldMaximumGrade = i.maximumGrade
    oldService = service.service
    oldSessionNameText = sessionName.text
    oldRegistrationDeadline = session.registrationDeadline
    oldStart = session.start
    oldEnd = session.end
    oldCanRegister = session.canRegister

    data = {'minimum age': '7', 'maximum age': '12', 'minimum grade': '2', 'maximum grade': '6',
            'web site': 'www.foo.com',
            'names': [{'id':name.id.hex, 'text': 'Foo Name'}],
            'services': [{'id': service.id.hex, 'service': 'service[name>text=Exercise]'},
                         {'clientID': '2', 'service': 'service[name>text=Soccer]'}],
            'sessions': [{'id': session.id.hex, 'registration deadline': '2018-01-01',
                          'start': '2018-01-02',
                          'end': '',
                          'can register': 'no',
                          'names': [{'id': sessionName.id.hex, 'text': 'Foo Session'}],
                         }],
            }

    i.update(data, context, newIDs)
        
data = {'minimum age': oldMinimumAge, 'maximum age': oldMaximumAge, 'minimum grade': oldMinimumGrade, 'maximum grade': oldMaximumGrade,
        'web site': oldWebSite,
        'names': [{'id':name.id.hex, 'text': oldNameText}],
        'services': [{'id': service.id.hex, 'service': 'service/%s' % oldService.id.hex},
                     {'id': newIDs['2'], 'delete': 'delete'}],
        'sessions': [{'id': session.id.hex, 'registration deadline': oldRegistrationDeadline,
                      'start': oldStart,
                      'end': oldEnd,
                      'can register': oldCanRegister,
                      'names': [{'id': sessionName.id.hex, 'text': oldSessionNameText}],
                     }],
        }

with transaction.atomic():
    newIDs = {}
    context = Context('en', mr)
    i.update(data, context, newIDs)
        
