# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo, AccessRecord
from consentrecords import pathparser

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[1] if len(sys.argv) > 1 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)

        f = AccessRecord.objects.filter(id__deleteTransaction__isnull=False)

        print ("Deleted AccessRecord Count: %s" % f.count())
        print ("User Access Record Count: %s" % AccessRecord.objects.filter(pk__in=[Instance.getUserInstance(user)]))
        input('Confirm delete')
        
        f.delete()
