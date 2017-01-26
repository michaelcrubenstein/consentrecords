# python3 data/10listusers.py -start 2016-05-08 -end 2016-05-08
# python3 data/10listusers.py -start 2016-05-08 -end 2016-05-08 -all

import datetime
import django; django.setup()
import tzlocal
import getpass
import sys
import csv
import traceback

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *

def taggedArg(key):
    try:
        return sys.argv[sys.argv.index(key) + 1]
    except ValueError:
        return None
    except IndexError:
        return None
    
if __name__ == "__main__":

    try:
        startDate = taggedArg('-start')
        endDate = taggedArg('-end')
        
        print ('Start, End Dates:', startDate, endDate)

        users = Instance.objects.filter(typeID=terms.user, deleteTransaction__isnull=True)\
            .order_by('transaction__creation_time');
        
        if startDate:
            users = users.filter(transaction__creation_time__gte=startDate)
        if endDate:
            users = users.filter(transaction__creation_time__lte=endDate)
            
        print ('User Count: ', users.count())
        
        sys.stdout.write("\n")
        sys.stdout.write("%s\t%s\t%s\n" % ("Name", "Experience Count", "Creation Time"))
        
        sum = 0
        if '-all' in sys.argv:
            t = (lambda u: True)
        else:
            t = (lambda u: not u.getDescription().endswith('@pathadvisor.com') and\
                           not u.getDescription().endswith('@consentrecords.org'))
        for u in users:
            if t(u):
                p = u.value_set.get(field=terms['Path'], deleteTransaction__isnull=True)
                experiences = p.referenceValue.value_set.filter(field=terms['More Experience'], deleteTransaction__isnull=True)
                sum += experiences.count()
                sys.stdout.write("%s\t%s\t%s\n" % (u.getDescription(), experiences.count(), u.transaction.creation_time))
            # raise RuntimeError("Done")
                                
        print ('Experience Count: ', sum)
    except Exception as e:
        print("%s" % traceback.format_exc())