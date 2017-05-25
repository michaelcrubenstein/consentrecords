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

def getUniqueDatum(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    if f.exists() and (not f[0].deleteTransaction or f[0].deleteTransaction == i.deleteTransaction):
        return f[0].stringValue
    else:
        return None

def getUniqueReference(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    if f.exists() and (not f[0].deleteTransaction and not f[0].deleteTransaction == i.deleteTransaction):
        return f[0].referenceValue
    else:
        return None

def getUniqueReferenceDescription(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    if f.exists() and (not f[0].deleteTransaction or f[0].deleteTransaction == i.deleteTransaction):
        return str(f[0].referenceValue)
    else:
        return None

### Builds history for the specified instances to the specified sourceType and historyType.
### uniqueTerms is a dictionary whose keys are terms and whose values are dictionaries with
### a dbField (database field name) and f (function to extract from the value to assign to the dbField).
def buildHistory(instances, sourceType, historyType, uniqueTerms):
    for u in instances:
        vs = u.value_set.filter(field__in=uniqueTerms.keys())
        deleteTransactions = frozenset(map(lambda v: v.deleteTransaction, vs))
        createTransactions = frozenset(map(lambda v: v.transaction, vs))
        tUnion = (deleteTransactions | createTransactions | frozenset([u.transaction])) - frozenset([u.deleteTransaction])
        tList = list(tUnion)
        tList.sort(key=lambda t:t.creation_time)
        
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
            deleteTransactions = frozenset(map(lambda v: v.deleteTransaction, d[position]))
            createTransactions = frozenset(map(lambda v: v.transaction, d[position]))
            tUnion = (deleteTransactions | createTransactions | frozenset([u.transaction])) - frozenset([u.deleteTransaction])
            tList = list(tUnion)
            tList.sort(key=lambda t:t.creation_time)
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
            deleteTransactions = frozenset(map(lambda v: v.deleteTransaction, d[languageCode]))
            createTransactions = frozenset(map(lambda v: v.transaction, d[languageCode]))
            tUnion = (deleteTransactions | createTransactions | frozenset([u.transaction])) - frozenset([u.deleteTransaction])
            tList = list(tUnion)
            tList.sort(key=lambda t:t.creation_time)
            vList = d[languageCode]
            vList.sort(key=lambda v: v.transaction.creation_time)
            lastValue = vList[-1]
            firstValue = vList[0]
            newItem, created = sourceType.objects.get_or_create(parent=parent, languageCode=languageCode,
                defaults={'transaction': firstValue.transaction,
                          'lastTransaction': lastValue.transaction,
                          'deleteTransaction': lastValue.deleteTransaction,
                          'text': lastValue.stringValue})
            
            defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
            for t in tList[:-1]:
                for field in uniqueTerms.keys():
                    termData = uniqueTerms[field]
                    deletedValues = t.deletedValue.filter(field=field, instance=u)
                    if t.deletedValue.filter(field=field, instance=u, languageCode=languageCode).exists():
                        defaults[termData['dbField']] = None
                        defaults['id'] = None   # Forces a new ID
                    vs = t.value_set.filter(field=field, instance=u, languageCode=languageCode)
                    if len(vs):
                        defaults[termData['dbField']] = termData['f'](vs[0])
                        defaults['id'] = vs[0].id
                
                print (newItem.text, t, languageCode, defaults)
                historyType.objects.get_or_create(instance=newItem, transaction=t, languageCode=languageCode,
                    defaults=defaults)

def buildUserAccesses(instances, parentType, userSourceType, groupSourceType):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        children = u.children.filter(typeID=accessRecord)
        for i in children:
            privilege = str(getUniqueReference(i, terms['privilege']))
            for j in i.value_set(field=terms.user):
                userSourceType.objects.get_or_create(id=j.id,
                    defaults={'transaction': j.transaction,
                              'lastTransaction': None,
                              'deleteTransaction': j.deleteTransaction,
                              'parent': parent,
                              'accessee': User.objects.get(pk=j.referenceValue.id),
                              'privilege': privilege}
            for j in i.value_set(field=terms['group']):
                groupSourceType.objects.get_or_create(id=j.id,
                    defaults={'transaction': j.transaction,
                              'lastTransaction': None,
                              'deleteTransaction': j.deleteTransaction,
                              'parent': parent,
                              'accessee': Group.objects.get(pk=j.referenceValue.id),
                              'privilege': privilege}
                          
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

if __name__ == "__main__":
    check = '-check' in sys.argv

    try:
        instances = Instance.objects.filter(typeID=terms.user)
        for u in instances:
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
        for u in instances:
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
        buildHistory(instances, User, UserHistory, uniqueTerms)
        
        uniqueTerms = {terms['email']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildPositionedElements(instances, User, UserEmail, UserEmailHistory, uniqueTerms)
        
        orgs = Instance.objects.filter(typeID=terms['Organization'])
        buildOrganizations(orgs, Organization)

        uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(orgs, Organization, OrganizationName, OrganizationNameHistory, uniqueTerms)
        
        groups = Instance.objects.filter(typeID=terms['group'], parent__typeID=terms['Organization'])
        buildGroups(groups, Organization, Group)
        
        uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
        buildNameElements(groups, Group, GroupName, GroupNameHistory, uniqueTerms)
        
    except Exception as e:
        print("%s" % traceback.format_exc())