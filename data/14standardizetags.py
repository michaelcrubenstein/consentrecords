# Script for replacing User Entered Services with standard services
# and User Entered Offerings with standard services.
#
# For example, if a user enters 'football' as an offering, that is changed
# to a standard service so that it can be found by a search.
#
# python3 data/14standardizetags.py -user michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import csv
import re

django.setup()

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

def readIndentedLine(f):
    s = f.readline()
    indent = len(s) - len(s.lstrip())
    return s.strip(), indent
    
def parseProperty(s):
    a = s.split(":", 1)
    t = terms[a[0].strip()]
    v = a[1].strip() if len(a) > 1 else None
    return t, v

def isTranslationField(fd):
    return fd['dataType'] == '_translation'
    
def parseTranslation(text):
    m = re.search('^([a-z]{2}) \- (.*)', text)
    if m:
        return m.groups(0)
    else:
        return 'en', text

    
def getReferenceValue(parent, field, value, fd, nameLists, userInfo):
    if 'pickObjectPath' in fd:
        pickObjectPath = fd['pickObjectPath'];
        if pickObjectPath.startswith("parent") and pickObjectPath[6] in ">:=<":
            pickObjectPath = "#"+parent.parent.id+pickObjectPath[6:];
    else:
        pickObjectPath = fd['ofKindID']
        
    # append a qualifier for the specified text to the pickObjectPath
    if 'ofKindID' in fd:
        type = Instance.objects.get(pk=fd['ofKindID'])
    else:
        l = pathparser.getQuerySet(pickObjectPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
        type = l[0].typeID
        
    verbs = list(filter(lambda verb: verb[2] == terms.textEnum or verb[2] == terms.firstTextEnum, nameLists.getNameUUIDs(type)))
    
    field, dataType, descriptorType = verbs[0]
    if isTranslationField(fd):
        languageCode, text = parseTranslation(value)
    else:
        text = value
    pickObjectPath += '[' + field.getDescription() + '="' + text + '"]'
    
    l = pathparser.getQuerySet(pickObjectPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
    if len(l):
        return l[0]
    else:
        raise RuntimeError("Unrecognized Reference Value in %s: %s(%s)" % (str(parent), str(field), value))
    
if __name__ == "__main__":
    check = '-check' in sys.argv

    try:
        try:
            username = sys.argv[sys.argv.index('-user') + 1]
        except ValueError:
            username = input('Email Address: ')
        except IndexError:
            username = input('Email Address: ')
        password = getpass.getpass("Password: ")

        user = authenticate(username=username, password=password) 
    
        with transaction.atomic():
            transactionState = None if check else TransactionState(user)
            userInfo = UserInfo(user)
        
            nameList = NameList()
            fieldsDataDictionary = FieldsDataDictionary()
            language = None
            serviceField = terms['Service']
            
            standardServices = Instance.objects.filter(\
                typeID=serviceField,\
                deleteTransaction__isnull=True);
                
            d = dict((''.join(s.description.text.lower().split()), s) for s in standardServices)
            
            customServices = Value.objects.filter(\
                field=terms['User Entered Service'],\
                deleteTransaction__isnull=True);
                
            for c in customServices:
                key = ''.join(c.stringValue.lower().split())
                if key in d.keys():
                    parent = c.instance
                    if not parent.value_set.filter(deleteTransaction__isnull=True,
                        field=serviceField,
                        referenceValue_id=d[key].id).exists():
                        c.markAsDeleted(transactionState)
                        parent.addValue(serviceField, d[key], parent.getNextElementIndex(serviceField), userInfo, transactionState)
                        print(parent.description.text, d[key])
                                
            customOfferings = Value.objects.filter(\
                field=terms['User Entered Offering'],\
                deleteTransaction__isnull=True);
                
            for c in customOfferings:
                key = ''.join(c.stringValue.lower().split())
                if key in d.keys():
                    parent = c.instance
                    if not parent.value_set.filter(deleteTransaction__isnull=True,
                        field=serviceField,
                        referenceValue__value__deleteTransaction__isnull=True,
                        referenceValue__value__field=serviceField,
                        referenceValue__value__referenceValue_id=d[key].id).exists():
                        parent.addValue(serviceField, d[key], parent.getNextElementIndex(serviceField), userInfo, transactionState)
                        print(str(parent.parent.parent), parent.description.text, d[key])
    except Exception as e:
        print("%s" % traceback.format_exc())