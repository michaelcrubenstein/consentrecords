# Migrate all of the data from the old data model to the new data model.
#
# python3 data/16migratedata.py

import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import re

django.setup()

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *

def getUniqueValue(i, field):
    f = i.value_set.filter(field=field)\
            .order_by('-transaction__creation_time')
    if f.exists() and ((not f[0].deleteTransaction) or (f[0].deleteTransaction == i.deleteTransaction)):
        return f[0]
    else:
        return None

def getUniqueDatum(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    if f.exists() and ((not f[0].deleteTransaction) or (f[0].deleteTransaction == i.deleteTransaction)):
        return f[0].stringValue
    else:
        return None

def getUniqueReference(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    if f.exists() and ((not f[0].deleteTransaction) or (f[0].deleteTransaction == i.deleteTransaction)):
        return f[0].referenceValue
    else:
        return None

def getUniqueReferenceDescription(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    if f.exists() and ((not f[0].deleteTransaction) or (f[0].deleteTransaction == i.deleteTransaction)):
        return str(f[0].referenceValue)
    else:
        return None
        
def getValueTransactions(instance, vs):
    deleteTransactions = frozenset(map(lambda v: v.deleteTransaction, vs))
    createTransactions = frozenset(map(lambda v: v.transaction, vs))
    tUnion = (deleteTransactions | createTransactions | frozenset([instance.transaction])) - frozenset([None, instance.deleteTransaction])
    tList = list(tUnion)
    tList.sort(key=lambda t:t.creation_time)
    return tList

### Builds history for the specified instances to the specified sourceType and historyType.
### uniqueTerms is a dictionary whose keys are terms and whose values are dictionaries with
### a dbField (database field name) and f (function to extract from the value to assign to the dbField).
def buildHistory(instances, sourceType, historyType, uniqueTerms):
    for u in instances:
        vs = u.value_set.filter(field__in=uniqueTerms.keys())
        tList = getValueTransactions(u, vs)
        
        target = sourceType.objects.get(pk=u.id)
        target.lastTransaction = tList[-1]
        target.save()
        
        defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
        for t in tList[:-1]:
            for field in uniqueTerms.keys():
                termData = uniqueTerms[field]
                if t.deletedValue.filter(field=field, instance=u).exists():
                    defaults[termData['dbField']] = None
                vs = t.value_set.filter(field=field, instance=u)
                if len(vs):
                    defaults[termData['dbField']] = termData['f'](vs[0])
            
            historyType.objects.get_or_create(instance=target, transaction=t, 
                defaults=defaults)
                
def buildPositionedElements(instances, parentType, sourceType, historyType, uniqueTerms):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        d = defaultdict(list)
        for v in u.value_set.filter(field__in=uniqueTerms.keys()):
            d[v.position].append(v)
        for position in d.keys():
            tList = getValueTransactions(u, d[position])
            vList = d[position]
            vList.sort(key=lambda v: v.transaction.creation_time)
            lastValue = vList[-1]
            firstValue = vList[0]
            newItem, created = sourceType.objects.get_or_create(parent=parent, position=position,
                defaults={'transaction': firstValue.transaction,
                          'lastTransaction': lastValue.transaction,
                          'deleteTransaction': lastValue.deleteTransaction,
                          'text': lastValue.stringValue})
            
            defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
            for t in tList[:-1]:
                for field in uniqueTerms.keys():
                    termData = uniqueTerms[field]
                    deletedValues = t.deletedValue.filter(field=field, instance=u)
                    if t.deletedValue.filter(field=field, instance=u, position=position).exists():
                        defaults[termData['dbField']] = None
                        defaults['id'] = None
                    vs = t.value_set.filter(field=field, instance=u, position=position)
                    if len(vs):
                        defaults[termData['dbField']] = termData['f'](vs[0])
                        defaults['id'] = vs[0].id
                
                print (newItem.text, t, position, defaults)
                historyType.objects.get_or_create(instance=newItem, transaction=t, position=position,
                    defaults=defaults)

def buildNameElements(instances, parentType, sourceType, historyType, uniqueTerms):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        d = defaultdict(list)
        for v in u.value_set.filter(field__in=uniqueTerms.keys()):
            d[v.languageCode].append(v)
        for languageCode in d.keys():
            # Produce a valueSet that contains values at the minimum position for this languageCode,
            # Sorted by transaction creation time.
            minPosition = reduce(lambda x, y: x if x < y else y, map(lambda v: v.position, d[languageCode]))
            vs = list(filter(lambda v: v.position == minPosition, d[languageCode]))
            vs.sort(key=lambda v: v.transaction.creation_time)
            
            tList = getValueTransactions(u, vs)
            
            lastValue = vs[-1]
            firstValue = vs[0]
            newItem, created = sourceType.objects.get_or_create(parent=parent, languageCode=languageCode,
                defaults={'transaction': firstValue.transaction,
                          'lastTransaction': lastValue.transaction,
                          'deleteTransaction': lastValue.deleteTransaction,
                          'text': lastValue.stringValue})
            
            defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
            for t in tList[:-1]:
                for field in uniqueTerms.keys():
                    termData = uniqueTerms[field]
                    
                    # Produce a valueSet that contains values at the minimum position for this languageCode,
                    vs = t.value_set.filter(field=field, instance=u, languageCode=languageCode, position=minPosition)
                    if t.deletedValue.filter(field=field, instance=u, languageCode=languageCode, position=minPosition).exists():
                        defaults[termData['dbField']] = None
                        defaults['id'] = None   # Forces a new ID
                    if len(vs):
                        defaults[termData['dbField']] = termData['f'](vs[0])
                        defaults['id'] = vs[0].id
                
                print (newItem.text, t, languageCode, defaults)
                historyType.objects.get_or_create(instance=newItem, transaction=t, languageCode=languageCode,
                    defaults=defaults)

def buildRootInstances(instances, sourceType, historyType, uniqueTerms):
    for u in instances:
        vs = u.value_set.filter(field__in=uniqueTerms.keys())
        tList = getValueTransactions(u, vs)
        defaults={'transaction': u.transaction,
                  'lastTransaction': tList[-1],
                  'deleteTransaction': u.deleteTransaction}
        for field in uniqueTerms.keys():
            termData = uniqueTerms[field]
            v = getUniqueValue(u, field)
            defaults[termData['dbField']] = v and termData['f'](getUniqueValue(u, field))
        print(u.id, defaults)
        newItem, created = sourceType.objects.get_or_create(id=u.id,
           defaults=defaults)
           
        defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
        for t in tList[:-1]:
            for field in uniqueTerms.keys():
                termData = uniqueTerms[field]
                deletedValues = t.deletedValue.filter(field=field, instance=u)
                if deletedValues.exists():
                    defaults[termData['dbField']] = None
                    defaults['id'] = None   # Forces a new ID
                vs = t.value_set.filter(field=field, instance=u)
                if len(vs):
                    defaults[termData['dbField']] = termData['f'](vs[0])
                    defaults['id'] = vs[0].id
            
            print (str(u), t, defaults)
            historyType.objects.get_or_create(instance=newItem, transaction=t,
                defaults=defaults)

def buildOrganizations(instances, sourceType):
    for u in instances:
        defaults={'transaction': u.transaction,
                  'deleteTransaction': u.deleteTransaction,
                  'webSite': getUniqueDatum(u, 'Web Site'),
                  'publicAccess': getUniqueReferenceDescription(u, 'public access')}
        print(u.id, defaults)
        newItem, created = sourceType.objects.get_or_create(id=u.id,
           defaults=defaults)

def buildGroups(instances, parentType, sourceType):
    for u in instances:
        defaults={'transaction': u.transaction,
                  'deleteTransaction': u.deleteTransaction,
                  'parent': parentType.objects.get(pk=u.parent.id)}
        print(u.id, defaults)
        newItem, created = sourceType.objects.get_or_create(id=u.id,
           defaults=defaults)
           
def buildInquiryAccessGroups(instances, targetType):
    for u in instances:
        newItem = targetType.objects.get(pk=u.id)
        oldReference = getUniqueReference(u, 'Inquiry Access Group')
        if oldReference:
            print(newItem, oldReference)
            newItem.inquiryAccessGroup = Group.objects.get(pk=oldReference.pk)
            newItem.save()

def buildAccesses(instances, parentType, userSourceType, groupSourceType):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        children = u.children.filter(typeID=terms.accessRecord)
        for i in children:
            privilege = getUniqueReferenceDescription(i, 'privilege')
            # group and user values may be associated with either groups or users fields.
            for j in i.value_set.filter(field__in=[terms['group'], terms.user]):
                gs = Group.objects.filter(pk=j.referenceValue.id)
                if gs.exists():
                    groupSourceType.objects.get_or_create(id=j.id,
                        defaults={'transaction': j.transaction,
                                  'lastTransaction': None,
                                  'deleteTransaction': j.deleteTransaction,
                                  'parent': parent,
                                  'accessee': gs[0],
                                  'privilege': privilege})
                else:
                    us = User.objects.filter(pk=j.referenceValue.id)
                    if us.exists():
                        userSourceType.objects.get_or_create(id=j.id,
                            defaults={'transaction': j.transaction,
                                      'lastTransaction': None,
                                      'deleteTransaction': j.deleteTransaction,
                                      'parent': parent,
                                      'accessee': us[0],
                                      'privilege': privilege})
                          
def buildAccessRequests(instances, parentType, userSourceType):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        for i in u.value_set.filter(field=terms['access request']):
            # group and user values may be associated with either groups or users fields.
            us = User.objects.filter(pk=i.referenceValue.id)
            userSourceType.objects.get_or_create(id=i.id,
                defaults={'transaction': i.transaction,
                          'lastTransaction': None,
                          'deleteTransaction': i.deleteTransaction,
                          'parent': parent,
                          'accessee': us[0]})
                          
if __name__ == "__main__":
    check = '-check' in sys.argv

    try:
        users = Instance.objects.filter(typeID=terms.user)
        for u in users:
            firstName = getUniqueDatum(u, 'first name')
            lastName = getUniqueDatum(u, 'last name')
            birthday = getUniqueDatum(u, 'birthday')
            publicAccess = getUniqueReference(u, 'public access')

            print(u.id, transaction, deleteTransaction, firstName, lastName, 
                  birthday, publicAccess)
            newUser, created = User.objects.get_or_create(id=u.id,
               defaults={'transaction': u.transaction,
                         'deleteTransaction': u.deleteTransaction,
                         'firstName': getUniqueDatum(u, 'first name'),
                         'lastName': getUniqueDatum(u, 'last name'),
                         'birthday': getUniqueDatum(u, 'birthday'),
                         'publicAccess': getUniqueReferenceDescription(u, 'public access')})
            
        # Fill in the primary administrators, now that the users have been created.
        for u in users:
            id=u.id
            primaryAdministrator = getUniqueReference(u, 'primary administrator')
            if primaryAdministrator:
                target = User.objects.get(pk=u.id)
                target.primaryAdministrator_id=primaryAdministrator.id
                target.save()
        
        # Create the user history
        uniqueTerms = {terms['first name']: {'dbField': 'firstName', 'f': lambda v: v.stringValue},
                       terms['last name']: {'dbField': 'lastName', 'f': lambda v: v.stringValue},
                       terms['birthday']: {'dbField': 'birthday', 'f': lambda v: v.stringValue},
                       terms['public access']: {'dbField': 'publicAccess', 'f': lambda v: str(v.referenceValue)},
                       terms['primary administrator']: 
                           {'dbField': 'primaryAdministrator', 'f': lambda v: User.objects.get(pk=v.referenceValue.id)},
                      }
        buildHistory(users, User, UserHistory, uniqueTerms)
        
        uniqueTerms = {terms['email']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildPositionedElements(users, User, UserEmail, UserEmailHistory, uniqueTerms)
        
        orgs = Instance.objects.filter(typeID=terms['Organization'])
        buildOrganizations(orgs, Organization)

        uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(orgs, Organization, OrganizationName, OrganizationNameHistory, uniqueTerms)
        
        groups = Instance.objects.filter(typeID=terms['group'], parent__typeID=terms['Organization'])
        buildGroups(groups, Organization, Group)
        
        uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(groups, Group, GroupName, GroupNameHistory, uniqueTerms)
        
        buildInquiryAccessGroups(orgs, Organization)
        
        uniqueTerms = {terms['Web Site']: {'dbField': 'webSite', 'f': lambda v: v.stringValue},
                       terms['public access']: {'dbField': 'publicAccess', 'f': lambda v: str(v.referenceValue)},
                       terms['Inquiry Access Group']: {'dbField': 'inquiryAccessGroup', 
                                                       'f': lambda v: Group.objects.get(pk=v.referenceValue.id)},
                      }
        buildHistory(orgs, Organization, OrganizationHistory, uniqueTerms)
        
        buildAccesses(users, User, UserUserAccess, UserGroupAccess)
        
        buildAccesses(orgs, Organization, OrganizationUserAccess, OrganizationGroupAccess)
        
        buildAccessRequests(users, User, UserUserAccessRequest)
        
        uniqueTerms = {terms['Stage']: {'dbField': 'stage', 'f': lambda v: str(v.referenceValue)}}
        services = Instance.objects.filter(typeID=terms['Service'])
        buildRootInstances(services, Service, ServiceHistory, uniqueTerms)

        uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(services, Service, ServiceName, ServiceNameHistory, uniqueTerms)

        uniqueTerms = {terms['Organization Label']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(services, Service, ServiceOrganizationLabel, ServiceOrganizationLabelHistory, uniqueTerms)
        
        uniqueTerms = {terms['Site Label']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(services, Service, ServiceSiteLabel, ServiceSiteLabelHistory, uniqueTerms)
        
        uniqueTerms = {terms['Offering Label']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(services, Service, ServiceOfferingLabel, ServiceOfferingLabelHistory, uniqueTerms)
        
    except Exception as e:
        print("%s" % traceback.format_exc())