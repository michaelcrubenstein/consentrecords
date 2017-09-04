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

class Translator:
    def __init__(self, dbField):
        self.dbField = dbField
    
    def __getitem__(self, name):
        if name == 'dbField':
            return self.dbField
        elif name == 'f':
            return self.f

class StringValueTranslator(Translator):
    def __init__(self, dbField):
        super(StringValueTranslator, self).__init__(dbField)
        
    def f(self, v):
        return v.stringValue

class EnumerationTranslator(Translator):
    def __init__(self, dbField):
        super(EnumerationTranslator, self).__init__(dbField)
        
    def f(self, v):
        return str(v.referenceValue)

class IDTranslator(Translator):
    def __init__(self, dbField):
        super(IDTranslator, self).__init__(dbField)
        
    def f(self, v):
        return v.referenceValue_id.hex

class ForeignKeyTranslator(Translator):
    def __init__(self, dbField, foreignKeyType):
        super(ForeignKeyTranslator, self).__init__(dbField)
        self.foreignKeyType = foreignKeyType
        
    def f(self, v):
        return self.foreignKeyType.objects.get(pk=v.referenceValue_id)

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
    print("buildHistory", sourceType, historyType)
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
    print("buildPositionedElements", parentType, sourceType, historyType)
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
                    
            defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], uniqueTerms[t]['f'](lastValue)), uniqueTerms.keys()))
            defaults['transaction'] = firstValue.transaction
            defaults['lastTransaction'] = lastValue.transaction
            defaults['deleteTransaction'] = lastValue.deleteTransaction
            
            newItem, created = sourceType.objects.get_or_create(parent=parent, position=position,
                defaults=defaults)
            
            defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
            for t in tList[:-1]:
                if t.creation_time >= firstValue.transaction.creation_time:
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
                
                    historyType.objects.get_or_create(instance=newItem, transaction=t, position=position,
                        defaults=defaults)

def buildNameElements(instances, parentType, sourceType, historyType, uniqueTerms):
    print("buildNameElements", parentType, sourceType, historyType)
    for u in instances:
        print(u.id, u.description)
        parent = parentType.objects.get(pk=u.id)
        d = defaultdict(list)
        for v in u.value_set.filter(field__in=uniqueTerms.keys()):
            d[(v.languageCode or 'en')].append(v)
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
                if t.creation_time >= firstValue.transaction.creation_time:
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
                
                    historyType.objects.get_or_create(instance=newItem, transaction=t, languageCode=languageCode,
                        defaults=defaults)

def buildRootInstances(instances, sourceType, historyType, uniqueTerms):
    print("buildRootInstances", sourceType, historyType)
    for u in instances:
        vs = u.value_set.filter(field__in=uniqueTerms.keys())
        tList = getValueTransactions(u, vs)
        defaults={'transaction': u.transaction,
                  'lastTransaction': tList[-1],
                  'deleteTransaction': u.deleteTransaction}
        for field in uniqueTerms.keys():
            termData = uniqueTerms[field]
            v = getUniqueValue(u, field)
            defaults[termData['dbField']] = v and termData['f'](v)
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
            
            historyType.objects.get_or_create(instance=newItem, transaction=t,
                defaults=defaults)

def buildOrganizations(instances, sourceType):
    print("buildOrganizations")
    for u in instances:
        primaryAdministrator = getUniqueReference(u, 'primary administrator')
        publicAccess = getUniqueReference(u, 'public access')
        defaults={'transaction': u.transaction,
                  'deleteTransaction': u.deleteTransaction,
                  'webSite': getUniqueDatum(u, 'Web Site'),
                  'publicAccess': str(publicAccess) if publicAccess else None,
                  'primaryAdministrator': User.objects.get(pk=primaryAdministrator.id) if primaryAdministrator else None,
                 }
        newItem, created = sourceType.objects.get_or_create(id=u.id,
           defaults=defaults)
        print(newItem.id)

def buildGroups(instances, parentType, sourceType):
    print("buildGroups")
    for u in instances:
        defaults={'transaction': u.transaction,
                  'deleteTransaction': u.deleteTransaction,
                  'parent': parentType.objects.get(pk=u.parent.id)}
        newItem, created = sourceType.objects.get_or_create(id=u.id,
           defaults=defaults)

### uniqueTerms should contain those items that are unique for objects of sourceType.           
def buildChildren(instances, parentType, sourceType, historyType, uniqueTerms, parentIDF):
    print("buildChildren", parentType, sourceType, historyType)
    for u in instances:
        print(u.id, u.description)
        vs = u.value_set.filter(field__in=uniqueTerms.keys())
        tList = getValueTransactions(u, vs)
        try:
            defaults={'transaction': u.transaction,
                      'lastTransaction': tList[-1],
                      'deleteTransaction': u.deleteTransaction,
                      'parent': parentType.objects.get(pk=parentIDF(u))}
        except parentType.DoesNotExist:
            print('parent does not exist', u, parentIDF(u))
            raise
            
        for field in uniqueTerms.keys():
            termData = uniqueTerms[field]
            v = getUniqueValue(u, field)
            defaults[termData['dbField']] = v and termData['f'](v)
        newItem, created = sourceType.objects.get_or_create(id=u.id,
           defaults=defaults)
        print('',sourceType, newItem.id)
        
        defaults = dict(map(lambda t: (uniqueTerms[t]['dbField'], None), uniqueTerms.keys()))
        for t in tList[:-1]:
            for field in uniqueTerms.keys():
                termData = uniqueTerms[field]
                deletedValues = t.deletedValue.filter(field=field, instance=u)
                if deletedValues.exists():
                    defaults[termData['dbField']] = None
                    defaults['id'] = None   # Forces a new ID
                vs = t.value_set.filter(field=field, instance=u)
                if vs.exists():
                    defaults[termData['dbField']] = termData['f'](vs[0])
                    defaults['id'] = vs[0].id
            
            historyType.objects.get_or_create(instance=newItem, transaction=t,
                defaults=defaults)

def buildInquiryAccessGroups(instances, targetType):
    print("buildInquiryAccessGroups", targetType)
    for u in instances:
        newItem = targetType.objects.get(pk=u.id)
        oldReference = getUniqueReference(u, 'Inquiry Access Group')
        if oldReference:
            newItem.inquiryAccessGroup = Group.objects.get(pk=oldReference.pk)
            newItem.save()

def buildSessionCanRegister(sessions, targetType):
    print("buildSessionCanRegister", targetType)
    for u in sessions:
        newItem = targetType.objects.get(pk=u.id)
        oldReference = getUniqueReference(u, 'Inquiries')
        if oldReference:
            oldPAReference = getUniqueReference(oldReference, 'public access')
            canRegister = 'yes' if oldPAReference and str(oldPAReference) == 'register' else 'no'
            newItem.canRegister = canRegister
            newItem.save()

def buildGrants(instances):
    for u in instances:
        children = u.children.filter(typeID=terms.accessRecord)
        for i in children:
            privilege = getUniqueReferenceDescription(i, 'privilege')
            # group and user values may be associated with either groups or users fields.
            for j in i.value_set.filter(field__in=[terms['group'], terms.user]):
                gs = Group.objects.filter(pk=j.referenceValue.id)
                if gs.exists():
                    GroupGrant.objects.get_or_create(id=j.id,
                        defaults={'transaction': j.transaction,
                                  'lastTransaction': j.transaction,
                                  'deleteTransaction': j.deleteTransaction,
                                  'grantor_id': u.id,
                                  'grantee': gs[0],
                                  'privilege': privilege})
                else:
                    us = User.objects.filter(pk=j.referenceValue.id)
                    if us.exists():
                        UserGrant.objects.get_or_create(id=j.id,
                            defaults={'transaction': j.transaction,
                                      'lastTransaction': j.transaction,
                                      'deleteTransaction': j.deleteTransaction,
                                      'grantor_id': u.id,
                                      'grantee': us[0],
                                      'privilege': privilege})

def buildGrantRequests(instances, parentType, userSourceType):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        for i in u.value_set.filter(field=terms['access request']):
            # group and user values may be associated with either groups or users fields.
            us = User.objects.filter(pk=i.referenceValue.id)
            userSourceType.objects.get_or_create(id=i.id,
                defaults={'transaction': i.transaction,
                          'lastTransaction': i.transaction,
                          'deleteTransaction': i.deleteTransaction,
                          'parent': parent,
                          'grantee': us[0]})

### Build items like ServiceImplications.
### Parent is a function that returns the migrated parent of an instance.
### userSourceType is the type of object you are trying to create.
### targetType is the type of object referred in the dbField field.                        
def buildSubReferences(instances, getParentF, userSourceType, field, dbField, targetType):
    for u in instances:
        parent = getParentF(u)
        for i in u.value_set.filter(field=field):
            # group and user values may be associated with either groups or users fields.
            us = targetType.objects.filter(pk=i.referenceValue.id)
            userSourceType.objects.get_or_create(id=i.id,
                defaults={'transaction': i.transaction,
                          'lastTransaction': i.transaction,
                          'deleteTransaction': i.deleteTransaction,
                          'parent': parent,
                          dbField: us[0]})

def buildComments(instances, parentType, sourceType):
    for u in instances:
        parent = parentType.objects.get(pk=u.id)
        children = u.children.filter(typeID=terms['Comments'])
        for i in children:
            for j in i.children.filter(typeID=terms['Comment']):
                text = getUniqueDatum(j, 'text')
                request = getUniqueReference(j, 'Comment Request')
                if request:
                    question = getUniqueDatum(request, 'text')
                    asker = getUniqueReference(request, 'Path')
                else:
                    question = None
                    asker = None
                
                sourceType.objects.get_or_create(id=j.id,
                    defaults={'transaction': j.transaction,
                              'lastTransaction': j.transaction,
                              'deleteTransaction': j.deleteTransaction,
                              'parent': parent,
                              'text': text,
                              'question': question,
                              'asker': Path.objects.get(pk=asker.id) if asker else None})

if __name__ == "__main__":
    check = '-check' in sys.argv
    
    try:
        with transaction.atomic():
            users = Instance.objects.filter(typeID=terms.user)
            orgs = Instance.objects.filter(typeID=terms['Organization'])
            groups = Instance.objects.filter(typeID=terms['group'], parent__typeID=terms['Organization'])
            sites = Instance.objects.filter(typeID=terms['Site'])
            offerings = Instance.objects.filter(typeID=terms['Offering'], parent__parent__id__in=sites)
            addresses = Instance.objects.filter(typeID=terms['Address'])
            sessions = Instance.objects.filter(typeID=terms['Session'], parent__parent__id__in=offerings)
            inquiries = Instance.objects.filter(typeID=terms['Inquiries'], parent__id__in=sessions)
            enrollments = Instance.objects.filter(typeID=terms['Enrollment'], parent__parent__id__in=sessions)
            engagements = Instance.objects.filter(typeID=terms['Experience'], parent__parent__id__in=sessions)
            periods = Instance.objects.filter(typeID=terms['Period'], parent__parent__parent__parent__parent__typeID=terms['Site'])

            print("build users")
            for u in users:
                firstName = getUniqueDatum(u, 'first name')
                lastName = getUniqueDatum(u, 'last name')
                birthday = getUniqueDatum(u, 'birthday')
                publicAccess = getUniqueReference(u, 'public access')
            
                if not u.transaction_id:
                    raise RuntimeError('transaction_id is None')
                defaults = {'transaction': u.transaction,
                            'deleteTransaction': u.deleteTransaction,
                            'firstName': firstName,
                            'lastName': lastName,
                            'birthday': birthday,
                            'publicAccess': str(publicAccess),
                           }
                newUser, created = User.objects.get_or_create(pk=u.id,
                   defaults=defaults)
            
            # Set the primary administrator for all users.
			for u in users:
				try:
					primaryAdministrator = u.value_set.get(field=terms['primary administrator'],deleteTransaction__isnull=True).referenceValue
					target = User.objects.get(pk=u.id)
					target.primaryAdministrator = User.objects.get(pk=primaryAdministrator.id)
					target.save()
					print(target.firstName, target.lastName)
				except Value.DoesNotExist:
					pass
                
            # Create the user history
            uniqueTerms = {terms['first name']: {'dbField': 'firstName', 'f': lambda v: v.stringValue},
                           terms['last name']: {'dbField': 'lastName', 'f': lambda v: v.stringValue},
                           terms['birthday']: {'dbField': 'birthday', 'f': lambda v: v.stringValue},
                          }
            buildHistory(users, User, UserHistory, uniqueTerms)
        
            uniqueTerms = {terms['email']: StringValueTranslator('text')}
            buildPositionedElements(users, User, UserEmail, UserEmailHistory, uniqueTerms)
        
            orgs = Instance.objects.filter(typeID=terms['Organization'])
            buildOrganizations(orgs, Organization)
        
            uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
            buildNameElements(orgs, Organization, OrganizationName, OrganizationNameHistory, uniqueTerms)
        
            groups = Instance.objects.filter(typeID=terms['group'], parent__typeID=terms['Organization'])
            buildGroups(groups, Organization, Group)
        
            uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
            buildNameElements(groups, Group, GroupName, GroupNameHistory, uniqueTerms)
        
            buildSubReferences(groups, 
                               lambda u: Group.objects.get(pk=u.id), 
                               GroupMember, terms['user'], 'user', User)
        
            buildInquiryAccessGroups(orgs, Organization)
        
            uniqueTerms = {terms['Web Site']: {'dbField': 'webSite', 'f': lambda v: v.stringValue},
                           terms['Inquiry Access Group']: {'dbField': 'inquiryAccessGroup', 
                                                           'f': lambda v: Group.objects.get(pk=v.referenceValue.id)},
                          }
            buildHistory(orgs, Organization, OrganizationHistory, uniqueTerms)
        
            buildGrants(users)
        
            buildGrants(orgs)
        
            buildGrantRequests(users, User, UserUserGrantRequest)
        
            # Services
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
        
            buildSubReferences(services, 
                               lambda u: Service.objects.get(pk=u.id), 
                               ServiceImplication, terms['Service'], 'impliedService', Service)
        
            sites = Instance.objects.filter(typeID=terms['Site'])
            uniqueTerms = {terms['Web Site']: {'dbField': 'webSite', 'f': lambda v: v.stringValue},
                          }
            buildChildren(sites, Organization, Site, SiteHistory, uniqueTerms,
                          lambda i: i.parent.parent.id)
        
            uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
            buildNameElements(sites, Site, SiteName, SiteNameHistory, uniqueTerms)
        
            addresses = Instance.objects.filter(typeID=terms['Address'])
            uniqueTerms = {terms['City']: {'dbField': 'city', 'f': lambda v: v.stringValue},
                           terms['State']: {'dbField': 'state', 'f': lambda v: str(v.referenceValue)},
                           terms['Zip Code']: {'dbField': 'zipCode', 'f': lambda v: v.stringValue},
                          }
            buildChildren(addresses, Site, Address, AddressHistory, uniqueTerms,
                          lambda i: i.parent.id)
        
            uniqueTerms = {terms['Street']: StringValueTranslator('text')}
            buildPositionedElements(addresses, Address, Street, StreetHistory, uniqueTerms)
        
            offerings = Instance.objects.filter(typeID=terms['Offering'], parent__parent__typeID=terms['Site'])
            uniqueTerms = {terms['Web Site']: {'dbField': 'webSite', 'f': lambda v: v.stringValue},
                           terms['Minimum Age']: {'dbField': 'minimumAge', 'f': lambda v: v.stringValue},
                           terms['Maximum Age']: {'dbField': 'maximumAge', 'f': lambda v: v.stringValue},
                           terms['Minimum Grade']: {'dbField': 'minimumGrade', 'f': lambda v: v.stringValue},
                           terms['Maximum Grade']: {'dbField': 'maximumGrade', 'f': lambda v: v.stringValue},
                          }
        
            buildChildren(offerings, Site, Offering, OfferingHistory, uniqueTerms,
                          lambda i: i.parent.parent.id)
        
            uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
            buildNameElements(offerings, Offering, OfferingName, OfferingNameHistory, uniqueTerms)
        
            # ExperienceServices
            uniqueTerms = {terms['Service']: ForeignKeyTranslator('service', Service)}
            buildPositionedElements(offerings, Offering, OfferingService, OfferingServiceHistory, uniqueTerms)
        
            sessions = Instance.objects.filter(typeID=terms['Session'], parent__parent__id__in=offerings)
            uniqueTerms = {terms['Registration Deadline']: {'dbField': 'registrationDeadline', 'f': lambda v: v.stringValue},
                           terms['Start']: {'dbField': 'start', 'f': lambda v: v.stringValue},
                           terms['End']: {'dbField': 'end', 'f': lambda v: v.stringValue},
                          }
        
            buildChildren(sessions, Offering, Session, SessionHistory, uniqueTerms,
                          lambda i: i.parent.parent.id)
            buildSessionCanRegister(sessions, Session)
        
            uniqueTerms = {terms['name']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
            buildNameElements(sessions, Session, SessionName, SessionNameHistory, uniqueTerms)
        
            inquiries = Instance.objects.filter(typeID=terms['Inquiries'])
            buildSubReferences(inquiries, lambda u: Session.objects.get(pk=u.parent.id), 
                           Inquiry, terms['user'], 'user', User)
        
            enrollments = Instance.objects.filter(typeID=terms['Enrollment'])
            buildSubReferences(enrollments, lambda u: Session.objects.get(pk=u.parent.parent.id), 
                           Enrollment, terms['user'], 'user', User)
        
            engagements = Instance.objects.filter(typeID=terms['Experience'])
            uniqueTerms = {terms['Start']: {'dbField': 'start', 'f': lambda v: v.stringValue},
                           terms['End']: {'dbField': 'end', 'f': lambda v: v.stringValue},
                           terms['user']: {'dbField': 'user', 
                                           'f': lambda v: User.objects.get(pk=v.referenceValue.id)},
                          }
            buildChildren(engagements, Session, Engagement, EngagementHistory, uniqueTerms,
                          lambda i: i.parent.parent.id)
        
            periods = Instance.objects.filter(typeID=terms['Period'], parent__parent__parent__parent__parent__typeID=terms['Site'])
            uniqueTerms = {terms['Weekday']: {'dbField': 'start', 'f': lambda v: str(v.referenceValue)},
                           terms['End Time']: {'dbField': 'end', 'f': lambda v: v.stringValue},
                           terms['Start Time']: {'dbField': 'user', 'f': lambda v: v.stringValue},
                          }
            buildChildren(periods, Session, Period, PeriodHistory, uniqueTerms,
                          lambda i: i.parent.id)
        
            experiencePrompts = Instance.objects.filter(typeID=terms['Experience Prompt'])
            def findDomainService(v):
                if v.referenceValue.typeID == terms['Domain']:
                    return Service.objects.get(names__text=str(v.referenceValue))
                else:
                    return Service.objects.get(pk=v.referenceValue.id)
            uniqueTerms = {terms['name']: {'dbField': 'name', 'f': lambda v: v.stringValue},
                           terms['Organization']: {'dbField': 'organization', 
                                           'f': lambda v: Organization.objects.get(pk=v.referenceValue.id)},
                           terms['Site']: {'dbField': 'site', 
                                           'f': lambda v: Site.objects.get(pk=v.referenceValue.id)},
                           terms['Offering']: {'dbField': 'offering', 
                                           'f': lambda v: Offering.objects.get(pk=v.referenceValue.id)},
                           terms['Domain']: {'dbField': 'domain', 
                                           'f': findDomainService},
                           terms['Stage']: {'dbField': 'stage', 
                                           'f': lambda v: str(v.referenceValue)},
                           terms['Timeframe']: {'dbField': 'timeframe', 
                                           'f': lambda v: str(v.referenceValue)},
                          }
            buildRootInstances(experiencePrompts, ExperiencePrompt, ExperiencePromptHistory, uniqueTerms)
        
            buildSubReferences(experiencePrompts,
                               lambda u: ExperiencePrompt.objects.get(pk=u.id), 
                               DisqualifyingTag, terms['Disqualifying Tag'], 'service', Service)

            # Experience Prompt Services
            uniqueTerms = {terms['Service']: ForeignKeyTranslator('service', Service)}
            buildPositionedElements(experiencePrompts, ExperiencePrompt, ExperiencePromptService, ExperiencePromptServiceHistory, uniqueTerms)
        
            uniqueTerms = {terms['text']: StringValueTranslator('text')}
            buildNameElements(experiencePrompts, ExperiencePrompt, ExperiencePromptText, ExperiencePromptTextHistory, uniqueTerms)
        
            commentPrompts = Instance.objects.filter(typeID=terms['Comment Prompt'])
            uniqueTerms = {}
            buildRootInstances(commentPrompts, CommentPrompt, CommentPromptHistory, uniqueTerms)
        
            uniqueTerms = {terms['text']: {'dbField': 'text', 'f': lambda v: v.stringValue}}
            buildNameElements(commentPrompts, CommentPrompt, CommentPromptText, CommentPromptTextHistory, uniqueTerms)
        
            notifications = Instance.objects.filter(typeID=terms['Notification'])
            uniqueTerms = {terms['name']: StringValueTranslator('name'),
                           terms['is fresh']: EnumerationTranslator('isFresh'),
                          }
            buildChildren(notifications, User, Notification, NotificationHistory, uniqueTerms,
                          lambda i: i.parent.id)
        
            # Notification Arguments
            uniqueTerms = {terms['argument']: IDTranslator('argument')}
            buildPositionedElements(notifications, Notification, NotificationArgument, NotificationArgumentHistory, uniqueTerms)
        
            paths = Instance.objects.filter(typeID=terms['Path'])
            uniqueTerms = {terms['Birthday']: StringValueTranslator('birthday'),
                           terms['name']: StringValueTranslator('name'),
                           terms['special access']: EnumerationTranslator('specialAccess'),
                           terms['can be asked about experience']: EnumerationTranslator('canAnswerExperience'),
                           terms['public access']: EnumerationTranslator('publicAccess'),
                          }
            buildChildren(paths, User, Path, PathHistory, uniqueTerms, lambda i: i.parent.id)
        
            buildGrants(paths)
        
            experiences = Instance.objects.filter(typeID=terms['More Experience'])
            uniqueTerms = {terms['Organization']: ForeignKeyTranslator('organization', Organization),
                           terms['User Entered Organization']: StringValueTranslator('customOrganization'),
                           terms['Site']: ForeignKeyTranslator('site', Site),
                           terms['User Entered Site']: StringValueTranslator('customSite'),
                           terms['Offering']: ForeignKeyTranslator('offering', Offering),
                           terms['User Entered Offering']: StringValueTranslator('customOffering'),
                           terms['Start']: StringValueTranslator('start'),
                           terms['End']: StringValueTranslator('end'),
                           terms['Timeframe']: EnumerationTranslator('timeframe'),
                          }
            buildChildren(experiences, Path, Experience, ExperienceHistory, uniqueTerms, lambda i: i.parent.id)
        
            # ExperienceServices
            uniqueTerms = {terms['Service']: ForeignKeyTranslator('service', Service)}
            buildPositionedElements(experiences, Experience, ExperienceService, ExperienceServiceHistory, uniqueTerms)
        
            # ExperienceCustomServices
            uniqueTerms = {terms['User Entered Service']: StringValueTranslator('name')}
            buildPositionedElements(experiences, Experience, ExperienceCustomService, ExperienceCustomServiceHistory, uniqueTerms)
        
            buildComments(experiences, Experience, Comment)
    except Exception as e:
        print("%s" % traceback.format_exc())