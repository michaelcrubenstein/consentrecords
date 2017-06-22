import django; django.setup()
from django.db import transaction
import profile
import traceback
import logging
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
        print(context.authUser)
        newUser = User.create(d, context, newIDs=newIDs)
        print(str(newUser), newIDs)
        userID = newIDs['0']

def parse(path, context, resultClass):
    print("### %s, context" % path)
    tokens = cssparser.tokenizeHTML(path)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
    qs2 = qs2.distinct()
    return qs2

try:
	data = [{'clientID': '0', 'name': 'crn.FollowerAccept',
			 'arguments': ['user[email>text="elizabethskavish@gmail.com"]']
			},
			{'clientID': '1', 'name': 'crn.ExperienceCommentRequested',
			 'arguments': ['user[email>text="elizabethskavish@gmail.com"]/path',
						   'experience/%s' % newIDs['4'],
						   'comment/%s' % newIDs['6'],
						  ]
			},
			{'clientID': '2', 'name': 'crn.ExperienceQuestionAnswered',
			 'arguments': ['path/%s' % newIDs['3'],
						   'experience/%s' % newIDs['4'],
						  ]
			},
			{'clientID': '3', 'name': 'crn.ExperienceSuggestion',
			 'arguments': ['user[email>text="elizabethskavish@gmail.com"]/path',
						   'service[name>text=Job]',
						  ]
			},
		   ]
	with transaction.atomic():
		newIDs2 = {}
		for d in data:
			context = Context('en', mr)
			user = parse('user[email>text="foouser1@pathadvisor.com"]', context, User)[0]
			newItem = Notification.create(user, d, context, newIDs=newIDs2)
			print(str(newItem), newIDs2)

	with transaction.atomic():
		data = {'id': newIDs2['0'], 'is fresh': 'no'}
		newIDs3 = {}
		context = Context('en', mr)
		i = Notification.objects.filter(pk=newIDs2['0'])[0]
		i.update(data, context, newIDs3)
		print(i)

	data = {'first name': 'Bar',
			'last name': 'User1A',
			'birthday': '2001-02-02',
			'emails': [{'id': newIDs['1'], 
						'text': 'baruser1a@pathadvisor.com',
					   },
					   {'clientID': '1', 
						'text': 'biffuser1b@pathadvisor.com',
					   },
					   ],
			'path': {'id': newIDs['3'],
					 'birthday': '2001-02-02',
					 'name': 'barUser1A',
					 'can answer experience': '',
				'experiences': [{ 'id': newIDs['4'],
								  'organization': 'organization[name>text=Beacon Academy]',
								  'site': 'organization[name>text=Beacon Academy]/site[name>text^="Boston"]',
								  'offering': 'organization[name>text=Beacon Academy]/site[name>text^="Boston"]/offering[name>text=Jump Year]',
								  'start': '2014-07',
								  'end': '2015-06',
								  'timeframe': 'Previous',
								  'services': [{'id': newIDs['5'], 
												'service': 'service[name>text^=Jump Year'},
											   {'clientID': '5',
												'service': 'service[name>text^=School]',
											   }],
								  'comments': [{'id': newIDs['6'],
												'text': 'I had many great teachers, especially for science.',
												'question': 'Who was your favorite teacher?',
												'asker': 'user[email>text="testuser28@pathadvisor.com"]/path'}],
								},
								{ 'id': newIDs['7'],
								  'custom organization': 'Everett City Hall',
								  'custom site': 'Everett, MA',
								  'custom offering': 'City Councilor',
								  'custom services': [{'id': newIDs['8'],
													   'name': 'City Councilor'}],
								  'services': [{'id': newIDs['9'], 
												'service': 'service[name>text=Government Job'}],
								},
							   ],
						 },
			'user grant requests': [{'id': newIDs['10'],
					   'grantee': 'user[email>text="testuser28@pathadvisor.com"]'
					   },
					   {'id': newIDs['11'], 'delete': 'delete'
					   },
					   {'clientID': '12', 'grantee': 'user[email>text="michaelcrubenstein@gmail.com"]'}],
		   }
	   
	with transaction.atomic():
		newIDs4 = {}
		context = Context('en', mr)
		i = User.objects.filter(pk=newIDs['0'])[0]
		i.update(data, context, newIDs4)
		print(i)
except Exception as e:
	logger = logging.getLogger(__name__)
	logger.error("%s" % traceback.format_exc())

with transaction.atomic():
    context = Context('en', mr)
    newUser.markDeleted(context)
    print("user deleted")