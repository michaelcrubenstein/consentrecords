# python3 reports/03termusages.py Service

import profile
import getpass
import sys
import django
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Count
from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator
from parse import cssparser
from consentrecords.views import api

if __name__ == "__main__":
    django.setup()
    
    try:
        termName = sys.argv[1]
        v1 = Value.objects.filter(referenceValue__typeID=terms[termName])
        i1=Instance.objects.filter(value__in=v1)
        t1 = Instance.objects.filter(typeID=terms.term,deleteTransaction__isnull=True,typeInstances__in=i1)\
            .order_by('description__text')\
            .distinct()
            
        sys.stdout.write("Terms where there are instances that contain objects of this type:\n")
        for t in t1:
            sys.stdout.write("    %s\n"%t)
            
        v2 = Value.objects.filter(field=terms['_pick object path'],deleteTransaction__isnull=True,stringValue__contains=termName)
        sys.stdout.write("\nPick Object Paths\n")
        for v in v2:
            sys.stdout.write("    %s\t%s\n"%(v.instance.description.text, v.stringValue))
            
    except Exception as e:
        sys.stderr.write("%s\n" % traceback.format_exc())