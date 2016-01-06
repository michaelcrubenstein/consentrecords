# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import logging

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, DeletedValue, DeletedInstance, NameList

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    logger = logging.getLogger(__name__)
    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        
        f = Instance.objects.filter(description__isnull=True,
                                    deletedinstance__isnull=True)
                                    
        Instance.updateDescriptions(f, NameList())
        
        logger.error("%s instances with no description" % f.count())
        
        f = Instance.objects.filter(description__text="",
                                    deletedinstance__isnull=True)
                                    
        Instance.updateDescriptions(f, NameList())
        
        logger.error("%s instances with 0-length description text" % f.count())
        
