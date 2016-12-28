# Update the descriptions of all objects of the specified type.
# python3 maintenance/05updateDescriptionsOfType.py -user michaelcrubenstein@gmail.com -type Path

import datetime
import django
import tzlocal
import getpass
import logging
import sys

django.setup()

from django.db import transaction
from django.db.models import Q
from django.contrib.auth import authenticate

from consentrecords.models import *

if __name__ == "__main__":
    try:
        username = sys.argv[sys.argv.index('-user') + 1]
    except ValueError:
        username = input('Email Address: ')
    except IndexError:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")
    
    try:
    	typeName = sys.argv[sys.argv.index('-type') + 1]
    except ValueError:
        typeName = input('Type: ')
    except IndexError:
        typeName = input('Type: ')

    user = authenticate(username=username, password=password)

    logger = logging.getLogger(__name__)
    with transaction.atomic():
        transactionState = TransactionState(user)
        
        # Uncomment the following line to recalculate them all.
        # Description.objects.all().delete()
        
        f = Instance.objects.filter(typeID=terms[typeName],
                                    deleteTransaction__isnull=True)
        print("%s instances of type" % f.count())
        
        vs = Value.objects.filter(referenceValue__in=f, deleteTransaction__isnull=True)
        print("%s values referencing instances with no description" % vs.count())        
        
        descriptors = filter(lambda v: v.isDescriptor, vs) 
        descriptors = list(descriptors)
        print("%s descriptor values referencing instances with no description" % len(descriptors))        

        g = f.exclude(value__in=descriptors)
        print("%s leaf instances with no description" % len(list(g)))        
                                    
        Instance.updateDescriptions(g, NameList())
        
        f = Instance.objects.filter(pk__in=f)
        
