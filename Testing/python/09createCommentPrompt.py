import django; django.setup()
from django.db import transaction
import profile
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

data = {'clientID': '0',
        'translations': [{'clientID': '1', 
                          'text': 'What would be helpful to experience before this experience?',
                          'languageCode': 'en',
                         },
                         {'clientID': '2', 
                          'text': '¿Qué sería útil experimentar antes de esta experiencia?',
                          'languageCode': 'sp',
                         }],
       }
newIDs = {}
with transaction.atomic():
    context = Context('en', mr)
    newItem = CommentPrompt.create(data, context, newIDs=newIDs)
    print(str(newItem), newIDs)
