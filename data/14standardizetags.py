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

def loadRoot(type, field, value, nameList, transactionState):
    languageCode, text = parseTranslation(value)
    
    objs = Instance.objects.filter(deleteTransaction__isnull=True,
                            typeID=type,
                            value__deleteTransaction__isnull=True,
                            value__field=field,
                            value__stringValue__iexact=text)
    if len(objs):
        root = objs[0]
    else:
        objs = Instance.objects.filter(deleteTransaction__isnull=True,
                                typeID=type,
                                value__deleteTransaction__isnull=True,
                                value__field=field,
                                value__stringValue__istartswith=text);
        if len(objs):
            root = objs[0]
            value = root.value_set.filter(field=field, stringValue__istartswith=text, deleteTransaction__isnull=True)
            print ("? %s: %s: %s" % (text, value[0].stringValue, root.id))
            if input('Create anyway? (y/n): ') == 'y':
                propertyList = {field.description.text: [{'text': text, 'languageCode': languageCode}]}
                root, newValue = instancecreator.create(type, None, None, -1, propertyList, nameList, transactionState)
                print("+ %s: %s" % (text, root.id))
        else:
            propertyList = {field.description.text: [{'text': text, 'languageCode': languageCode}]}
            root, newValue = instancecreator.create(type, None, None, -1, propertyList, nameList, transactionState)
            print("+ %s: %s" % (text, root.id))
        
    return root
    
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
        l = pathparser.selectAllObjects(pickObjectPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
        type = l[0].typeID
        
    verbs = list(filter(lambda verb: verb[2] == terms.textEnum or verb[2] == terms.firstTextEnum, nameLists.getNameUUIDs(type)))
    
    field, dataType, descriptorType = verbs[0]
    if isTranslationField(fd):
        languageCode, text = parseTranslation(value)
    else:
        text = value
    pickObjectPath += '[' + field.getDescription() + '="' + text + '"]'
    
    l = pathparser.selectAllObjects(pickObjectPath, userInfo=userInfo, securityFilter=userInfo.findFilter)
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
            
            customServices = Value.objects.filter(\
                field=terms['User Entered Service'],\
                deleteTransaction__isnull=True);
                
            standardServices = Instance.objects.filter(\
                typeID=serviceField,\
                deleteTransaction__isnull=True);
                
            d = dict((''.join(s.description.text.lower().split()), s) for s in standardServices)
            
            for c in customServices:
                key = ''.join(c.stringValue.lower().split())
                if key in d.keys():
                    parent = c.instance
                    if not parent.value_set.filter(deleteTransaction__isnull=True,
                        field=serviceField,
                        referenceValue_id=d[key].id).exists():
                        c.markAsDeleted(transactionState)
                        parent.addValue(serviceField, d[key], parent.getNextElementIndex(serviceField), transactionState)
                        print(parent.description.text, d[key])
                                
    except Exception as e:
        print("%s" % traceback.format_exc())