import django; django.setup()
from django.db import transaction
import traceback
import logging
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

try:
	with transaction.atomic():
		context = Context('en', mr)
		data = {'translations': [{'id': newIDs['1'], 'text': 'Bar Comment Prompt'},
						         {'id': newIDs['2'], 'text': 'Biff Comment Prompt', 'languageCode': 'zh'}],
			   }
		newIDs2 = {}
		context = Context('en', mr)
		i = newItem
		i.update(data, context, newIDs2)
		print(i)
except Exception as e:
	logger = logging.getLogger(__name__)
	logger.error("%s" % traceback.format_exc())
        
with transaction.atomic():
    context = Context('en', mr)
    newItem.markDeleted(context)
    print("Comment Prompt deleted")
