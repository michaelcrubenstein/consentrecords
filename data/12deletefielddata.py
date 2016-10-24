# python3 data/12deletefielddata.py -type Service -field Domain -user michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import csv
import re

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

if __name__ == "__main__":
    django.setup()

    try:
        username = sys.argv[sys.argv.index('-user') + 1]
    except ValueError:
        username = input('Email Address: ')
    except IndexError:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password) 
    
    instanceType = sys.argv[sys.argv.index('-type') + 1]
    fieldType = sys.argv[sys.argv.index('-field') + 1]

    try:
        with transaction.atomic():
            transactionState = TransactionState(user)
            userInfo = UserInfo(user)
        
            values = Value.objects.filter(field=terms[fieldType],instance__typeID=terms[instanceType],deleteTransaction__isnull=True)
            
            sys.stderr.write('Count: %s\n'%values.count())
            if input('Delete? (y/n): ') == 'y':
                for v in values: v.markAsDeleted(transactionState)
                     
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())