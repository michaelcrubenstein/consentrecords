# python3 data/04dumpconfiguration.py 'data/termsdump.txt' michaelcrubenstein@gmail.com

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
        
        path = statePath='_uuname'
        terms = pathparser.selectAllObjects(path, userInfo=userInfo,securityFilter=userInfo.findFilter)
        terms = sorted(terms, key=lambda t: t.value_set.filter(deleteTransaction__isnull=True,
                                           field=Terms.uuName)[0].stringValue)
        with open(sys.argv[1], 'w') as fOut:
            for term in terms:
                fOut.write('Term\n')
                termNames = term.value_set.filter(deleteTransaction__isnull=True,
                                           field=Terms.uuName)
                label = Terms.name.value_set.filter(deleteTransaction__isnull=True, field=Terms.uuName)[0].stringValue
                for n in termNames:
                    fOut.write('    %s: %s\n' % (label, n.stringValue))
            