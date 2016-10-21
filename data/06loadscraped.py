# python3 data/06loadscraped.py data/terms.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/servicedomains.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/stages.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/services.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/experienceprompts.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/bps.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeBCYF.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeBeaconAcademy.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeSWSG.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeTufts.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeCollegesMA.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeCitizenSchools.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeStates.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeAISNE.txt michaelcrubenstein@gmail.com
# python3 data/06loadscraped.py data/scrapeCambridgePS.txt michaelcrubenstein@gmail.com

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
    django.setup()

    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password) 
    
    check = '-check' in sys.argv

    try:
        with transaction.atomic():
            transactionState = None if check else TransactionState(user)
            userInfo = UserInfo(user)
        
            nameList = NameList()
            fieldsDataDictionary = FieldsDataDictionary()
            language = None
            
            c = 1
            with open(sys.argv[1], 'r') as f:
                typeName = f.readline().strip()
                type = terms[typeName]
                s, indent = readIndentedLine(f); c += 1
                field, text = parseProperty(s)
                print(type.getDescription(), field.getDescription(), text)
                items = [(0, loadRoot(type, field, text, nameList, transactionState))]
                s, indent = readIndentedLine(f); c += 1
                while len(s) > 0:
                    while len(items) and indent <= items[-1][0]:
                        items = items[:-1]
                        
                    print('%s  %s%s' % (c, ' ' * indent, s))
                    if len(items) == 0:
                        type = terms[s]
                        s, indent = readIndentedLine(f); c += 1
                        field, text = parseProperty(s)
                        items = [(0, loadRoot(type, field, text, nameList, transactionState))]
                        s, indent = readIndentedLine(f); c += 1
                    else:
                        lastIndent, item = items[-1]
                        fieldsData = fieldsDataDictionary[item.typeID]
                        field, text = parseProperty(s)
                    
                        fieldData = findFieldData(fieldsData, field)
                        if not text:
                            # This is the start of a nested item.
                            type = getSubFieldType(fieldData, field)

                            currentIndent = indent

                            if hasUniqueValue(fieldData):
                                child = instancecreator.addUniqueChild(item, field, type, {}, nameList, transactionState)
                                s, indent = readIndentedLine(f); c += 1
                            else:
                                s, indent = readIndentedLine(f); c += 1
                                nameField, value = parseProperty(s)
                                if value:
                                    fieldsData = fieldsDataDictionary[type]
                                    fieldData = findFieldData(fieldsData, nameField)
                                    if isObjectField(fieldData):
                                        referenceValue = getReferenceValue(item, nameField, value, fieldData, nameList, userInfo)
                                        child = instancecreator.addNamedByReferenceChild(item, field, type, nameField, fieldData, referenceValue, nameList, transactionState)
                                    else:
                                        if isTranslationField(fieldData):
                                            languageCode, textValue = parseTranslation(value)
                                        else:
                                            languageCode, textValue = (None, value)
                                        child = instancecreator.addNamedChild(item, field, type, nameField, fieldData, textValue, languageCode, nameList, transactionState)
                                    s, indent = readIndentedLine(f); c += 1
                                else:
                                    child = instancecreator.addUniqueChild(item, field, type, {}, nameList, transactionState)
                            Instance.updateDescriptions([child], nameList)
                        
                            if child.parent != item:
                                raise RuntimeError("child.parent != item")
                            items.append((currentIndent, child))
                        else:
                            # This is an additional property.
                            if isTextField(fieldData):
                                item.getOrCreateTextValue(field, {'text': text}, fieldData, transactionState)
                            elif isTranslationField(fieldData):
                                languageCode, value = parseTranslation(text)
                                item.getOrCreateTranslationValue(field, value, languageCode, fieldData, transactionState)
                            else:
                                referenceValue = getReferenceValue(item, field, text, fieldData, nameList, userInfo)
                                item.getOrCreateReferenceValue(field, referenceValue, fieldData, transactionState)
                            
                            if 'descriptorType' in fieldData:
                                Instance.updateDescriptions([item], nameList)
                        
                            s, indent = readIndentedLine(f); c += 1
                        
            # raise RuntimeError("Done")
                                
    except Exception as e:
        print("%s" % traceback.format_exc())