# Script for making a suggestion for a user to add to their pathway.
#
# python3 data/09suggestexperience.py 'Testing/suggestions/suggestions 20170421.txt' michaelcrubenstein@gmail.com

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
from consentrecords import pathparser
from consentrecords import instancecreator

if __name__ == "__main__":
    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)
    
    check = '-check' in sys.argv

    try:
        with transaction.atomic():
            transactionState = None if check else TransactionState(user)
            userInfo = UserInfo(user)
            userPath = userInfo.instance.getSubInstance(terms['Path'])
        
            nameList = NameList()
            fieldsDataDictionary = FieldsDataDictionary()
            language = None
            
            c = 1
            with open(sys.argv[1], 'r') as f:
                line = f.readline().strip()
                while len(line) > 0:
                    args = line.split(None, 2)
                    recipientName = args[0]
                    phasename = args[1]
                    tagName = args[2]
                    print (recipientName, tagName, phasename)
                    
                    recipient = Instance.objects.get(value__deleteTransaction__isnull=True,
                                                      value__field=terms.email,
                                                      value__stringValue__iexact=recipientName)
                    
                    tag = Instance.objects.get(typeID=terms['Service'],
                                               value__deleteTransaction__isnull=True,
                                               value__field=terms.name,
                                               value__stringValue__iexact=tagName)
                    
                    phase = terms['Timeframe'].value_set.get(field=terms['enumerator'],
                        referenceValue__description__text=phasename,
                        referenceValue__deleteTransaction__isnull=True).referenceValue
                    
                    notificationData = {\
                            'name': [{'text': 'crn.ExperienceSuggestion'}],
                            'argument': [{'instanceID': userPath.id},
                                         {'instanceID': tag.id},
                                         {'instanceID': phase.id}],
                            'is fresh': [{'instanceID': terms.yesEnum.id}]
                        }
                    notification, notificationValue = instancecreator.create(terms['notification'], 
                        recipient, terms['notification'], -1, 
                        notificationData, nameList, transactionState, instancecreator.checkCreateNotificationAccess)
                    
                    line = f.readline().strip()
                                            
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())