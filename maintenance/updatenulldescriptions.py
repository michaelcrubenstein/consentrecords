# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import logging
import sys

from django.db import transaction
from django.db.models import Q
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, DeletedValue, DeletedInstance, Description, NameList

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    logger = logging.getLogger(__name__)
    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        
        # Uncomment the following line to recalculate them all.
        # Description.objects.all().delete()
        
        f = Instance.objects.filter(Q(description__isnull=True)|Q(description__text=""),
                                    deletedinstance__isnull=True)
        print("%s instances with no description" % f.count())
        
        vs = Value.objects.filter(referenceValue__in=f, deletedvalue__isnull=True)
        print("%s values referencing instances with no description" % vs.count())        
        
        nameList = NameList()
        descriptors = filter(lambda v: nameList.descriptorField(v), vs) 
        descriptors = list(descriptors)
        print("%s descriptor values referencing instances with no description" % len(descriptors))        

        g = f.exclude(value__in=descriptors)
        print("%s leaf instances with no description" % len(list(g)))        
                                    
        Instance.updateDescriptions(g, NameList())
        
