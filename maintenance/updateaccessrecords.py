# Migrate translation objects to translation types.
# python3 maintenance/updateaccessrecords.py 'michaelcrubenstein@gmail.com'

import datetime
import django; django.setup()
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate
from django.db.models import F
from django.db.models import Count

from consentrecords.models import *

if __name__ == "__main__":
    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        
        Instance.objects.update(accessSource=None)
        
        f = Instance.objects.filter(typeID__value__field=terms.defaultAccess,
                                    typeID__value__deleteTransaction__isnull=True,
                                    deleteTransaction__isnull=True)
                                    
        print("%s root instances with access records" % f.count())
        
        f.update(accessSource=F('id'))
        
        f = Instance.objects.filter(value__field=terms.specialAccess,
                                    value__deleteTransaction__isnull=True,
                                    deleteTransaction__isnull=True)
                                    
        print("%s special instances with access records" % f.count())
        
        f.update(accessSource=F('id'))
        
        f = Instance.objects.filter(accessSource__isnull=True,
                                    deleteTransaction__isnull=True,
                                    parent__accessSource__isnull=False)\
                            .select_related('parent')
        
        while f.exists():                            
            print("%s child instances with missing access records" % f.count())
            for i in f: 
                i.accessSource_id = i.parent.accessSource_id
                i.save()
                
            f = Instance.objects.filter(accessSource__isnull=True,
                                        deleteTransaction__isnull=True,
                                        parent__accessSource__isnull=False)\
                            .select_related('parent')
                                        
        print ("no more child instances with missing access records")

