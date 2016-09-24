# python3 data/09listusers.py -path '"Experience Prompt"'

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

if __name__ == "__main__":
    django.setup()

    try:
        users = Instance.objects.filter(typeID=terms.user, deleteTransaction__isnull=True)\
        	.order_by('transaction__creation_time');
        	
        for u in users:
            sys.stdout.write("%s\t%s\n" % (u.getDescription(), u.transaction.creation_time))
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())