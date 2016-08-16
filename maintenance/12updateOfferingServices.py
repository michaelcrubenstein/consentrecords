# python3 maintenance/12updateOfferingServices.py michaelcrubenstein@gmail.com

# Identify the offering services that point to obsolete services and correct them.

import datetime
import django
import tzlocal
import getpass
import sys
import logging
import traceback

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import instancecreator
from consentrecords import pathparser

if __name__ == "__main__":
    django.setup()

    username = sys.argv[1] if len(sys.argv) > 1 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        try:
            values = Value.objects.filter(field=terms['Service'], deleteTransaction__isnull=True, referenceValue__deleteTransaction__isnull=False)

            print ("Values Count: %s" % values.count())
        
            s1 = pathparser.selectAllObjects('Service[_name=Swimming]', [])[0]
            s2 = pathparser.selectAllObjects('Service[_name=Tennis]', [])[0]
            s3 = pathparser.selectAllObjects('Service[_name=Baseball]', [])[0]
            s4 = pathparser.selectAllObjects('Service[_name=Basketball]', [])[0]
            replacements = \
                {"Swimming Lessons": s1, "Swimming For Fun": s1,
                 "Tennis Lessons": s2,
                 "Baseball Training": s3,
                 "Basketball Training": s4,
                }
        
            transactionState = TransactionState(user)     
            for v in values:
                if str(v.referenceValue) in replacements:
                    v.updateValue(replacements[str(v.referenceValue)], transactionState)
                else:
                    sys.stderr.write("Missing %s\n" % str(v.referenceValue))
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("%s" % traceback.format_exc())
