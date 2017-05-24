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
    return f[0].stringValue if f.exists() else None

def getUniqueReference(i, fieldName):
    f = i.value_set.filter(field=terms[fieldName])\
            .order_by('-transaction__creation_time')
    return f[0].referenceValue if f.exists() else None

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


if __name__ == "__main__":
    check = '-check' in sys.argv

    try:
        instances = Instance.objects.filter(typeID=terms.user)
        for u in instances:
            id=u.id
            transaction = u.transaction
            deleteTransaction = u.deleteTransaction
            firstName = getUniqueDatum(u, 'first name')
            lastName = getUniqueDatum(u, 'last name')
            birthday = getUniqueDatum(u, 'birthday')
            publicAccess = getUniqueReference(u, 'public access')

            print(u.id, transaction, deleteTransaction, firstName, lastName, 
                  birthday, publicAccess)
            newUser, created = User.objects.get_or_create(id=u.id,
               defaults={'transaction': transaction,
                         'deleteTransaction': deleteTransaction,
                         'firstName': firstName,
                         'lastName': lastName,
                         'birthday': birthday,
                         'publicAccess': str(publicAccess)})
            
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
                    
                                       
    except Exception as e:
        print("%s" % traceback.format_exc())