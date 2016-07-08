# python3 maintenance/initializefacts.py michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import sys
import getpass

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState
from consentrecords import bootstrap

if __name__ == "__main__":
    django.setup()

    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user)  
        bootstrap.initializeFacts(transactionState) 
