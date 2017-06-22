import django; django.setup()
from django.db import transaction
import profile
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

data = [{'clientID': '0', 'name': 'Beacon Academy Volunteer',
        'stage': 'Volunteering',
        'timeframe': 'Previous',
        'organization': 'organization[name>text=Beacon Academy]',
        'site': 'organization[name>text=Beacon Academy]/site',
        'domain': 'service[name>text=Volunteer]',
        'translations': [{'clientID': '1', 
                          'text': 'Have you volunteered at Beacon Academy?',
                          'languageCode': 'en',
                         },
                         {'clientID': '2', 
                          'text': '¿Te has ofrecido como voluntario en Beacon Academy?',
                          'languageCode': 'sp',
                         }],
        'services': [{'clientID': '3',
                      'service': 'service[name>text=Volunteer]',
                     }],
       },
       {'clientID': '4', 'name': 'Grade 7',
        'timeframe': 'Previous',
        'domain': 'service[name>text=Grade 7]',
        'translations': [{'clientID': '5', 
                          'text': 'Where were you in school for Grade 7?',
                          'languageCode': 'en',
                         },
                         {'clientID': '6', 
                          'text': '¿Dónde estaba usted en la escuela para el grado 7?',
                          'languageCode': 'sp',
                         }],
        'services': [{'clientID': '7',
                      'service': 'service[name>text=Grade 7]',
                     }],
        'disqualifying tags': [{'clientID': '8',
                      'service': 'service[name>text=Grade 7]',
                     }],
       }]

with transaction.atomic():
    newIDs = {}
    for d in data:
        context = Context('en', mr)
        newItem = ExperiencePrompt.create(d, context, newIDs=newIDs)
        print(str(newItem), newIDs)
        
with transaction.atomic():
    data = {'name': 'Foo Experience Prompt',
            'stage': '',
			'timeframe': 'Current',
			'organization': 'organization[name>text=theBase]',
			'site': '',
			'domain': 'service[name>text=Job]',
			'translations': [{'id': newIDs['1'], 
							  'text': 'Foo prompt English?',
							  'languageCode': 'en',
							 },
							 {'id': newIDs['2'], 
							  'delete': 'delete',
							 },
							 {'clientID': '3.1',
							  'text': '¿Dónde es el foo?',
                              'languageCode': 'sp',
							 }],
			'services': [{'id': newIDs['3'],
						  'service': 'service[name>text=Job]',
						 }],
           }
    newIDs2 = {}
    context = Context('en', mr)
    i = ExperiencePrompt.objects.filter(pk=newIDs['0'])[0]
    i.update(data, context, newIDs2)
    print(i)

with transaction.atomic():
    context = Context('en', mr)
    newItem = ExperiencePrompt.objects.filter(pk=newIDs['0'])[0]
    newItem.markDeleted(context)

    newItem = ExperiencePrompt.objects.filter(pk=newIDs['4'])[0]
    newItem.markDeleted(context)
