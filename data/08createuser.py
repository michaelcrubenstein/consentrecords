# python3 data/08createuser.py -email testuser32@pathadvisor.com -first Test -last User32 -birthday 2001-04 -user michaelcrubenstein@gmail.com

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

def readIndentedLine(f):
    s = f.readline()
    indent = len(s) - len(s.lstrip())
    return s.strip(), indent
    
def parseProperty(s):
    a = s.split(":", 1)
    t = terms[a[0].strip()]
    v = a[1].strip() if len(a) > 1 else None
    return t, v

def findFieldData(fieldsData, field):
    for fd in fieldsData:
        if fd["nameID"] == field.id:
            return fd
    raise RuntimeError("Unrecognize field: %s" % str(field))
    
def getSubFieldType(fd, field):
    if "ofKindInstance" not in fd:
        fd["ofKindInstance"] = Instance.objects.get(pk=fd['ofKindID'])
    return fd["ofKindInstance"]

def hasUniqueValue(fd):
    if "capacity" not in fd:
        return False
    return fd["capacity"] == "_unique value"
       
def isTextField(fd):
    return fd['dataType'] != '_translation' and fd['dataType'] != '_object'
    
def isObjectField(fd):
    return fd['dataType'] == '_object'
    
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

        email = sys.argv[sys.argv.index('-email') + 1]
        first = sys.argv[sys.argv.index('-first') + 1]
        last = sys.argv[sys.argv.index('-last') + 1]
        birthday = sys.argv[sys.argv.index('-birthday') + 1]

        # Make sure that there is not already a user with this email
        f = Instance.objects.filter(typeID=terms.user, deleteTransaction__isnull=True,
            value__stringValue=email,
            value__deleteTransaction__isnull=True,
            value__field=terms.email)
        if f.exists():
            raise RuntimeError('the email "%s" already exists' % email)
            
        with transaction.atomic():
            transactionState = TransactionState(user)
            userInfo = UserInfo(user)
        
            nameList = NameList()
            fieldsDataDictionary = FieldsDataDictionary()
            language = None
            
            properties = {'_email': [{'text': email}], 
                          '_first name': [{'text': first}], 
                          '_last name': [{'text': last}], 
                          'Birthday': [{'text': birthday}],
                          'More Experiences': [{'cells': 
                              {'Birthday': [{'text': birthday}] }}],
                         }
            root, newValue = instancecreator.create(terms.user, None, None, -1, properties, nameList, userInfo, transactionState)
                        
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())