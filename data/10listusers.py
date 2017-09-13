# A script for listing the users created between a specified start date and end date.
# The -all option including users created for testing (.pathadvisor.com and .consentrecords.org)
#
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

        users = User.objects.filter(deleteTransaction__isnull=True)\
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
            t = (lambda u: not u.description().endswith('@pathadvisor.com') and\
                           not u.description().endswith('@consentrecords.org'))
        for u in users:
            if t(u):
                try:
                    p = u.path
                    experiences = p.experiences.filter(deleteTransaction__isnull=True)
                    experienceCount = experiences.count()
                    sum += experienceCount
                except Exception as e:
                    print(traceback.format_exc())
                    experienceCount = 0
                    
                sys.stdout.write("%s\t%s\t%s\n" % (u.description(), experienceCount, u.transaction.creation_time))

            # raise RuntimeError("Done")
                                
        print ('Experience Count: ', sum)
    except Exception as e:
        print("%s" % traceback.format_exc())