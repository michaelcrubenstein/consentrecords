# python3 data/10listusers.py -start 2016-05-08 -end 2016-05-08

import datetime
import django
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
    django.setup()

    try:
        startDate = taggedArg('-start')
        endDate = taggedArg('-end')
        
        print (startDate, endDate)

        users = Instance.objects.filter(typeID=terms.user, deleteTransaction__isnull=True)\
        	.order_by('transaction__creation_time');
        
        if startDate:
            users = users.filter(transaction__creation_time__gte=startDate)
        if endDate:
        	users = users.filter(transaction__creation_time__lte=endDate)
        	
        for u in users:
            sys.stdout.write("%s\t%s\n" % (u.getDescription(), u.transaction.creation_time))
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())