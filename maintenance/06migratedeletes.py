# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate
from django.db.models import F
from django.db.models import Count

from consentrecords.models import TransactionState, Terms, Instance, Value, DeletedValue, DeletedInstance
from consentrecords.models import UserInfo, NameList
from consentrecords.models import AccessRecord
from consentrecords import pathparser

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)
    if not user:
        raise ValueError("user was not authenticated")

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        
        i = Instance.objects.filter(deletedinstance__isnull=False).count()
        j = Value.objects.filter(deletedvalue__isnull=False).count()
        
        for x in Instance.objects.filter(deletedinstance__isnull=False):
        	x.deleteTransaction = x.deletedinstance.transaction
        	x.save()
        
        for x in Value.objects.filter(deletedvalue__isnull=False):
        	x.deleteTransaction = x.deletedvalue.transaction
        	x.save()
        
        
        print("migrate %s instances" % i)
        print("migrate %s values" % j)
        input('Confirm transaction: ')
    
    print("Complete.")                                

