# python3 data/07updateservices.py -user michaelcrubenstein@gmail.com -check

import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import csv
import re

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

def removeService(typeName, name, check, transactionState):
    try:
        service = Instance.objects.get(typeID=terms[typeName],
                                       deleteTransaction__isnull=True,
                                       description__text=name)
    except Instance.DoesNotExist:
        return
    vs = Value.objects.filter(referenceValue=service, deleteTransaction__isnull=True)

    print('%s %s: %s'%(name, typeName, vs.count()))
    countServices = vs.filter(instance__typeID=terms['Service']).count()
    if countServices: print("    Service: %s"%countServices)

    countOfferings = vs.filter(instance__typeID=terms['Offering']).count()
    if countOfferings: print("    Offerings: %s"%countOfferings)

    countExperiences = vs.filter(instance__typeID=terms['More Experience']).count()
    if countExperiences: print("    More Experiences: %s"%countExperiences)
    
    if not check:
        for v in vs:
            v.markAsDeleted(transactionState)
        service.markAsDeleted(transactionState)
            
def embedService(typeName, oldName, newName, check, userInfo, transactionState):
    try:
        oldService = Instance.objects.get(typeID=terms[typeName],
                                       deleteTransaction__isnull=True,
                                       description__text=oldName)
        newService = Instance.objects.get(typeID=terms[typeName],
                                       deleteTransaction__isnull=True,
                                       description__text=newName)
    except Instance.DoesNotExist:
        return
    vs = Value.objects.filter(referenceValue=oldService, deleteTransaction__isnull=True)

    print('%s %s: %s'%(oldName, typeName, vs.count()))
    countServices = vs.filter(instance__typeID=terms['Service']).count()
    if countServices: print("    Service: %s"%countServices)

    countOfferings = vs.filter(instance__typeID=terms['Offering']).count()
    if countOfferings: print("    Offerings: %s"%countOfferings)

    countExperiences = vs.filter(instance__typeID=terms['More Experience']).count()
    if countExperiences: print("    More Experiences: %s"%countExperiences)
    
    if not check:
        for v in vs:
            v.updateValue(newService, userInfo, transactionState)
        oldService.markAsDeleted(transactionState)
            
if __name__ == "__main__":
    django.setup()

    try:
        try:
            username = sys.argv[sys.argv.index('-user') + 1]
        except ValueError:
            username = input('Email Address: ')
        except IndexError:
            username = input('Email Address: ')
        password = getpass.getpass("Password: ")

        user = authenticate(username=username, password=password) 
    
        check = '-check' in sys.argv
        
        with transaction.atomic():
            transactionState = None if check else TransactionState(user)
            userInfo = UserInfo(user)
            removeService('Service', 'Education', check, transactionState)
            removeService('Service Domain', 'XCareer & Finance', check, transactionState)
            removeService('Service Domain', 'XExtra Curricular', check, transactionState)
            removeService('Service Domain', 'XHelping Out', check, transactionState)
            embedService('Service', 'Basketball', 'Basketball Playing', check, userInfo, transactionState)
            embedService('Service', 'Football', 'Football Playing', check, userInfo, transactionState)
            embedService('Service', 'Soccer', 'Soccer Playing', check, userInfo, transactionState)
            embedService('Service', 'Theater', 'Theater Role', check, userInfo, transactionState)
                    
    except Exception as e:
        print("%s" % traceback.format_exc())

# Incorporate the Basketball Service into Play Basketball
# Incorporate the Football Service into Play Football
# Incorporate the Soccer Service into Play Soccer
# Incorporate Theater into Theater Role

