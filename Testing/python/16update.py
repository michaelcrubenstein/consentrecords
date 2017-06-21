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

data = {'translations': [{'clientID':'1', 'text': 'Qué tú comes?', 'languageCode': 'sp'}]
        }
        
with transaction.atomic():
    newIDs = {}
    context = Context('en', mr)
    commentPrompt = parse('comment prompt', context, CommentPrompt)[0]
    commentPrompt.update(data, context, newIDs)
    print(str(commentPrompt), str(commentPrompt.texts.all()), newIDs)
    
with transaction.atomic():
    context = Context('en', mr)
    data = {'translations': [{'id': newIDs['1'], 'delete': 'delete'}]}
    commentPrompt.update(data, context, newIDs)

