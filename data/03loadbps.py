# python3 data/03loadbps.py 'data/BPSdump.csv' michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import sys
import csv

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

def addUniqueChild(parent, typeID, propertyList, nameList, userInfo, transactionState):
    children = parent.value_set.filter(field=typeID,
                                    deleteTransaction__isnull=True)
    if len(children):
        return children[0].referenceValue
    else:
        propertyList = {}
        item, newValue = instancecreator.create(typeID, parent, typeID, -1, propertyList, nameList, userInfo, transactionState)
        return item
        
def addUniqueValue(parent, field, stringValue, userInfo, transactionState):
    children = parent.value_set.filter(field=field,
                                       stringValue=stringValue,
                                       deleteTransaction__isnull=True)
    if len(children):
        return children[0]
    else:
        return parent.addValue(field, stringValue, 0, userInfo, transactionState)
        
def addUniqueReferenceValue(parent, field, referenceValue, transactionState):
    children = parent.value_set.filter(field=field,
                                       referenceValue=referenceValue,
                                       deleteTransaction__isnull=True)
    if len(children):
        return children[0]
    else:
        return parent.addReferenceValue(field, referenceValue, 0, transactionState)
        
def getChildrenByName(parent, field, name):
    return parent.value_set.filter(deleteTransaction__isnull=True,
                                    field=field,
                                    referenceValue__value__deleteTransaction__isnull=True,
                                    referenceValue__value__field=terms.name,
                                    referenceValue__value__stringValue__iexact=name)
def getValueByReference(parent, field, r):
    return parent.value_set.filter(deleteTransaction__isnull=True,
                                    field=field,
                                    referenceValue=r)

if __name__ == "__main__":
    django.setup()

    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user)
        userInfo = UserInfo(user)
        
        orgTerm = terms['Organization']
        sitesTerm = terms['Sites']
        siteTerm = terms['Site']
        addressTerm = terms['Address']
        streetTerm = terms['Street']
        cityTerm = terms['City']
        stateTerm = terms['State']
        zipTerm = terms['Zip Code']
        offeringsTerm = terms['Offerings']
        offeringTerm = terms['Offering']
        serviceTerm = terms['Service']
        sessionsTerm = terms['Sessions']
        sessionTerm = terms['Session']
        nameTerm = terms['_name']
        nameList = NameList()
        with open(sys.argv[1], 'r') as f:
            reader = csv.reader(f)
            for s in reader:
                orgName = s[0].strip()
                siteName = s[1].strip()
                streetName = s[2].strip()
                cityName = s[3].strip()
                stateName = s[4].strip()
                zipName = s[5].strip()
                grades = s[6:]
                statePath='_term[_name=State]>enumerator[_name='+stateName+']'
                stateInstance = pathparser.getQuerySet(statePath, userInfo=userInfo,securityFilter=userInfo.findFilter)[0]
                
                schoolInstance = pathparser.getQuerySet('Service[_name=School]',
                                                             userInfo=userInfo,securityFilter=userInfo.findFilter)[0]
                educationInstance = pathparser.getQuerySet('Service[_name=Education]',
                                                             userInfo=userInfo,securityFilter=userInfo.findFilter)[0]
                
                orgs = Instance.objects.filter(deleteTransaction__isnull=True,
                                        typeID=orgTerm,
                                        value__deleteTransaction__isnull=True,
                                        value__field=nameTerm,
                                        value__stringValue__iexact=orgName)
                if len(orgs):
                    org = orgs[0]
                else:
                    orgs = Instance.objects.filter(deleteTransaction__isnull=True,
                                            typeID=orgTerm,
                                            value__deleteTransaction__isnull=True,
                                            value__field=nameTerm,
                                            value__stringValue__istartswith=orgName);
                    if len(orgs):
                        org = orgs[0]
                        value = item.value_set.filter(field=nameTerm, stringValue__istartswith=orgName, deleteTransaction__isnull=True)
                        print ("? %s: %s: %s" % (orgName, value[0].stringValue, item.id))
                    else:
                        propertyList = {'_name': [{'text': orgName, 'languageCode': 'en'}]}
                        org, newValue = instancecreator.create(orgTerm, None, None, -1, propertyList, nameList, userInfo, transactionState)
                        print("+ %s: %s" % (orgName, item.id))
                
                sitesInstance = addUniqueChild(org, sitesTerm, {}, nameList, userInfo, transactionState)

                sites = getChildrenByName(sitesInstance, siteTerm, siteName)
                if len(sites):
                    siteInstance = sites[0].referenceValue
                else:
                    propertyList = {'_name': [{'text': siteName, 'languageCode': 'en'}]}
                    siteInstance, newValue = instancecreator.create(siteTerm, sitesInstance, siteTerm, -1, propertyList, nameList, userInfo, transactionState)
                    sitesInstance.cacheDescription(nameList)
           
                addressInstance = addUniqueChild(siteInstance, addressTerm,
                        {'Street': [streetName], 'City': [cityName], 'State': [stateInstance.id], 'Zip Code': [zipName]},
                        nameList, userInfo, transactionState)
                if addressInstance.transaction != transactionState.transaction:
                    addUniqueValue(addressInstance, streetTerm, streetName, userInfo, transactionState)
                    addUniqueValue(addressInstance, cityTerm, cityName, userInfo, transactionState)
                    addUniqueReferenceValue(addressInstance, stateTerm, stateInstance, transactionState)
                    addUniqueValue(addressInstance, zipTerm, zipName, userInfo, transactionState)
                addressInstance.cacheDescription(nameList)

                offeringsInstance = addUniqueChild(siteInstance, offeringsTerm, {}, nameList, userInfo, transactionState)

                print(str(siteInstance))                    
                for g in grades:
                    offerings = getChildrenByName(offeringsInstance, offeringTerm, g)
                    if len(offerings):
                        offeringInstance = offerings[0].referenceValue
                    else:
                        propertyList = {'_name': [{'text': g, 'languageCode': 'en'}]}
                        offeringInstance, newValue = instancecreator.create(offeringTerm, offeringsInstance, offeringTerm, 
                                                                            -1, propertyList, nameList, userInfo, transactionState)
                        offeringsInstance.cacheDescription(nameList)
                    
                    for service in [schoolInstance, educationInstance]:
                        services = getValueByReference(offeringInstance, serviceTerm, service)
                        if len(services) == 0:
                            position = offeringInstance.getNextElementIndex(serviceTerm)
                            offeringInstance.addReferenceValue(serviceTerm, service, position, transactionState)
                    
                    sessionsInstance = addUniqueChild(offeringInstance, sessionsTerm, {}, nameList, userInfo, transactionState)

                    sessions = getChildrenByName(sessionsInstance, sessionTerm, '2015-2016')
                    if len(sessions):
                        sessionInstance = sessions[0].referenceValue
                    else:
                        startDate = '2015-09-10' if g.startswith('Kindergarten') else '2015-09-08'
                        propertyList = {'_name': ['2015-2016'], 'Start': [startDate], 'End': ['2016-06-22']}
                        sessionInstance, newValue = instancecreator.create(sessionTerm, sessionsInstance, sessionTerm, 
                                                                            -1, propertyList, nameList, userInfo, transactionState)
                        sessionsInstance.cacheDescription(nameList)                    
                    print('    ' + str(offeringInstance))                    
