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
        
        a = pathparser.tokenize('Organization')
        uuObjects = pathparser.selectAllObjects(path=a, userInfo=UserInfo(user))
        uuObjects = list(filter(lambda i: not i.value_set.filter(fieldID=Terms.publicAccess,deletedvalue__isnull=True).exists(), uuObjects))
        print("%s organizations with missing public access values" % len(uuObjects))

        for i in uuObjects:
        	i.addReferenceValue(Terms.publicAccess, Terms.readPrivilegeEnum, 0, transactionState)
    
    print("Complete.")                                

