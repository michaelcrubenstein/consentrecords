# Script for updating the denormalized table of tag sources and targets.
#
# For example, if a user enters 'football' as an offering, that is changed
# to a standard service so that it can be found by a search.
#
# python3 data/15updateTagTable.py -user michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import re

django.setup()

from django.db import transaction
from django.db.models import Q
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

if __name__ == "__main__":
    check = '-check' in sys.argv

    try:
        try:
            username = sys.argv[sys.argv.index('-user') + 1]
        except ValueError:
            username = input('Email Address: ')
        except IndexError:
            username = input('Email Address: ')
        password = getpass.getpass("Password: ")

        user = authenticate(username=username, password=password) 
    
        with transaction.atomic():
            transactionState = None if check else TransactionState(user)
            userInfo = UserInfo(user)
        
            nameList = NameList()
            fieldsDataDictionary = FieldsDataDictionary()
            language = None
            serviceField = terms['Service']
            
            standardServices = Instance.objects.filter(\
                typeID=serviceField,\
                deleteTransaction__isnull=True);
                
            TagSource.objects.filter(Q(source__deleteTransaction__isnull=True)|\
                                     Q(target__deleteTransaction__isnull=True)).delete()
                                     
            for s in standardServices:
                for v in s.value_set.filter(field=serviceField,
                                     deleteTransaction__isnull=True,
                                     referenceValue__deleteTransaction__isnull=True):
                    TagSource.objects.get_or_create(source=s, target=v.referenceValue)

    except Exception as e:
        print("%s" % traceback.format_exc())