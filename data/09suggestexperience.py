# Script for making a suggestion for a user to add to their pathway.
#
# python3 data/09suggestexperience.py 'testing/suggestions/suggestions 20170421.txt' michaelcrubenstein@gmail.com https://www.pathadvisor.com
# python3 data/09suggestexperience.py 'testing/suggestions/suggestions test.txt' michaelcrubenstein@gmail.com http://127.0.0.1:8000
# python3 data/09suggestexperience.py 'testing/suggestions/suggestions 20170423.txt' michaelcrubenstein@gmail.com https://www.pathadvisor.com
# python3 data/09suggestexperience.py 'testing/suggestions/suggestions 20170424.txt' michaelcrubenstein@gmail.com https://www.pathadvisor.com

import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import csv
import re

django.setup()

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from custom_user.emailer import *

if __name__ == "__main__":
    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")
    hostURL = sys.argv[3] if len(sys.argv) > 3 else 'http://127.0.0.1:8000'

    user = authenticate(username=username, password=password)
    
    check = '-check' in sys.argv

    try:
        with transaction.atomic():
            context = Context('en', authenticate(username=username, password=password))
            userPath = context.user.paths.all()[0]
        
            with open(sys.argv[1], 'r') as f:
                line = f.readline().strip()
                while len(line) > 0:
                    args = line.split(None, 1)
                    recipientEmail = args[0]
                    tagName = args[1]
                    print (recipientEmail, tagName)
                    
                    recipient = User.objects.get(emails__text=recipientEmail, deleteTransaction__isnull=True)
                    
                    notificationData = {\
                            'name': 'crn.ExperienceSuggestion',
                            'is fresh': 'yes',
                            'arguments': ['path/%s' % userPath.id.hex,
                                          'service[name>text=%s]' % tagName],
                        }
                    notification = Notification.create(recipient, notificationData, context)
                    
#                     path = recipient.getSubInstance(terms['Path'])    
#                     salutation = recipient.getSubDatum(terms.firstName) or path.getSubDatum(terms.name)
#                     isAdmin = True
#                     
#                     Emailer.sendSuggestExperienceByTagEmail(salutation, recipientEmail, tag, isAdmin, hostURL)
                    
                    line = f.readline().strip()
                                            
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())