# python3 data/03loadbps.py 'data/BPSdump.csv' michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import sys
import csv

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo, AccessRecord, NameList
from consentrecords import pathparser
from consentrecords import instancecreator

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        userInfo = UserInfo(user)
        
