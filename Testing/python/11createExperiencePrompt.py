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
       {'clientID': '0', 'name': 'Grade 7',
        'timeframe': 'Previous',
        'domain': 'service[name>text=Grade 7]',
        'translations': [{'clientID': '1', 
                          'text': 'Where were you in school for Grade 7?',
                          'languageCode': 'en',
                         },
                         {'clientID': '2', 
                          'text': '¿Dónde estaba usted en la escuela para el grado 7?',
                          'languageCode': 'sp',
                         }],
        'services': [{'clientID': '3',
                      'service': 'service[name>text=Grade 7]',
                     }],
        'disqualifying tags': [{'clientID': '4',
                      'service': 'service[name>text=Grade 7]',
                     }],
       }]
with transaction.atomic():
    for d in data:
        newIDs = {}
        context = Context('en', mr)
        newItem = ExperiencePrompt.create(d, context, newIDs=newIDs)
        print(str(newItem), newIDs)
