# python3 maintenance/13deleteBrokenValueReferences.py -user michaelcrubenstein@gmail.com

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
    
    try:
        with transaction.atomic():
            transactionState = TransactionState(user)
            userInfo = UserInfo(user)
        
            values = Value.objects.filter(deleteTransaction__isnull=True,referenceValue__deleteTransaction__isnull=False)
            
            sys.stderr.write('Count: %s\n'%values.count())
            for v in values:
                print("%s: %s"%(v.id, str(v)))
            if input('Delete? (y/n): ') == 'y':
                for v in values:
                    print("%s: %s"%(v.id, str(v)))
                    v.markAsDeleted(transactionState)
                     
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())