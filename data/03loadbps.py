# python3 data/03loadbps.py 'data/BPSdump.csv' michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import sys
import csv

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo, AccessRecord, NameList
from consentrecords import pathparser
from consentrecords import instancecreator

def addUniqueChild(parent, typeID, propertyList, nameList, transactionState):
    children = parent.value_set.filter(field=typeID,
                                    deleteTransaction__isnull=True)
    if len(children):
        return children[0].referenceValue
    else:
        propertyList = {}
        item, newValue = instancecreator.create(typeID, parent, typeID, -1, propertyList, nameList, transactionState)
        return item
        
def getChildrenByName(parent, field, name):
    return parent.value_set.filter(deleteTransaction__isnull=True,
                                    field=field,
                                    referenceValue__value__deleteTransaction__isnull=True,
                                    referenceValue__value__field=Terms.name,
                                    referenceValue__value__stringValue__iexact=name)
def getValueByReference(parent, field, r):
    return parent.value_set.filter(deleteTransaction__isnull=True,
                                    field=field,
                                    referenceValue=r)

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        userInfo = UserInfo(user)
        
        orgTerm = Terms.getNamedInstance('Organization')
        sitesTerm = Terms.getNamedInstance('Sites')
        siteTerm = Terms.getNamedInstance('Site')
        addressTerm = Terms.getNamedInstance('Address')
        streetTerm = Terms.getNamedInstance('Street')
        cityTerm = Terms.getNamedInstance('City')
        stateTerm = Terms.getNamedInstance('State')
        zipTerm = Terms.getNamedInstance('Zip Code')
        offeringsTerm = Terms.getNamedInstance('Offerings')
        offeringTerm = Terms.getNamedInstance('Offering')
        serviceTerm = Terms.getNamedInstance('Service')
        sessionsTerm = Terms.getNamedInstance('Sessions')
        sessionTerm = Terms.getNamedInstance('Session')
        nameTerm = Terms.getNamedInstance('_name')
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
                statePath='_uuname[_uuname=State]>enumerator[_name='+stateName+']'
                stateInstance = pathparser.selectAllObjects(statePath, userInfo=userInfo,securityFilter=userInfo.findFilter)[0]
                
                schoolInstance = pathparser.selectAllObjects('Service[_name=School]',
                                                             userInfo=userInfo,securityFilter=userInfo.findFilter)[0]
                educationInstance = pathparser.selectAllObjects('Service[_name=Education]',
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
                        org, newValue = instancecreator.create(orgTerm, None, None, -1, propertyList, nameList, transactionState)
                        print("+ %s: %s" % (orgName, item.id))
                
                sitesInstance = addUniqueChild(org, sitesTerm, {}, nameList, transactionState)

                sites = getChildrenByName(sitesInstance, siteTerm, siteName)
                if len(sites):
                    siteInstance = sites[0].referenceValue
                else:
                    propertyList = {'_name': [{'text': siteName, 'languageCode': 'en'}]}
                    siteInstance, newValue = instancecreator.create(siteTerm, sitesInstance, siteTerm, -1, propertyList, nameList, transactionState)
                    sitesInstance.cacheDescription(nameList)
           
                addressInstance = addUniqueChild(siteInstance, addressTerm,
                        {'Street': [streetName], 'City': [cityName], 'State': [stateInstance.id], 'Zip Code': [zipName]},
                        nameList, transactionState)

                offeringsInstance = addUniqueChild(siteInstance, offeringsTerm, {}, nameList, transactionState)

                print(str(siteInstance))                    
                for g in grades:
                    offerings = getChildrenByName(offeringsInstance, offeringTerm, g)
                    if len(offerings):
                        offeringInstance = offerings[0].referenceValue
                    else:
                        propertyList = {'_name': [{'text': g, 'languageCode': 'en'}]}
                        offeringInstance, newValue = instancecreator.create(offeringTerm, offeringsInstance, offeringTerm, 
                                                                            -1, propertyList, nameList, transactionState)
                        offeringsInstance.cacheDescription(nameList)
                    
                    for service in [schoolInstance, educationInstance]:
                        services = getValueByReference(offeringInstance, serviceTerm, service)
                        if len(services) == 0:
                            maxIndex = offeringInstance.getMaxElementIndex(serviceTerm)
                            position = 0 if maxIndex == None else maxIndex + 1
                            offeringInstance.addReferenceValue(serviceTerm, service, position, transactionState)
                    
                    sessionsInstance = addUniqueChild(offeringInstance, sessionsTerm, {}, nameList, transactionState)

                    sessions = getChildrenByName(sessionsInstance, sessionTerm, '2015-2016')
                    if len(sessions):
                        sessionInstance = sessions[0].referenceValue
                    else:
                        startDate = '2015-09-10' if g.startswith('Kindergarten') else '2015-09-08'
                        propertyList = {'_name': ['2015-2016'], 'Start': [startDate], 'End': ['2016-06-22']}
                        sessionInstance, newValue = instancecreator.create(sessionTerm, sessionsInstance, sessionTerm, 
                                                                            -1, propertyList, nameList, transactionState)
                        sessionsInstance.cacheDescription(nameList)                    
                    print('    ' + str(offeringInstance))                    
