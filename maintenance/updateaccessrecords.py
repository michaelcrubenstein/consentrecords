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

from consentrecords.models import TransactionState, Terms, Instance, Value, DeletedValue, DeletedInstance, NameList
from consentrecords.models import AccessRecord

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        
        f = Instance.objects.filter(accessrecord__isnull=True,
                                    typeID__value__fieldID=Terms.defaultAccess,
                                    typeID__value__deletedvalue__isnull=True,
                                    deleteTransaction__isnull=True)
                                    
        print("%s root instances with missing access records" % f.count())
        
        AccessRecord.objects.bulk_create([AccessRecord(id=i, source=i) for i in f])
        
        f = Instance.objects.filter(accessrecord__isnull=True,
                                    value__fieldID=Terms.specialAccess,
                                    value__deleteTransaction__isnull=True,
                                    deletedinstance__isnull=True)
                                    
        print("%s special instances with missing access records" % f.count())
        
        AccessRecord.objects.bulk_create([AccessRecord(id=i, source=i) for i in f])
        
        f = Instance.objects.filter(accessrecord__isnull=True,
                                    deleteTransaction__isnull=True,
                                    parent__accessrecord__isnull=False)
        
        while f.count():                            
            print("%s child instances with missing access records" % f.count())
            AccessRecord.objects.bulk_create([AccessRecord(id=i, source=i.parent.accessrecord.source) for i in f])
            f = Instance.objects.filter(accessrecord__isnull=True,
                                        deleteTransaction__isnull=True,
                                        parent__accessrecord__isnull=False)
                                        
        print ("no more child instances with missing access records")

