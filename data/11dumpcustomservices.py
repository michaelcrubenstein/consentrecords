# python3 data/11dumpcustomservices.py -start 2016-05-08 -end 2016-05-08

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

        values = Value.objects.filter(field=terms['User Entered Service'], deleteTransaction__isnull=True)\
        	.order_by('transaction__creation_time')
        
        if startDate:
            values = values.filter(transaction__creation_time__gte=startDate)
        if endDate:
        	values = values.filter(transaction__creation_time__lte=endDate)
        	
        for v in values:
            user = v.instance.parent.parent
            i = v.instance
            sys.stdout.write("%s\t%s\t%s\t%s\n" % (user.getDescription(), i.getDescription(), v.stringValue, v.transaction.creation_time))
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())