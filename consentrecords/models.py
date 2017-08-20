from django.contrib.auth.models import AnonymousUser
from django.db import connection
from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import PermissionDenied

import datetime
import numbers
import uuid
import logging
import re
import string
from multiprocessing import Lock
from functools import reduce
import itertools
from collections import defaultdict

from custom_user.models import AuthUser
from custom_user.emailer import Emailer
from parse.cssparser import parser as cssparser

_currentChildQ = Q(deleteTransaction__isnull=True)|Q(deleteTransaction=F('parent__deleteTransaction'))

# Returns a list containing the first argument. If t is None, then it is an empty list.
def forceToList(t):
    return [] if t is None else \
         t if isinstance(t, list) else \
         list(t) if isinstance(t, map) else \
         [t]

# Returns a list that concatenates the two arguments, converting each to a list as necessary.
def combineTerms(t1, t2):
    return forceToList(t1) + forceToList(t2)
    
def isUUID(s):
    return re.search('^[a-fA-F0-9]{32}$', s)
    
def _isEmail(s):
    return re.search('^\S+@\S+\.\S\S+$', s)
    
def _orNone(data, key):
    return data[key] if key in data else None
    
def _orNoneForeignKey(data, key, context, resultClass, thisQS=None, thisQSType=None):
    if key not in data:
        return None
    else:
        path = data[key]
        if not path:
            return None
        tokens = cssparser.tokenizeHTML(path)
        if thisQS and tokens[0] == 'this':
            qs, tokens, qsType, accessType = _parse(thisQS, tokens[1:], context.user, thisQSType, None)
        else:
            qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
        qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
        qs2 = qs2.distinct()
        count = len(qs2)
        if count == 0:
            raise ValueError('the path does not yield any items: %s' % path)
        elif count > 1:
            raise ValueError('the path does not yield a single item: %s' % path)
        else:
            return qs2[0]

def _getForeignKey(path, context, resultClass):
    if not path:
        return None
    tokens = cssparser.tokenizeHTML(path)
    qs, tokens, qsType, accessType = RootInstance.parse(tokens, context.user)
    qs2, accessType = resultClass.getSubClause(qs, context.user, accessType)
    qs2 = qs2.distinct()
    count = len(qs2)
    if count == 0:
        raise ValueError('the path does not yield any items: %s' % path)
    elif count > 1:
        raise ValueError('the path does not yield a single item: %s' % path)
    else:
        return qs2[0]
                
def _newPosition(objects, data, key):
    qs = objects.filter(deleteTransaction__isnull=True).order_by('position')
    if key in data:
        position = int(data[key])
        if position >= qs.count():
            return qs.count()
        else:
            savedPosition = qs[position].position
            if position > 0 and qs[position - 1].position < savedPosition - 1:
                return savedPosition - 1
            else:
                startPosition = savedPosition
                for i in range(position, qs.count()):
                    if qs[i].position > startPosition + i - position:
                        break
                    else:
                        qs[i].position = startPosition + i - position + 1
                        qs[i].save()
                return startPosition
    elif qs.count():
        return qs.reverse()[0].position + 1
    else:
        return 0
            
def _validateDate(data, key):
    if key not in data or not data[key]:
        return
    s = data[key]
    
    if re.search('^[0-9]{4}-[0-1][0-9]-[0-3][0-9]$', s):
        if int(s[5:7]) <= 12 and int(s[8:10]) <= 31:
            return
    elif re.search('^[0-9]{4}-[0-1][0-9]$', s):
        if int(s[5:7]) <= 12:
            return
    
    raise ValueError('Invalid date string: %s' % s)
        
def _validateEnumeration(data, key, validValues):
    if key not in data or not data[key] or data[key] in validValues:
        return
    else:
        raise ValueError('the value "%s" is not a valid value. Valid values for "%s" are: %s' % (value, key, validValues))

def idField():
    return dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
def createTransactionField(relatedName):
    return dbmodels.ForeignKey(Transaction, related_name=relatedName, db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    
def lastTransactionField(relatedName):
    return dbmodels.ForeignKey(Transaction, related_name=relatedName, db_index=True, null=True, on_delete=dbmodels.CASCADE)

def deleteTransactionField(relatedName):
    return dbmodels.ForeignKey(Transaction, related_name=relatedName, db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

def parentField(otherModel, relatedName):
    return dbmodels.ForeignKey(otherModel, related_name=relatedName, db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    
def historyInstanceField(otherModel):
    return dbmodels.ForeignKey(otherModel, related_name='history', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
        
def getFieldQ(field, symbol, testValue):
    if symbol == '^=':
        return Q((field + '__istartswith', testValue))
    elif symbol == '=':
        return Q((field + '__iexact', testValue))
    elif symbol == '*=':
        return Q((field + '__iregex', '[[:<:]]' + testValue))
    elif symbol == '<':
        return Q((field + '__lt', testValue))
    elif symbol == '<=':
        return Q((field + '__lte', testValue))
    elif symbol == '>':
        return Q((field + '__gt', testValue))
    elif symbol == '>=':
        return Q((field + '__gte', testValue))
    elif symbol == '~<':
        return ~Q((field + '__lt', testValue))
    elif symbol == '~<=':
        return ~Q((field + '__lte', testValue))
    elif symbol == '~>':
        return ~Q((field + '__gt', testValue))
    elif symbol == '~>=':
        return ~Q((field + '__gte', testValue))
    else:
        raise ValueError("unrecognized symbol: %s"%symbol)

def _subElementQuerySet(tokens, user, subType, accessType):
    # print(str(datetime.datetime.now()), "_subElementQuerySet", tokens, subType, accessType)
    c = _filterQ(tokens, user, subType, accessType, prefix='')
    return subType.objects.filter(c, deleteTransaction__isnull=True)

def _filterOrTokens(tokens):
    orList = []
    currentTokens = []
    for t in tokens:
        if t == '|':
            orList.append(currentTokens)
            currentTokens = []
        else:
            currentTokens.append(t)
    if len(currentTokens):
        orList.append(currentTokens)
    return orList
    
# Return a Q clause according to the specified params.
# If the parameter list is a single item:
#     If there is a list, then the object must contain a value with the specified field type.
#     If there is a question mark, then this is a no-op.
#     If there is a single term name, then each instance must contain a value of that term.
# If the parameter list is three or more items and the second item is a '>',
#     then tighten the filter of the result set for only those fields that are references to objects
#     that match params[2:]. For example:
#     /api/Offering[Service>Domain>%22Service%20Domain%22[_name=Sports]]
# If the parameter list is three or more items and the second item is a '[',
#     then tighten the filter of the result set for only those fields that are references to objects
#     that match the clause in params[2] and any following clauses. For example: 
#     /api/Service[Domain[%22Service%20Domain%22[_name=Sports]][_name^=B]
# If the parameter list is three values, interpret the three values as a query clause and
#     filter self on that clause.  
def _filterClause(tokens, user, qsType, accessType, prefix=''):
    # print(str(datetime.datetime.now()), '_filterClause: %s, %s' % (tokens, prefix))
    fieldName = tokens[0]
    if fieldName in qsType.fieldMap:
        prefix += qsType.fieldMap[fieldName]
        if len(tokens) == 1:
            return Q((prefix + '__isnull', False))
        else:
            return getFieldQ(prefix, tokens[1], tokens[2])
    elif fieldName in qsType.elementMap:
        prefix = prefix + qsType.elementMap[fieldName][0]
        if len(tokens) == 1:
            return Q((prefix + 'isnull', False), (prefix + 'deleteTransaction__isnull', True))
        else:
            subType = eval(qsType.elementMap[fieldName][1])
            
            if tokens[1] == '>':
                subQ = _filterClause(tokens[2:], user, subType, accessType, prefix=prefix)
                if 'deleteTransaction' in subType.__dict__:
                    return subQ & Q((prefix + 'deleteTransaction__isnull', True))
                else:
                    return subQ
            elif tokens[1] == '[':
                q = Q((prefix + 'in', _subElementQuerySet(tokens[2], user, subType, accessType)))
                i = 3
                while i < len(tokens) - 2 and tokens[i] == '|' and tokens[i+1] == '[':
                    q = q | Q((prefix + 'in', _subElementQuerySet(tokens[i+2], user, subType, accessType)))
                    i += 3
                return q
            elif tokens[1] == '=':
                return Q((prefix+'pk', tokens[2]))
            else:
                raise ValueError("unrecognized path contents after element '%s' within [] for %s" % (tokens[0], "".join(tokens)))
    elif fieldName == 'user grant':
        # This special case handles grant targets for items.
        subType = UserGrant
        if tokens[1] == '>':
            return Q((prefix + 'id__in', 
                      UserGrant.objects.filter(\
                         _filterClause(tokens[2:], user, subType, accessType, prefix='')).values('grantor_id')))
        else:
            raise ValueError("unrecognized path contents after element '%s' within [] for %s" % (tokens[0], "".join(tokens)))
    elif fieldName == 'group grant':
        # This special case handles grant targets for items.
        subType = GroupGrant
        if tokens[1] == '>':
            return Q((prefix + 'id__in', 
                      GroupGrant.objects.filter(\
                         _filterClause(tokens[2:], user, subType, accessType, prefix='')).values('grantor_id')))
        else:
            raise ValueError("unrecognized path contents after element '%s' within [] for %s" % (tokens[0], "".join(tokens)))
    else:
        raise ValueError("unrecognized path contents within [] for %s (expecting one of (%s))" % ("".join(tokens), ", ".join(qsType.elementMap.keys())))

### Access type is the type, if any, that the qs has already been filtered.
def _subTypeParse(qs, tokens, user, qsType, accessType, elementMap):
    # print(str(datetime.datetime.now()), '_subTypeParse: %s, %s, %s, %s' % (qsType, tokens, accessType, elementMap))
    if isUUID(tokens[1]):
        return _parse(qs.filter(pk=tokens[1]), tokens[2:], user, qsType, accessType)
    elif tokens[1] in elementMap:
        e = elementMap[tokens[1]]
        subType = eval(e[1])
        inClause = e[2] + '__in'
        elementClause, newAccessType = qsType.getSubClause(qs, user, accessType)
        return _parse(subType.objects.filter(Q((inClause, elementClause)),
                                             deleteTransaction__isnull=True), 
                      tokens[2:], user, subType, newAccessType)
    elif tokens[1] == 'user grant':
        subType = UserGrant
        inClause = 'grantor_id__in'
        elementClause, newAccessType = qsType.getSubClause(qs, user, accessType)
        return _parse(subType.objects.filter(Q((inClause, elementClause))), 
                      tokens[2:], user, subType, None)
    elif tokens[1] == 'group grant':
        subType = GroupGrant
        inClause = 'grantor_id__in'
        elementClause, newAccessType = qsType.getSubClause(qs, user, accessType)
        return _parse(subType.objects.filter(Q((inClause, elementClause))), 
                      tokens[2:], user, subType, None)
    else:
        raise ValueError("unrecognized path from %s: %s" % (qsType, tokens))    

def _filterQ(tokens, user, qsType, accessType, prefix=''):
    qList = map(lambda ts: _filterClause(ts, user, qsType, accessType, prefix),
                _filterOrTokens(tokens))
    def mergeQs(a, b):
        if a:
            return a | b
        else:
            return b
            
    return reduce(mergeQs, qList, None)
    
def _parse(qs, tokens, user, qsType, accessType):
    # print(str(datetime.datetime.now()), '_parse: %s, %s' % (qsType, tokens))
    if len(tokens) == 0:
        return qs, tokens, qsType, accessType
    elif isUUID(tokens[0]):
        return _parse(qs.filter(pk=tokens[0]), tokens[1:], user, qsType, accessType)
    elif tokens[0] == '[':
        q = _filterQ(tokens[1], user, qsType, accessType, prefix='')
        i = 2
        while i < len(tokens) - 2 and tokens[i] == '|' and tokens[i+1] == '[':
            q = q | _filterQ(tokens[i+2], user, qsType, accessType, prefix='')
            i += 3
        return _parse(qs.filter(q), tokens[i:], user, qsType, accessType)
    elif tokens[0] == '/':
        return _subTypeParse(qs, tokens, user, qsType, accessType, qsType.elementMap)
    elif tokens[0] == ':':
        pass
    else:
        raise ValueError("unrecognized path from %s: %s" % (qsType, tokens))

class Transaction(dbmodels.Model):
    id = idField()
    user = dbmodels.ForeignKey('custom_user.AuthUser', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    creation_time = dbmodels.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)
    
    def __str__(self):
        return str(self.creation_time)
    
    def createTransaction(user):
        if not user.is_authenticated:
            raise RuntimeError('current user is not authenticated')
        if not user.is_active:
            raise RuntimeError('current user is not active')
        return Transaction.objects.create(user=user)
        
class TransactionState:
    mutex = Lock()

    # The user is an instance of AuthUser    
    def __init__(self, user):
        self.currentTransaction = None
        self.user = user
            
    @property    
    def transaction(self):
        if self.currentTransaction == None:
            self.currentTransaction = Transaction.createTransaction(self.user)

        return self.currentTransaction

class _deferred():
    def __init__(self, f):
        self._value = None
        self._isCached = False
        self._f = f
        
    @property
    def value(self):
        if not self._isCached:
            self._value = self._f()
            self._isCached = True
        return self._value

### The interface shared by all types of instances.        
class IInstance():
    def reducePrivileges(f, publicAccess):
        # map the access records to their corresponding privilege values.              
        p = map(lambda i: i['privilege'], f)

        def comparePrivileges(a, b):
            if a == b:
                return a
            elif not a:
                return b
            
            privileges = ["find", "read", "register", "write", "administer"]
                  
            aIndex = privileges.index(a)
            return b if b in privileges[(aIndex+1):] else a

        return reduce(comparePrivileges, p, publicAccess)
        
    def getName(querySet, languageCode=None):
        enName = None
        noneName = None
        for v in querySet:
            if languageCode == v.languageCode:
                return v.text or ''
            elif v.languageCode == 'en':
                enName = v.text
            elif not v.languageCode:
                noneName = v.text
        return noneName or enName or ''
    
    def markDeleted(self, context):
        if self.deleteTransaction_id:
            raise RuntimeError('%s is already deleted' % str(self))
        if not context.canWrite(self):
            raise PermissionDenied('you do not have sufficient write privileges for this operation')
        self.deleteTransaction = context.transaction
        self.save()
    
    def createChildren(self, data, key, context, subClass, newIDs={}):
        if key in data:
            if not isinstance(data[key], list):
                raise ValueError('%s element of data is not a list: %s' % (key, data[key]))
            for subData in data[key]:
                subItem = subClass.create(self, subData, context, newIDs=newIDs)
                if 'add' in subData:
                    newIDs[subData['add']] = subItem.id.hex
    
    def updateChildren(self, changes, key, context, subClass, children, newIDs={}):
        if key in changes:
            if not isinstance(changes[key], list):
                raise ValueError('%s element of changes is not a list: %s' % (key, changes[key]))
            for subChanges in changes[key]:
                if 'delete' in subChanges:
                    subItem = children.get(pk=subChanges['delete'])
                    subItem.markDeleted(context)
                elif 'id' in subChanges:
                    subItem = children.get(pk=subChanges['id'])
                    subItem.update(subChanges, context, newIDs)
                elif 'add' in subChanges:
                    subItem = subClass.create(self, subChanges, context, newIDs=newIDs)
                    newIDs[subChanges['add']] = subItem.id.hex
                else:
                    raise ValueError('subChange has no action key (delete, id or add): %s' % subChanges) 
    
    @property
    def currentNamesQuerySet(self):
        return self.currentNames if 'currentNames' in self.__dict__ else self.names.filter(_currentChildQ)

    def description(self, languageCode=None):
        return IInstance.getName(self.currentNamesQuerySet, languageCode)
    
    def order_by(queryset, context):
        return queryset
        
    def getData(self, fields, context):
        data = self.headData(context)
        if 'names' in self.__dict__:
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
        return data
        
### An Instance that has no parent
class RootInstance(IInstance):
    def headData(self, context):
        data = {'id': self.id.hex, 
                'description': self.description(context.languageCode), 
               }
        privilege = context.getPrivilege(self)
        if privilege:
            data['privilege'] = privilege
        return data
               
    def fetchPrivilege(self, user):
        return "read"
    
    @property    
    def privilegeSource(self):
        return self
        
    def parse(tokens, user):
        d = {'address': Address,
             'comment': Comment,
             'comment prompt': CommentPrompt,
             'comment prompt translation': CommentPromptText,
             'disqualifying tag': DisqualifyingTag,
             'engagement': Engagement,
             'enrollment': Enrollment,
             'experience': Experience,
             'experience custom service': ExperienceCustomService,
             'experience service': ExperienceService,
             'experience prompt': ExperiencePrompt,
             'experience prompt service': ExperiencePromptService,
             'experience prompt translation': ExperiencePromptText,
             'group': Group,
             'group grant': GroupGrant,
             'group name': GroupName,
             'group member': GroupMember,
             'inquiry': Inquiry,
             'notification': Notification,
             'notification argument': NotificationArgument,
             'offering': Offering,
             'offering name': OfferingName,
             'offering service': OfferingService,
             'organization': Organization,
             'organization name': OrganizationName,
             'path': Path,
             'period': Period,
             'service': Service,
             'service name': ServiceName,
             'service organization label': ServiceOrganizationLabel,
             'service site label': ServiceSiteLabel,
             'service offering label': ServiceOfferingLabel,
             'service implication': ServiceImplication,
             'session': Session,
             'session name': SessionName,
             'site': Site,
             'site name': SiteName,
             'street': Street,
             'user': User,
             'user email': UserEmail,
             'user grant': UserGrant,
             'user user grant request': UserUserGrantRequest,
            }
        if tokens[0] in d:
            qsType = d[tokens[0]]
            return _parse(qsType.objects.filter(deleteTransaction__isnull=True), tokens[1:], user, qsType, None)
        else:
            raise ValueError("unrecognized root token: %s" % tokens[0])
    
    def parseUpdateData(subChanges, subClass, context, newIDs):
        if 'delete' in subChanges:
            subItem = subClass.objects.get(pk=subChanges['delete'])
            subItem.markDeleted(context)
        elif 'id' in subChanges:
            subItem = subClass.objects.get(pk=subChanges['id'])
            subItem.update(subChanges, context, newIDs)
        elif 'add' in subChanges:
            subItem = subClass.create(subChanges, context, newIDs=newIDs)
            newIDs[subChanges['add']] = subItem.id.hex
        else:
            raise ValueError('subChange has no action key (delete, id or add): %s' % subChanges) 

# An instance that is a secure root: User and Organization
class SecureRootInstance(RootInstance):

    @property
    def userGrants(self):
        return UserGrant.objects.filter(deleteTransaction__isnull=True, grantor_id=self.id)
        
    @property
    def groupGrants(self):
        return GroupGrant.objects.filter(deleteTransaction__isnull=True, grantor_id=self.id)
        
    def getData(self, fields, context):
        data = super(SecureRootInstance, self).getData(fields, context)

        if context.getPrivilege(self) == 'administer':
            if self.publicAccess:
                data['public access'] = self.publicAccess
            if self.primaryAdministrator:
                data['primary administrator'] = self.primaryAdministrator.headData(context)
            if 'user grants' in fields:
                data['user grants'] = [i.getData([], context) for i in \
                                       UserGrant.order_by(self.userGrants, context)]
            if 'group grants' in fields:
                data['group grants'] = [i.getData([], context) for i in \
                                        GroupGrant.order_by(self.groupGrants, context)]

        return data
    
    def markDeleted(self, context):
        for i in self.userGrants:
            i.markDeleted(context)
        for i in self.groupGrants:
            i.markDeleted(context)
        super(SecureRootInstance, self).markDeleted(context)

    def valueCheckPublicAccess(data, key):
        validValues = ['find', 'read']
        _validateEnumeration(data, key, validValues)
    
    def valueCheckPrimaryAdministrator(newValue):
        pass
        
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousFindFilter(prefix=''):
        return Q(((prefix + '__publicAccess__in') if prefix else 'publicAccess__in',
                  ['find', 'read']))
        
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousReadFilter(prefix=''):
        return Q(((prefix + '__publicAccess') if prefix else 'publicAccess',
                  'read'))

    # returns a querySet that enumerates the grantor_ids for grants
    # for the specified user to have one of the specified privileges.
    def grantorIDs(user, privileges):
        return UserGrant.objects.filter(\
                privilege__in=privileges,
                deleteTransaction__isnull=True,
                grantee=user,
            ).values('grantor_id').union(\
            GroupGrant.objects.filter(\
                privilege__in=privileges,
                deleteTransaction__isnull=True,
                grantee__deleteTransaction__isnull=True,
                grantee__members__user=user,
                grantee__members__deleteTransaction__isnull=True,
            ).values('grantor_id'))
    
    def privilegedQuerySet(qs, user, prefix, privileges):  
        if prefix: prefix += '__'
        publicAccessClause = prefix + 'publicAccess__in'
        primaryAdministratorClause = prefix + 'primaryAdministrator'
        inClause = prefix + 'id__in'
        grantClause = SecureRootInstance.grantorIDs(user, privileges)
        qClause = Q((publicAccessClause, privileges))|\
                  Q((primaryAdministratorClause, user))|\
                  Q((inClause, grantClause))
        return qs.filter(qClause)
    
    def findableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.filter(SecureRootInstance.anonymousFindFilter(prefix))
        elif user.is_administrator:
            return qs
        else:
            return SecureRootInstance.privilegedQuerySet(qs, user, prefix, 
                        ['find', 'read', 'register', 'write', 'administer'])

    def readableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.filter(SecureRootInstance.anonymousReadFilter(prefix))
        elif user.is_administrator:
            return qs
        else:
            return SecureRootInstance.privilegedQuerySet(qs, user, prefix, 
                        ['read', 'write', 'administer'])

    def administrableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.none()
        elif user.is_administrator:
            return qs
        else:
            return SecureRootInstance.privilegedQuerySet(qs, user, prefix, 
                        ['administer'])

    def fetchPrivilege(self, user):
        if not user:
            return self.publicAccess
        elif self.primaryAdministrator_id == user.id:
            return 'administer'
        else:
            f = self.userGrants.filter(grantee=user, deleteTransaction__isnull=True).values('privilege')\
                .union(self.groupGrants.filter(grantee__members__user=user, deleteTransaction__isnull=True,
                                               grantee__deleteTransaction__isnull=True,
                                               grantee__members__deleteTransaction__isnull=True).values('privilege'))
            return IInstance.reducePrivileges(f, self.publicAccess)
        
### An Instance that has a parent
class ChildInstance(IInstance):
    def headData(self, context):
        data = {'id': self.id.hex, 
                'description': self.description(context.languageCode), 
                'parentID': self.parent_id.hex, 
               }
        privilege = context.getPrivilege(self.parent)
        if privilege:
            data['privilege'] = privilege
        return data
        
    @property    
    def privilegeSource(self):
        return self.parent.privilegeSource
        
### An Instance that is a name and a language code
class TranslationInstance(ChildInstance):
    def description(self, languageCode=None):
        return self.text
    
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        return querySet
        
    def headData(self, context):
        data = super(TranslationInstance, self).headData(context)
        data['text'] = self.text
        if self.languageCode:
            data['languageCode'] = self.languageCode
        return data
               
    def getData(self, fields, context):
        return self.headData(context)
    
    def ValueCheckLanguageCode(self, value):
        validValues = ['en', 'sp', 'zh']
        if not value or value in validValues:
            return
        else:
            raise ValueError('the value "%s" is not a valid language. Valid languages are are: %s' % (value, validValues))
    
    def ValueCheckText(self, value):
        return
    
    def order_by(queryset, context):
        return queryset.order_by('languageCode', 'text')
                
    def buildHistory(self, context):
        return self.historyType.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             text=self.text,
                                             languageCode=self.languageCode)
        
    def revert(self, h):
        self.text = h.text 
        self.languageCode = h.languageCode 

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'text' in changes and changes['text'] != self.text:
            self.ValueCheckText(changes['text'])
            history = history or self.buildHistory(context)
            self.text = changes['text'] or None
        if 'languageCode' in changes and changes['languageCode'] != self.languageCode:
            self.ValueCheckLanguageCode(changes['languageCode'])
            history = history or self.buildHistory(context)
            self.languageCode = changes['languageCode'] or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
    def create(objects, parent, data, context, newIDs={}):
        if not context.canWrite(parent):
            raise PermissionError
            
        newItem = objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 text=_orNone(data, 'text'),
                                 languageCode=_orNone(data, 'languageCode'),
                                 )
        return newItem                         

### An instance that contains access information.
class AccessInstance(IInstance):
    def description(self, languageCode=None):
        return self.grantee.description(languageCode)
        
    def select_head_related(querySet):
        return querySet.select_related('grantee')

    def select_related(querySet, fields=[]):
        return AccessInstance.select_head_related(querySet)

    def headData(self, context):
        data = {'id': self.id.hex, 
                'description': self.description(context.languageCode), 
               }
        return data
        
    def getData(self, fields, context):
        data = self.headData(context)
        data['grantee'] = self.grantee.headData(context)
        if 'privilege' in self.__dict__:
            data['privilege'] = self.privilege
        
        if 'parents' in fields:
            if context.canRead(self.parent) and 'user' in fields:
                data['user'] = self.parent.getData([], context)
            else:
                data['user'] = self.parent.headData(context)
                
        return data
        
    def revert(self, h):
        self.grantee = h.grantee
        self.privilege = h.privilege
    
    @property    
    def privilegeSource(self):
        return self
        
    def fetchPrivilege(self, user):
        return "administer" if self.parent.fetchPrivilege(user) == "administer" else \
        "write" if self.grantee.id == user.id \
        else None
    
    def administrableQuerySet(qs, user, prefix=''):   
            inClause = (prefix + '__grantor_id__in') if prefix else 'grantor_id__in'
            grantClause = UserGrant.objects.filter(\
                                privilege="administer",
                                deleteTransaction__isnull=True,
                                grantee=user,
                            ).values('grantor_id').union(\
                            GroupGrant.objects.filter(\
                                privilege="administer",
                                deleteTransaction__isnull=True,
                                grantee__deleteTransaction__isnull=True,
                                grantee__members__user=user,
                                grantee__members__deleteTransaction__isnull=True,
                            ).values('grantor_id')).union(\
                            User.objects.filter(\
                                primaryAdministrator=user,\
                                deleteTransaction__isnull=True,\
                            ).values('id')).union(\
                            Organization.objects.filter(\
                                primaryAdministrator=user,\
                                deleteTransaction__isnull=True,\
                            ).values('id'))
            qClause = Q((inClause, grantClause))
            return qs.filter(qClause)
    
class ServiceLinkInstance(ChildInstance):
    @property
    def currentNamesQuerySet(self):
        return self.currentNames if 'currentNames' in self.__dict__ else self.service.names.filter(deleteTransaction__isnull=True)

    def description(self, languageCode=None):
        return IInstance.getName(self.currentNamesQuerySet, languageCode)
        
    def select_head_related(querySet):
        return querySet.select_related('service')\
                       .prefetch_related(Prefetch('service__names',
                                                  queryset=ServiceName.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
    
    def select_related(querySet, fields=[]):
        return ServiceLinkInstance.select_head_related(querySet)
                 
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.service:
                if 'service' in fields:
                    data['service'] = self.service.getData([], context)
                else:
                    data['service'] = self.service.headData(context)
            
        return data

    def order_by(queryset, context):
        return queryset.filter(Q(service__names__deleteTransaction__isnull=True)& 
                               (Q(service__names__languageCode=context.languageCode)|(Q(service__names__languageCode='en')&~Q(service__names__parent__names__languageCode=context.languageCode))))\
                       .order_by('service__names__text')
    
    def buildHistory(self, context):
        return self.historyType.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             service=self.service)
        
    def revert(self, h):
        self.service = h.service 

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.service or '-')
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'service' in changes:
            newService = _orNoneForeignKey(changes, 'service', context, Service)
            if newService != self.service:
                history = history or self.buildHistory(context)
                self.service = newService
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class OrderedServiceLinkInstance(ServiceLinkInstance):
    def getData(self, fields, context):
        data = super(OrderedServiceLinkInstance, self).getData(fields, context)
        if context.canRead(self):
            data['position'] = str(self.position)
            
        return data
        
    def buildHistory(self, context):
        return self.historyType.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             position=self.position,
                                             service=self.service)

    def revert(self, h):
        self.position = h.position 
        self.service = h.service 

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.service or '-')
           
    def order_by(queryset, context):
        return queryset.order_by('position')
                
class PublicInstance():
    def getSubClause(qs, user, accessType):
        return qs, accessType
        
    def filterForGetData(qs, user, accessType):
        return qs

class Instance(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    typeID = dbmodels.ForeignKey('consentrecords.Instance', related_name='typeInstances', db_column='typeid', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    parent = dbmodels.ForeignKey('consentrecords.Instance', related_name='children', db_column='parentid', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    parentValue = dbmodels.OneToOneField('consentrecords.Value', related_name='valueChild', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    transaction = dbmodels.ForeignKey(Transaction, db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    accessSource = dbmodels.ForeignKey('consentrecords.Instance', related_name='accessTargets', db_index=True, null=True, editable=True, on_delete=dbmodels.CASCADE)
    deleteTransaction = dbmodels.ForeignKey(Transaction, related_name='deletedInstance', db_index=True, null=True, editable=True, on_delete=dbmodels.CASCADE)
        
    class Meta:
        indexes = [
            dbmodels.Index(fields=['parent', 'typeID']),
        ]

    def __str__(self):
        try:
            d = self.description
            if d:
                return d.text
            else:
                return "Deleted"
        except Description.DoesNotExist:
            return "Deleted"
            
    @property
    def idString(self):
        return self.id.hex if isinstance(self.id, uuid.UUID) else self.id
    
    @property    
    def _parentDescription(self):
        return self.parent and str(self.parent)
        
    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, parent, transactionState):
        id = uuid.uuid4().hex
        i = Instance.objects.create(id=id, typeID=self, parent=parent,
                                    transaction=transactionState.transaction)
        if parent:
            Containment.objects.bulk_create([Containment(ancestor=j.ancestor, descendent=i) for j in parent.ancestors.all()])
        Containment.objects.create(ancestor=i, descendent=i)
        return i
    
    def getDataType(self, field):
        try:
            configuration = self.typeID.children.filter(typeID=terms.configuration,deleteTransaction__isnull=True)[0]
            fields = configuration.children.filter(typeID=terms.field,deleteTransaction__isnull=True)
            f = fields.get(value__field=terms.name,
                              value__referenceValue=field,
                              value__deleteTransaction__isnull=True)
            v = f.value_set.filter(field=terms.dataType,deleteTransaction__isnull=True)[0]
            return v.referenceValue
        except Instance.DoesNotExist:
            raise Instance.DoesNotExist('field "%s" does not exist in configuration of %s'%(field, self.typeID))
    
    # addValue ensures that the value can be found for object values. 
    # addValue does not validate that self is writable.           
    def addValue(self, field, value, position, userInfo, transactionState):
        if value == None:
            raise ValueError("value is not specified")
        
        dt = self.getDataType(field)
        if dt==terms.objectEnum:
            if isinstance(value, Instance):
                if value._canFind(userInfo):
                    return self.addReferenceValue(field, value, position, transactionState)
                else:
                    raise Instance.DoesNotExist()
            elif isinstance(value, dict) and "instanceID" in value:
                f = list(userInfo.findFilter(InstanceQuerySet(Instance.objects.filter(pk=value["instanceID"]))))
                if len(f) == 0:
                    raise Value.DoesNotExist("specified primary key (%s) for instance does not exist" % value["instanceID"])
                value = f[0]
                return self.addReferenceValue(field, value, position, transactionState)
            else:
                raise RuntimeError("%s is not an Instance or a dictionary with an instanceID" % value)
        elif dt==terms.translationEnum:
            return self.addTranslationValue(field, value, position, transactionState)
        else:
            return self.addStringValue(field, value["text"], position, transactionState)

    def addStringValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        return Value.objects.create(instance=self, field=field, stringValue = value, position=position, transaction=transactionState.transaction)

    def addTranslationValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
        if not isinstance(value, dict):
            raise ValueError("the value(%s) is not a dictionary" % str(value))
        return Value.objects.create(instance=self, field=field, 
                                    stringValue = value["text"], languageCode = value["languageCode"],
                                    position=position, transaction=transactionState.transaction)

    def updateDescendentAccessSources(self, accessSource):
        self.accessSource = accessSource
        self.save()
        items = [self]
        while len(items) > 0:
            item = items.pop(0)
            children = item.children.filter(deleteTransaction__isnull=True)
            children.update(accessSource=accessSource)
            items.extend(item.children.filter(deleteTransaction__isnull=True))
            
    # Returns a newly created value contained by self with the specified referenceValue
    def addReferenceValue(self, field, instance, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid" % position)
        if not instance:
            raise ValueError("the instance is null")
            
        # If the field is special access, then make this and all of its children sourced to self.
        if field == terms.specialAccess and instance == terms.customAccessEnum:
            self.updateDescendentAccessSources(self)
            
        return Value.objects.create(instance=self, field=field, referenceValue=instance, position=position, transaction=transactionState.transaction)

    def createMissingSubValue(self, field, value, position, transactionState):
        if position < 0:
            raise ValueError("the position %s is not valid", position)
            
        dt = self.getDataType(field)
        if dt==terms.objectEnum:
            if not Value.objects.filter(instance=self,field=field,referenceValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding object %s(%s)" % (str(self), str(field), str(value)))
                self.addReferenceValue(field, value, position, transactionState)
        elif dt==terms.translationEnum:
            if not Value.objects.filter(instance=self,field=field,stringValue=value["text"],
                                    languageCode=value["languageCode"],
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding translation %s(%s)" % (str(self), str(field), str(value)))
                self.addTranslationValue(field, value, position, transactionState)
        else:
            if not Value.objects.filter(instance=self,field=field,stringValue=value,
                                    deleteTransaction__isnull=True).exists():
                logger = logging.getLogger(__name__)
                logger.error("%s: adding string %s(%s)" % (str(self), str(field), str(value)))
                self.addStringValue(field, value, position, transactionState)
    
    # Returns a filter enumerating all of the values that match the specified field.
    def __getitem__(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        if isinstance(field, str):
            field = terms[field]
        return self.value_set.filter(field=field, deleteTransaction__isnull=True).order_by('position')
    
    # Returns a dictionary whose keys are field id strings and whose values are arrays of
    # values contained by self.
    # userInfo is used to determine if the dictionary includes security field data.  
    def _groupValuesByField(self, vs, userInfo):
        values = defaultdict(list)
        # Do not allow a user to get security field data unless they can administer this instance.
        cache = _deferred(lambda: self._canAdminister(userInfo))
        for v in vs:
            if v.field_id not in terms.securityFieldIDs or cache.value:
                values[v.field_id.hex].append(v)
        return values
    
    def _getSubInstances(self, field):
        return [v.referenceValue for v in self[field]]
        
    # Returns a unique value in the cell specified by the field.
    def getSubValue(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        try:
            f = self[field].select_related('referenceValue')
            return f[0] if f.exists() else None
        except Value.DoesNotExist:
            return None
    
    # Returns the instance associated with a unique value in the cell specified by the field.      
    def getSubInstance(self, field):
        v = self.getSubValue(field)
        return v and v.referenceValue
     
    # Returns the datum associated with a unique value in the cell specified by the field.      
    def getSubDatum(self, field):
        v = self.getSubValue(field)
        return v and v.stringValue
     
    # Returns a list of pairs of text that are used to generate the description of objects 
    # of this kind.
    # The first of the pair is the hex UUID of the name, the second is the hex UUID of the dataType
    @property
    def _descriptors(self):
        configuration = self.getSubInstance(terms.configuration)
        results = []
        if configuration:
            elementIDs = [terms.name, terms.dataType]
            for fieldObject in configuration._getSubInstances(terms.field):
                r = fieldObject.getSubInstance(terms.descriptorType)
                if r:
                    n = [fieldObject.getSubValue(x) for x in elementIDs]
                    dataTypeInstance = n[1] and n[1].referenceValue
                    if n[0] and dataTypeInstance:
                        results.append([n[0].referenceValue, dataTypeInstance, r])
        return results
        
    # Returns a description of this object with these verbs. 
    # verbs is an array of pairs where the first of the pair is the field name and 
    # the second is the field dataType.
    # The string is directly attached to the verb (v1).       
    def cacheDescription(self, nameLists):
        verbs = nameLists.getNameUUIDs(self.typeID)
        r = []
        for field, dataType, descriptorType in verbs:
            vs = self[field]
            if descriptorType == terms.textEnum:
                if dataType == terms.objectEnum:
                    for v in vs:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.field), v.stringValue))
                            r.append(v.referenceValue.description.text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                else:
                    r.extend([v.stringValue for v in filter(lambda v: v.stringValue, vs)])
            elif descriptorType == terms.firstTextEnum:
                if vs.exists():
                    v = vs[0]
                    if dataType == terms.objectEnum:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.field), v.stringValue))
                            r.append(v.referenceValue.description.text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                    else:
                        if v.stringValue:
                            r.append(v.stringValue)
            elif descriptorType == terms.countEnum:
                r.append(str(vs.count()))
            else:
                raise ValueError("unrecognized descriptorType: %s ('%s' or '%s')" % (str(descriptorType), str(terms.textEnum), str(terms.countEnum)))
                    
        s = " ".join(r)
        Description.objects.update_or_create(instance = self, 
                                             defaults={'text': s})
        return s
    
    # Return a list of the instances for which this instance contributes
    # to the description.
    @property
    def _descriptionReferences(self):
        values = self.referenceValues.filter(deleteTransaction__isnull=True)
        return [v.instance for v in filter(lambda v: v.isDescriptor, values)]

    def getDescription(self, language=None):
        return self._description
        
    def updateDescriptions(queue, nameLists):
        queue = list(queue) # Make a local copy of the list.
        calculated = set()
        while len(queue) > 0:
            i = queue[0]
            queue = queue[1:]
            if i not in calculated:
                i.cacheDescription(nameLists)
                queue.extend(i._descriptionReferences)
                calculated.add(i)
    
    @property
    def _description(self):
        d = self.description
        return d.text if d else "Deleted"

    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, userInfo, language=None):
        data = {'id': None, 
             'instanceID': self.idString, 
             'description': self.getDescription(language),
             'parentID': self.parent_id and self.parent_id.hex,
             'typeName': userInfo.getTypeName(self.typeID_id.hex)}
        privilege = self.getPrivilege(userInfo)
        if privilege:
            data["privilege"] = privilege.getDescription()
        return data
    
    def getData(self, fields, fieldsDataDictionary, language, userInfo):
        data = self.getReferenceData(userInfo, language)
        if not 'none' in fields:
            data['cells'] = self.getCellsData(fields, fieldsDataDictionary, language, userInfo)
        return data;
    
    # This code presumes that all fields have unique values.
    def _sortValueDataByField(values):
        d = {}
        for v in values:
            # If there is a reference value, put in a duple with the referenceValue name and id.
            # Otherwise, put in the string value.
            if v.referenceValue:
                d[v.field] = (v.referenceValue.description.text, v.referenceValue.idString)
            else:
                d[v.field] = v.stringValue
        return d
        
    # Returns a dictionary by field where each value is
    # a duple containing the value containing the name and 
    # the instance referenced by self from the key field.
    # Self is an instance of type field.
    def _getSubValueReferences(self):
        vs1 = self.value_set.filter(deleteTransaction__isnull=True)\
                            .select_related('referenceValue')\
                            .select_related('referenceValue__description')
        return Instance._sortValueDataByField(vs1)                                               
    
    # For a parent field when getting data, construct this special field record
    # that can be used to display this field data.
    def _getParentReferenceFieldData(userInfo, id):
        name = userInfo.getTypeName(id)
        fieldData = {"id": "parent/" + id,
                     "name" : name,
                     "nameID" : id,
                     "dataType" : TermNames.objectEnum,
                     "dataTypeID" : terms.objectEnum.idString,
                     "capacity" : TermNames.uniqueValueEnum,
                     "ofKind" : name,
                     "ofKindID" : id}
        return fieldData
    
    # Returns a dictionary of information about a field with this configuration.
    def getFieldDataByName(self, name, language=None):
        if terms.isUUID(name):
            # The key may be the key of a field object or the key of a term that is 
            # the name of a field object in the configuration.
            fieldObject = Instance.objects.get(pk=name)
            if fieldObject.typeID != terms.field:
                fieldObject = self.getFieldByReferenceValue(name)
            elif fieldObject.parent != self:
                raise RuntimeError("the specified field is not contained within the configuration of this type")
        else:
            fieldObject = self._getValueByName(name)
        return fieldObject.getFieldData(language)

    # Returns a dictionary of information about a field instance.                 
    def getFieldData(self, language=None):
        return self._getFieldDataFromValues(self._getSubValueReferences(), language)
    
    def _getFieldDataFromValues(self, values, language):
        fieldData = None
        if terms.name in values and terms.dataType in values:
            nameReference = values[terms.name]
            dataTypeReference = values[terms.dataType]
            fieldData = {"id" : self.idString, 
                         "name" : nameReference[0],
                         "nameID" : nameReference[1],
                         "dataType" : dataTypeReference[0],
                         "dataTypeID" : dataTypeReference[1]}
            if terms.maxCapacity in values:
                fieldData["capacity"] = values[terms.maxCapacity][0]
            else:
                fieldData["capacity"] = TermNames.multipleValuesEnum
                
            if terms.descriptorType in values:
                fieldData["descriptorType"] = values[terms.descriptorType][0]
            
            if terms.addObjectRule in values:
                fieldData["objectAddRule"] = values[terms.addObjectRule][0]
            
            if fieldData["dataTypeID"] == terms.objectEnum.idString:
                if terms.ofKind in values:
                    ofKindReference = values[terms.ofKind]
                    fieldData["ofKind"] = ofKindReference[0]
                    fieldData["ofKindID"] = ofKindReference[1]
                if terms.pickObjectPath in values:
                    fieldData["pickObjectPath"] = values[terms.pickObjectPath]
        else:
            raise ValueError("values does not contain name or dataType: %s" % values)
            
        return fieldData
    
    # Returns the fieldsData from the database for self, which is a term.
    def getFieldsData(self, language=None):
        vs1 = Value.objects.filter(deleteTransaction__isnull=True)\
                            .select_related('field')\
                            .select_related('referenceValue')\
                            .select_related('referenceValue__description')

        configuration = self.children.filter(typeID=terms.configuration, deleteTransaction__isnull=True)[0]
        fields = configuration.children.filter(typeID=terms.field, deleteTransaction__isnull=True)\
                                 .prefetch_related(Prefetch('value_set', queryset=vs1, to_attr='values'))\
                                 .order_by('parentValue__position')
        return [field._getFieldDataFromValues(Instance._sortValueDataByField(field.values), language) for field in fields]

    def _getCellValues(dataTypeID, values, userInfo, language=None):
        if dataTypeID == terms.objectEnum.idString:
            return [v.getReferenceData(userInfo, language) for v in values]
        elif dataTypeID == terms.translationEnum.idString:
            return [{"id": v.idString, "text": v.stringValue, "languageCode": v.languageCode} for v in values]
        else:
            # Default case is that each datum in this cell contains a unique value.
            return [{"id": v.idString, "text": v.stringValue} for v in values]
            
    def _getCellData(self, fieldData, values, userInfo, language=None):
        if not fieldData:
            raise ValueError("fieldData is null")
        cell = {"field": fieldData["id"]}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        else:
            cell["data"] = Instance._getCellValues(fieldData["dataTypeID"], values[fieldID], userInfo, language)
        return cell
                
    # Returns an array data for each cell of this, with all of the data in vs.
    def _getChildCellsData(self, vs, fieldsData, userInfo, language=None):
        values = self._groupValuesByField(vs, userInfo)
        return [self._getCellData(fieldData, values, userInfo, language)\
                for fieldData in filter(lambda f: not f["id"].startswith("parent/"), fieldsData)]

    def getCellsData(self, fields, fieldsDataDictionary, language, userInfo):
        fieldsData = fieldsDataDictionary[self.typeID_id]
        cells = self._getChildCellsData(self.values, fieldsData, userInfo, language)
    
        if 'parents' in fields:
            p = self
            fp = p.parent_id and \
                 userInfo.readFilter(\
                    InstanceQuerySet(Instance.objects.filter(pk=p.parent_id))\
                        .select_related([], "", userInfo))
            while fp and fp.exists():
                p = fp[0]
                
                fieldData = next((field for field in fieldsData if field["id"] == "parent/" + p.typeID_id.hex), None)
                if not fieldData:
                    fieldData = Instance._getParentReferenceFieldData(userInfo, p.typeID_id.hex)
                    fieldsData.append(fieldData)
            
                parentData = p.getReferenceData(userInfo, language)
                parentData['position'] = 0
                if fieldData["name"] in fields:
                    parentData['cells'] = p._getChildCellsData(p.values, fieldsDataDictionary[p.typeID_id], userInfo, language)
                
                cells.append({"field": fieldData["id"], "data": [parentData]})
                
                fp = p.parent_id and \
                     userInfo.readFilter(\
                        InstanceQuerySet(Instance.objects.filter(pk=p.parent_id))\
                            .select_related([], "", userInfo))
        
        if TermNames.systemAccess in fields:
            if userInfo.authUser.is_superuser:
                saObject = terms.administerPrivilegeEnum
            elif userInfo.authUser.is_staff:
                saObject = terms.writePrivilegeEnum
            else:
                saObject = None
            if saObject:
                fieldData = next((field for field in fieldsData if field["id"] == terms.systemAccess.idString), None)
                if not fieldData:
                    fieldData = Instance._getParentReferenceFieldData(userInfo, terms.systemAccess.idString)
                    fieldsData.append(fieldData)
                parentData = [{'id': None, 
                              'instanceID' : saObject.idString,
                              'description': saObject.getDescription(language),
                              'position': 0,
                              'privilege': saObject.description.text}]
                cells.append({"field": fieldData["id"], "data": parentData})
                
        # For each of the cells, if the cell is in the field list explicitly, 
        # and the cell is in the fieldsData (and not the name of a parent type)
        # then get the subdata for all of the values in that cell.
        subValuesDict = None
        for cell in cells:
            fieldData = next((field for field in fieldsData if field["id"] == cell["field"]), None)
            if not fieldData:
                raise "fieldData is not found"
            
            if fieldData["name"] in fields and fieldData["name"] != TermNames.systemAccess \
                and "ofKindID" in fieldData \
                and next((field for field in fieldsData if field["nameID"] == fieldData["nameID"]), None):
                
                subFieldsData = fieldsDataDictionary[fieldData["ofKindID"]]
                subValuesDict = subValuesDict or \
                                dict((s.idString, s) for s in filter(lambda s: s, map(lambda v: v.referenceValue, self.values)))  
                
                for d in cell["data"]:
                    # d["instanceID"] won't be in subValuesDict if it is a parent.
                    if d["instanceID"] in subValuesDict:
                        i = subValuesDict[d["instanceID"]]
                        d['cells'] = i._getChildCellsData(i.subValues, subFieldsData, userInfo, language)
                        d['typeName'] = fieldData["ofKind"]
        return cells

    def getNextElementIndex(self, field):
        f = self[field]
        return 0 if not f.exists() else (f.reverse()[0].position + 1)

    def updateElementIndexes(self, field, newIndex, transactionState):
        ids = dict([(e.position, e) for e in self[field]])
        if len(ids) == 0:
            return 0
        else:
            sortedIndexes = sorted(ids)
            if len(sortedIndexes) <= newIndex:
                return sortedIndexes[-1]+1
            elif newIndex == 0 and sortedIndexes[0] > 0:
                return 0
            elif sortedIndexes[newIndex] > sortedIndexes[newIndex-1] + 1:
                return sortedIndexes[newIndex-1] + 1
            else:
                movingIndexes = sortedIndexes[newIndex:]
                ids[movingIndexes[0]].updateIndex(movingIndexes[0] + 1, transactionState)
                lastIndex = movingIndexes[0]
                for i in movingIndexes[1:]:
                    if lastIndex + 1 < i:
                        break
                    ids[i].updateIndex(i + 1, transactionState)
                    lastIndex = movingIndexes[i]
                    
                return movingIndexes[0]
        
    def markAsDeleted(self, transactionState):
        self.deleteTransaction = transactionState.transaction
        self.save()

    def deepDelete(self, transactionState):
        queue = [self]
        
        self.accessSource = None
        self.deleteTransaction = transactionState.transaction
        self.save()
        while len(queue) > 0:
            next = queue[0]
            queue = queue[1:]
            instances = next.children.filter(deleteTransaction__isnull=True).only('id')
            values = next.value_set.filter(deleteTransaction__isnull=True).only('id')
            queue.extend(instances)
            
            # Delete associated access sources before marking the instances as deleted.
            instances.update(accessSource=None, deleteTransaction=transactionState.transaction)
            values.update(deleteTransaction=transactionState.transaction)

    # Return a filter of all of the instances of this type that exactly match the specified name.
    def getInstanceByName(self, nameField, name, userInfo):
        f = userInfo.findFilter(InstanceQuerySet(self.typeInstances.filter(deleteTransaction__isnull=True,
                                         value__deleteTransaction__isnull=True,
                                         value__field=nameField,
                                         value__stringValue__iexact=name)))
        return f[0] if len(f) else None
                                            
    # Return the Value for the specified configuration. If it doesn't exist, raise a Value.DoesNotExist.   
    # Self is of type configuration.
    def _getValueByName(self, name):
        try:
            return self.value_set.select_related('referenceValue')\
                                 .get(deleteTransaction__isnull=True,
                                      field=terms.field,
                                      referenceValue__value__deleteTransaction__isnull=True,
                                      referenceValue__value__field=terms.name,
                                      referenceValue__value__referenceValue__typeID=terms.term,
                                      referenceValue__value__referenceValue__value__deleteTransaction__isnull=True,
                                      referenceValue__value__referenceValue__value__field=terms.name,
                                      referenceValue__value__referenceValue__value__stringValue=name)\
                                 .referenceValue
        except Value.DoesNotExist:
            raise Value.DoesNotExist('the field name "%s" is not recognized for "%s" configuration of term "%s"' % (name, self, self.parent))

    # Return the Value for the specified configuration. If it doesn't exist, raise a Value.DoesNotExist.   
    # Self is of type configuration.
    def getFieldByReferenceValue(self, key):
        return self.value_set.select_related('referenceValue')\
                             .get(deleteTransaction__isnull=True,
                                  field=terms.field,
                                  referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=terms.name,
                                  referenceValue__value__referenceValue__id=key)\
                             .referenceValue

    @property
    def inheritsSecurity(self):
        return True
        
    def comparePrivileges(a, b):
        if a == b:
            return a
        elif not a:
            return b
                
        privileges = [terms.findPrivilegeEnum, terms.readPrivilegeEnum, terms.registerPrivilegeEnum, 
                      terms.writePrivilegeEnum, terms.administerPrivilegeEnum]
                      
        aIndex = privileges.index(a)
        return b if b in privileges[(aIndex+1):] else a
        
    ### Returns the privilege level that the specified user instance has for this instance. 
    def getPrivilege(self, userInfo):
        if userInfo.is_administrator:
            return terms.administerPrivilegeEnum
        
        if not self.accessSource_id:
            return terms.readPrivilegeEnum
        
        return userInfo.getPrivilege(self.accessSource_id)
    
    ### Returns True if this user (self) is the primary administrator of the specified instance
    def isPrimaryAdministrator(self, instance):
        if not instance.accessSource_id:
            return False

        return instance.accessSource.value_set.filter(field=terms.primaryAdministrator,
            referenceValue=self,
            deleteTransaction__isnull=True).exists()
    
    ### Returns a QuerySet that filters f according to the specified privileges.
    ### self is a user to whom the privileges apply.
    def _securityFilter(self, f, privilegeIDs, accessRecordOptional=True):        
        sources=Instance.objects.filter(\
                        (Q(children__typeID=terms.accessRecord,
                           children__deleteTransaction__isnull=True,
                           children__value__referenceValue__in=privilegeIDs))
                        |
                        (((Q(value__field=terms.publicAccess.id)\
                           &Q(value__referenceValue__in=privilegeIDs)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                          |
                          (Q(value__field=terms.primaryAdministrator.id)\
                           &Q(value__referenceValue=self)\
                           &Q(value__deleteTransaction__isnull=True)\
                          )\
                         )\
                        )\
                       )
        
        if accessRecordOptional:
            return f.filter(Q(accessSource__isnull=True)|
                            Q(accessSource__in=sources))
        else:
            return f.filter(Q(accessSource__in=sources))
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def findFilter(self, f):
        privilegeIDs = [terms.findPrivilegeEnum.id, terms.readPrivilegeEnum.id, terms.registerPrivilegeEnum.id, 
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def readFilter(self, f):
        privilegeIDs = [terms.readPrivilegeEnum.id,
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be found by self.    
    def administerFilter(self, f):
        privilegeIDs = [terms.administerPrivilegeEnum.id]
        
        return self._securityFilter(f, privilegeIDs, accessRecordOptional=False)
    
    def _canUse(self, userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs):
        if userInfo.is_administrator:
            return True

        if userInfo.isPrimaryAdministrator(self):
            return True
        
        if not self.accessSource_id:
            return False                    
        if len(publicAccessPrivileges) > 0 and \
           Value.objects.filter(instance=self.accessSource_id,
                                field=terms.publicAccess, 
                                referenceValue__in=publicAccessPrivileges,
                                deleteTransaction__isnull=True).exists():
            return True
        
        if not userInfo.instance:
            return False
        
        # create a query set of all of the access records that contain this instance.        
        f = Instance.objects.filter(parent=self.accessSource_id, typeID=terms.accessRecord)\
            .filter(Q(value__referenceValue=userInfo.instance,
                      value__deleteTransaction__isnull=True)|
                    Q(value__deleteTransaction__isnull=True,
                      value__referenceValue__value__referenceValue=userInfo.instance,
                      value__referenceValue__value__deleteTransaction__isnull=True))

        g = Value.objects.filter(instance__in=f, 
                field=terms.privilege, 
                deleteTransaction__isnull=True,
                referenceValue__in=accessRecordPrivilegeIDs)
                
        return g.exists()

    ## Instances can be read if the specified user is a super user or there is no accessRecord
    ## associated with this instance.
    ## Otherwise, the user must have a permission, public access set to read or be the primary administrator.
    def _canFind(self, userInfo):
        publicAccessPrivileges = [terms.findPrivilegeEnum, terms.registerPrivilegeEnum, 
                                  terms.readPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.findPrivilegeEnum.id,
                                    terms.registerPrivilegeEnum.id,
                                    terms.readPrivilegeEnum.id, 
                                    terms.writePrivilegeEnum.id, 
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    def _canRead(self, userInfo):
        publicAccessPrivileges = [terms.readPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.readPrivilegeEnum.id, 
                                    terms.writePrivilegeEnum.id, 
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
    
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canRegister(self, userInfo):
        publicAccessPrivileges = [terms.registerPrivilegeEnum, 
                                  terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.registerPrivilegeEnum.id,
                                    terms.writePrivilegeEnum.id,
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be written if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has either write or administer privilege on the instance.                        
    def _canWrite(self, userInfo):
        publicAccessPrivileges = [terms.writePrivilegeEnum]
        accessRecordPrivilegeIDs = [terms.writePrivilegeEnum.id,
                                    terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
        
    ## Instances can be administered if the specified user is a super user or the user is authenticated, the
    ## current instance has an access record and either the user is the primary administrator of the instance
    ## or the user has administer privilege on the instance.                        
    def _canAdminister(self, userInfo):
        publicAccessPrivileges = []
        accessRecordPrivilegeIDs = [terms.administerPrivilegeEnum.id]
        return self._canUse(userInfo, publicAccessPrivileges, accessRecordPrivilegeIDs)
            
    def checkWriteAccess(self, userInfo, field=None):
        if self.typeID==terms.accessRecord:
            if not self._canAdminister(userInfo):
                raise RuntimeError("administer permission failed")
        elif field in terms.securityFields:
            if not self._canAdminister(userInfo):
                raise RuntimeError("administer permission failed")
        else:
            if not self._canWrite(userInfo):
                try:
                    s = "write permission failed for %s" % self.description.text
                except Exception:
                    s = "write permission failed for %s" % self.typeID.description.text
                if field:
                    s += " to %s field" % field.description.text
                raise RuntimeError(s)
    
    # Raises an error unless the specified user can write the specified value to the specified field of self.
    # This handles the special case of register permission if the value is a user.
    # This also handles the special case of submitting an access request to another user.
    def checkWriteValueAccess(self, userInfo, field, value):
        if value:
            if isinstance(value, str) and terms.isUUID(value):
                value = Instance.objects.get(pk=value, deleteTransaction__isnull=True)
            if isinstance(value, Instance) and \
                value.typeID == terms.user and \
                value._canAdminister(userInfo) and \
                field not in terms.securityFields and \
                self._canRegister(userInfo):
                return
            if isinstance(value, Instance) and \
                value.typeID == terms.user and \
                field == terms.accessRequest and \
                self.typeID == terms.user:
                return
        self.checkWriteAccess(userInfo, field)
            
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.findPrivilegeEnum, terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(accessSource__isnull=True)|
                Q(accessSource__in=sources))
        
    def anonymousReadFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue=terms.readPrivilegeEnum)&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(accessSource__isnull=True)|
                Q(accessSource__in=sources))
        
    def securityValueFilter(self, privilegeIDs):
        sources=Instance.objects.filter(\
                        Q(children__typeID=terms.accessRecord,
                          children__deleteTransaction__isnull=True,
                          children__value__referenceValue__in=privilegeIDs)
                        |
                        (Q(value__field=terms.publicAccess.id,
                           value__referenceValue__in=privilegeIDs,
                           value__deleteTransaction__isnull=True)\
                          |
                          Q(value__field=terms.primaryAdministrator.id,
                            value__referenceValue=self,
                            value__deleteTransaction__isnull=True)\
                        )\
                       )
        
        return Q(referenceValue__isnull=True)|\
               Q(referenceValue__accessSource__isnull=True)|\
               Q(referenceValue__accessSource__in=sources)
    
    ### For the specified instance filter, filter only those instances that can be found by self. 
    @property   
    def findValueFilter(self):
        privilegeIDs = [terms.findPrivilegeEnum.id, terms.readPrivilegeEnum.id, terms.registerPrivilegeEnum.id,
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be read by self. 
    @property   
    def readValueFilter(self):
        privilegeIDs = [terms.readPrivilegeEnum.id, terms.registerPrivilegeEnum.id,
                      terms.writePrivilegeEnum.id, terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    ### For the specified instance filter, filter only those instances that can be administered by self. 
    @property   
    def administerValueFilter(self):
        privilegeIDs = [terms.administerPrivilegeEnum.id]
        
        return self.securityValueFilter(privilegeIDs)
    
    @property                
    def defaultCustomAccess(self):
        return self.value_set.filter(field=terms.defaultAccess, deleteTransaction__isnull=True).exists()
                    
    def getUserInstance(user):
        field = terms.userID
        userID = user.id
        if isinstance(userID, uuid.UUID):
            userID = userID.hex
        qs = Value.objects.filter(field=field, stringValue=userID,
            deleteTransaction__isnull=True)
        return qs[0].instance if len(qs) else None
    
    @property    
    def user(self):
        id = self[TermNames.userID][0].stringValue
        return AuthUser.objects.get(pk=id)

    # The following functions are used for loading scraped data into the system.
    def getOrCreateTextValue(self, field, value, fieldData, userInfo, transactionState):
        children = self[field].filter(stringValue=value['text'])
        if len(children):
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self[field]
                if len(children):
                    return children[0].updateValue(value, userInfo, transactionState)
                    
            return self.addValue(field, value, self.getNextElementIndex(field), userInfo, transactionState)
        
    def getOrCreateTranslationValue(self, field, text, languageCode, fieldData, userInfo, transactionState):
        children = self[field].filter(stringValue=text, languageCode=languageCode)
        if len(children):
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self[field]
                if len(children):
                    return children[0].updateValue({'text': text, 'languageCode': languageCode}, userInfo, transactionState)
                    
            return self.addValue(field, {'text': text, 'languageCode': languageCode}, self.getNextElementIndex(field), userInfo, transactionState)
        
    def getOrCreateReferenceValue(self, field, referenceValue, fieldData, userInfo, transactionState):
        children = self[field].filter(referenceValue=referenceValue)
        if children.exists():
            return children[0]
        else:
            if 'capacity' in fieldData and fieldData['capacity'] == TermNames.uniqueValueEnum:
                children = self[field]
                if len(children):
                    return children[0].updateValue(referenceValue, userInfo, transactionState)
                    
            return self.addReferenceValue(field, referenceValue, self.getNextElementIndex(field), transactionState)
        
    # returns the querySet of values within self that are in the specified object field and named using
    # a string within the referenceValue of the value.
    def getChildrenByName(self, field, nameField, name):
        return self[field].filter(referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=nameField,
                                  referenceValue__value__stringValue__iexact=name)
    
    # returns the querySet of values within self that are in the specified object field and named using
    # a referenceValue within the referenceValue of the value.
    def getChildrenByReferenceName(self, field, nameField, name):
        return self[field].filter(referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=nameField,
                                  referenceValue__value__referenceValue=name)
    def getValueByReference(self, field, r):
        return self[field].filter(referenceValue=r)
    # The previous functions are used for loading scraped data into the system.

    
class NameList():
    def __init__(self):
        self.items = {}
    
    def getNameUUIDs(self, typeID):
        if typeID in self.items:
            return self.items[typeID]
        else:
            nameFieldUUIDs = typeID._descriptors
            self.items[typeID] = nameFieldUUIDs
            return nameFieldUUIDs
    
class Value(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey(Instance, db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    field = dbmodels.ForeignKey(Instance, related_name='fieldValues', db_column='fieldid', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    referenceValue = dbmodels.ForeignKey(Instance, related_name='referenceValues', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey(Transaction, db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    deleteTransaction = dbmodels.ForeignKey(Transaction, related_name='deletedValue', db_index=True, null=True, editable=True, on_delete=dbmodels.CASCADE)
    
    class Meta:
        indexes = [
            dbmodels.Index(fields=['field', 'stringValue', 'languageCode']),
            dbmodels.Index(fields=['field', 'referenceValue']),
            dbmodels.Index(fields=['instance', 'field']),
        ]

    def __str__(self):
        d = str(self.referenceValue) if self.referenceValue else self.stringValue
        return "%s[%s:%s]@%s" % (str(self.instance), 
                                 str(self.field), 
                                 d, 
                                 str(self.position))
    
    @property
    def idString(self):
        return self.id.hex if isinstance(self.id, uuid.UUID) else self.id
    
    @property
    def objectValue(self):
        str(self.referenceValue) if self.referenceValue else self.stringValue
    
    @property
    def isDescriptor(self):
        return Instance.objects.filter(parent__parent=self.instance.typeID, typeID=terms.field) \
            .filter(deleteTransaction__isnull=True)\
            .filter(value__field=terms.name,\
                    value__referenceValue=self.field,
                    value__deleteTransaction__isnull=True)\
            .filter(value__field=terms.descriptorType,
                    value__deleteTransaction__isnull=True)\
            .exists()

    @property
    def isOriginalReference(self):
        # If it is not an id, then return false.
        if not self.referenceValue:
            return False
        return self.referenceValue.parent == self.instance
        
    def getReferenceData(self, userInfo, language=None):
        data = self.referenceValue.getReferenceData(userInfo, language)
        data['id'] = self.idString
        data['position'] = self.position
        return data
    
    # Return the data associated with this value that references an object.        
    def getData(self, fields, fieldsDataDictionary, language, userInfo):
        data = self.getReferenceData(userInfo, language=language)
        if not 'none' in fields:
            data['cells'] = self.referenceValue.getCellsData(fields, fieldsDataDictionary, language, userInfo)
        return data
    
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newValue, userInfo, transactionState):
        self.markAsDeleted(transactionState)
        return self.instance.addValue(self.field, newValue, self.position, userInfo, transactionState);
    
    # Updates the position of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateIndex(self, newIndex, transactionState):
        self.markAsDeleted(transactionState)
        return Value.objects.create(instance=self.instance, 
            field=self.field, 
            stringValue = self.stringValue, 
            referenceValue = self.referenceValue, 
            position=newIndex, 
            transaction=transactionState.transaction)
    
    def markAsDeleted(self, transactionState):
        self.deleteTransaction = transactionState.transaction
        self.save()
    
    def deepDelete(self, transactionState):
        # If the field is special access, then make this and all of its children 
        # sourced to the same source as the parent of self.
        if self.field == terms.specialAccess:
            self.instance.updateDescendentAccessSources(self.instance.parent and self.instance.parent.accessSource)
            
        if self.isOriginalReference:
            self.referenceValue.deepDelete(transactionState)
        self.markAsDeleted(transactionState)
    
    @property    
    def dataType(self):
        f = Instance.objects.get(typeID=terms.field,
                                 value__field=terms.name,
                                 value__referenceValue=self.field,
                                 value__deleteTransaction__isnull=True,
                                 parent__parent=self.instance.typeID)
        v = f.value_set.filter(field=terms.dataType,deleteTransaction__isnull=True)[0]
        return v.referenceValue
    
    # returns whether or not c has data to update self.
    # The analysis of c varies based on the data type of self's field.           
    def hasNewValue(self, c):
        if c == None:
            raise ValueError("c is not specified")
        
        dt = self.dataType
        if dt==terms.objectEnum:
            return "instanceID" in c
        elif dt==terms.translationEnum:
            return 'text' in c and 'languageCode' in c
        else:
            return 'text' in c

    def checkWriteAccess(self, userInfo):
        self.instance.checkWriteValueAccess(userInfo, self.field, self.referenceValue)
        
    def anonymousFindFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.findPrivilegeEnum, terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return (Q(referenceValue__isnull=True)|
                        Q(referenceValue__accessSource__isnull=True)|
                        Q(referenceValue__accessSource__in=sources))

    def anonymousReadFilter():
        sources=Instance.objects.filter(\
                          Q(value__field=terms.publicAccess.id)&
                          Q(value__referenceValue__in=[terms.readPrivilegeEnum])&\
                          Q(value__deleteTransaction__isnull=True)\
                        )
        
        return Q(referenceValue__isnull=True)|\
               Q(referenceValue__accessSource__isnull=True)|\
               Q(referenceValue__accessSource__in=sources)

# The description of an instance.        
class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.OneToOneField('consentrecords.Instance', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)

    def __str__(self):
        return "%s" % (self.text)
                
# A denormalization that identifies instances that descend through the parent node to 
# other instances.
class Containment(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ancestor = dbmodels.ForeignKey('consentrecords.Instance', related_name='descendents', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    descendent = dbmodels.ForeignKey('consentrecords.Instance', related_name='ancestors', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    
    def __str__(self):
        return "%s -> %s" % (self.ancestor, self.descendent)

### TagSource denormalizes Service instances that imply other service instances.
### For example, "Teacher" source implies "Job" target.        
class TagSource(dbmodels.Model):
    source = dbmodels.ForeignKey('consentrecords.Instance', related_name='tag_sources', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    target = dbmodels.ForeignKey('consentrecords.Instance', related_name='tag_targets', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
        
    class Meta:
        indexes = [
            dbmodels.Index(fields=['source', 'target']),
            dbmodels.Index(fields=['target', 'source']),
        ]

    def __str__(self):
        return "%s implies %s" % (self.source, self.target)
        
class TermNames():
    # These verbs are associated with field IDs of values.
    term = 'term'
    name = 'name'
    configuration = 'configuration'
    field = 'field'
    boolean = 'boolean'
    dataType = 'data type'
    ofKind = 'of kind'
    pickObjectPath = 'pick object path'
    enumerator = 'enumerator'
    maxCapacity = 'max capacity'
    addObjectRule = 'object add rule'
    descriptorType = 'descriptor type'
    user = 'user'
    userID = 'userID'
    email = 'email'
    firstName = 'first name'
    lastName = 'last name'
    text = 'text'
    accessRecord = 'access record'
    accessRequest = 'access request'
    systemAccess = 'system access'
    privilege = 'privilege'
    group = 'group'
    defaultAccess = 'default access'
    specialAccess = 'special access'
    publicAccess='public access'
    primaryAdministrator='primary administrator'
    
    # enumerations for data type
    stringEnum = 'string'
    number = 'number'
    datestamp = 'datestamp'
    datestampDayOptional = 'datestamp (day optional)'
    translationEnum = 'translation'
    objectEnum = 'object'
    
    # enumerations for max capacity
    uniqueValueEnum = 'unique value'
    multipleValuesEnum = 'multiple values'
    
    # enumerations for addObjectRule
    pickObjectRuleEnum = 'pick one'
    createObjectRuleEnum = 'create one'
    
    # enumerations for boolean
    yesEnum = 'yes'
    noEnum = 'no'
    
    # enumerations for descriptor type
    textEnum = 'by text'
    firstTextEnum = 'by first text'
    countEnum = 'by count'
    
    # enumerations for privilege
    findPrivilegeEnum = 'find'
    readPrivilegeEnum = 'read'
    writePrivilegeEnum = 'write'
    administerPrivilegeEnum = 'administer'
    registerPrivilegeEnum = 'register'
    
    # enumerations for special access.
    custom = 'custom'

    initialKinds = [
        configuration,      # identifies a configuration instance (contained by a uuName)
        field,              # identifies a field instance (contained by a configuration)
        boolean,            # identifies an instance of type Boolean
        name,               # Defines the proper name of an object.
        ofKind,             # identifies the type of object for a field of "object" data type.
        pickObjectPath,     # identifies the path to objects that are to be picked.
        enumerator,         # identifies an enumerator
        dataType,           # defines the data type of a property
        maxCapacity,        # defines the quantity relationship of a field within its container.
        addObjectRule,      # defines the rule for adding objects to a field that supports multiple objects
        descriptorType,     # defines how the data of this field is used to describe its instance.
        user,               # identifies an instance of a user.
        userID,             # identifies the user identifier for the user.
        email,              # identifies an email address.
        firstName,          # identifies the first name.
        lastName,           # identifies the last name.
        accessRecord,       # identifies an access record for an instance
        accessRequest,      # identifies an access request for an instance
        privilege,          # identifies a privilege associated with an access record
        group,              # identifies a group associated with an access record
        defaultAccess,
        specialAccess,
        publicAccess,
        primaryAdministrator,
        ]

class Terms():
#     uuName = None
#     configuration = None                # identifies a configuration instance (contained by a uuName)
#     field = None                        # identifies a field instance (contained by a configuration)
#     boolean = None                      # identifies an instance of type Boolean
#     name = None
#     ofKind = None
#     pickObjectPath = None
#     enumerator = None
#     dataType = None
#     maxCapacity = None
#     addObjectRule = None
#     descriptorType = None
#     user = None
#     userID = None
#     email = None
#     firstName = None
#     lastName = None
#     translation = None
#     text = None
#     accessRecord = None
#     accessRequest = None
#     systemAccess = None
#     privilege = None
#     group = None
#     defaultAccess = None
#     specialAccess = None
#     publicAccess=None                   # Identifies fields used to determine what privileges the public has with regard to an instance.
#     primaryAdministrator=None           # Identifies fields that contain the primary administrator for an instance.
#     
#     textEnum = None                     # Identifies fields where instances of the containing type
#                                         # are described by the text of values of this field type
#                                         # contained within the instance.
#     countEnum = None                    # Identifies fields where instances of the containing type 
#                                         # are described by the number of values of this field type
#                                         # contained within the instance. 
#     
#     objectEnum = None                   # Identifies fields whose values are other instances.
#     stringEnum = None                   # Identifies fields whose values are strings.
#     translationEnum = None              # Identifies fields whose values are translations.
#     
#     uniqueValueEnum = None              # Identifies fields that can have a single value
#     multipleValuesEnum = None           # Identifies fields that can have 0 or more values
#     
#     pickObjectRuleEnum = None           # Identifies object fields that pick an existing object when adding a value
#     createObjectRuleEnum = None         # Identifies object fields that create a new object when adding a value
#     
#     findPrivilegeEnum = None            # Identifies access records that give find access to an instance.
#     readPrivilegeEnum = None            # Identifies access records that give read access to an instance.
#     writePrivilegeEnum = None           # Identifies access records that give write access to an instance.
#     administerPrivilegeEnum = None      # Identifies access records that give administer access to an instance.
#     registerPrivilegeEnum = None        # Identifies access records that give register access to an instance.
#     
#     # Enumeration values of the default secure term.
#     defaultCustomEnum = None            # Identifies instance types that have customized access by default.
#     
#     customAccessEnum = None             # Identifies instances that have customized access as a user setting.
#     
#     securityFields = None
    
    def initialize(self, transactionState=None):
        try:
            self.term = Terms.getUUName()
            self.name = Terms.getName()
            self.configuration = Terms.getOrCreateTerm(TermNames.configuration,  transactionState)
            self.field = Terms.getOrCreateTerm(TermNames.field,  transactionState)
            self.boolean = Terms.getOrCreateTerm(TermNames.boolean,  transactionState)
            self.ofKind = Terms.getOrCreateTerm(TermNames.ofKind,  transactionState)
            self.pickObjectPath = Terms.getOrCreateTerm(TermNames.pickObjectPath,  transactionState)
            self.enumerator = Terms.getOrCreateTerm(TermNames.enumerator,  transactionState)
            self.dataType = Terms.getOrCreateTerm(TermNames.dataType,  transactionState)
            self.maxCapacity = Terms.getOrCreateTerm(TermNames.maxCapacity,  transactionState)
            self.addObjectRule = Terms.getOrCreateTerm(TermNames.addObjectRule,  transactionState)
            self.descriptorType = Terms.getOrCreateTerm(TermNames.descriptorType,  transactionState)
            self.user = Terms.getOrCreateTerm(TermNames.user, transactionState)
            self.userID = Terms.getOrCreateTerm(TermNames.userID, transactionState)
            self.email = Terms.getOrCreateTerm(TermNames.email, transactionState)
            self.firstName = Terms.getOrCreateTerm(TermNames.firstName, transactionState)
            self.lastName = Terms.getOrCreateTerm(TermNames.lastName, transactionState)
            self.translation = Terms.getOrCreateTerm(TermNames.translationEnum, transactionState)
            self.accessRecord = Terms.getOrCreateTerm(TermNames.accessRecord, transactionState)
            self.accessRequest = Terms.getOrCreateTerm(TermNames.accessRequest, transactionState)
            self.systemAccess = Terms.getOrCreateTerm(TermNames.systemAccess, transactionState)
            self.privilege = Terms.getOrCreateTerm(TermNames.privilege, transactionState)
            self.group = Terms.getOrCreateTerm(TermNames.group, transactionState)
            self.defaultAccess = Terms.getOrCreateTerm(TermNames.defaultAccess, transactionState)
            self.specialAccess = Terms.getOrCreateTerm(TermNames.specialAccess, transactionState)
            self.publicAccess = Terms.getOrCreateTerm(TermNames.publicAccess, transactionState)
            self.primaryAdministrator = Terms.getOrCreateTerm(TermNames.primaryAdministrator, transactionState)
            self.securityFields = [self.accessRecord, self.systemAccess, self.defaultAccess, self.specialAccess, self.publicAccess, self.primaryAdministrator, self.accessRequest]
            self.securityFieldIDs = list(map(lambda f: f.id, self.securityFields))
        except Instance.DoesNotExist: pass
        except Value.DoesNotExist: pass
    
        try: self.textEnum = Terms.getNamedEnumerator(self.descriptorType, TermNames.textEnum)
        except Value.DoesNotExist: pass
        try: self.firstTextEnum = Terms.getNamedEnumerator(self.descriptorType, TermNames.firstTextEnum)
        except Value.DoesNotExist: pass
        try: self.countEnum = Terms.getNamedEnumerator(self.descriptorType, TermNames.countEnum);
        except Value.DoesNotExist: pass
    
        try: self.objectEnum = Terms.getNamedEnumerator(self.dataType, TermNames.objectEnum);
        except Value.DoesNotExist: pass
        try: self.stringEnum = Terms.getNamedEnumerator(self.dataType, TermNames.stringEnum);
        except Value.DoesNotExist: pass
        try: self.translationEnum = Terms.getNamedEnumerator(self.dataType, TermNames.translationEnum);
        except Value.DoesNotExist: pass
    
        try: self.uniqueValueEnum = Terms.getNamedEnumerator(self.maxCapacity, TermNames.uniqueValueEnum);
        except Value.DoesNotExist: pass
        try: self.multipleValuesEnum = Terms.getNamedEnumerator(self.maxCapacity, TermNames.multipleValuesEnum);
        except Value.DoesNotExist: pass
        
        try: self.pickObjectRuleEnum = Terms.getNamedEnumerator(self.addObjectRule, TermNames.pickObjectRuleEnum);
        except Value.DoesNotExist: pass
        try: self.createObjectRuleEnum = Terms.getNamedEnumerator(self.addObjectRule, TermNames.createObjectRuleEnum);
        except Value.DoesNotExist: pass
        
        try: self.findPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.findPrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.readPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.readPrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.writePrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.writePrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.administerPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.administerPrivilegeEnum);
        except Value.DoesNotExist: pass
        try: self.registerPrivilegeEnum = Terms.getNamedEnumerator(self.privilege, TermNames.registerPrivilegeEnum);
        except Value.DoesNotExist: pass
            
        try: self.defaultCustomEnum = Terms.getNamedEnumerator(self.defaultAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
        try: self.customAccessEnum = Terms.getNamedEnumerator(self.specialAccess, TermNames.custom);
        except Value.DoesNotExist: pass
            
    def getUUName():
        return Instance.objects.get(
            (Q(value__stringValue__iexact=TermNames.term)|Q(value__stringValue__iexact=('_'+TermNames.term))),
            typeID=F('id'),
            value__deleteTransaction__isnull=True)

    def getName():
        return Instance.objects.get(
            (Q(value__stringValue__iexact=TermNames.name)|Q(value__stringValue__iexact=('_'+TermNames.name))),
            typeID=terms.term,
            value__deleteTransaction__isnull=True,
            value__field=F('id'))

    # If name is a 32 character hex string, then it is considered that ID. 
    # Otherwise, it is looked up by case-insensitive name.
    def __getitem__(self, name):
        try:
            if terms.isUUID(name):
                return Instance.objects.get(pk=name, deleteTransaction__isnull=True);
            else:
                return Instance.objects.get(typeID=terms.term,
                    value__deleteTransaction__isnull=True,
                    value__field = terms.name,
                    value__stringValue__iexact=name)
        except Instance.DoesNotExist:
            if name.startswith('_'):
                try: 
                    return Instance.objects.get(typeID=terms.term,
                        value__deleteTransaction__isnull=True,
                        value__field = terms.name,
                        value__stringValue__iexact=name[1:])
                except Instance.DoesNotExist:
                    raise Instance.DoesNotExist('the term "%s" is not recognized' % name)
            else:
                try: 
                    return Instance.objects.get(typeID=terms.term,
                        value__deleteTransaction__isnull=True,
                        value__field = terms.name,
                        value__stringValue__iexact='_'+name)
                except Instance.DoesNotExist:
                    raise Instance.DoesNotExist('the term "%s" is not recognized' % name)
            
    def __getattr__(self, name):
        if name == 'term':
            x = Terms.getUUName()
        elif name == 'name':
            x = Terms.getName()
        elif name == 'securityFields': 
            x = [self.accessRecord, self.systemAccess, self.defaultAccess, self.specialAccess, self.publicAccess, self.primaryAdministrator, self.accessRequest]
        elif name == 'securityFieldIDs': 
            x = list(map(lambda t: t.id, self.securityFields))
        elif name in ['textEnum', 'firstTextEnum', 'countEnum']:
            x = Terms.getNamedEnumerator(self.descriptorType, type.__getattribute__(TermNames, name))
        elif name in ['objectEnum', 'stringEnum', 'translationEnum']:
            x = Terms.getNamedEnumerator(self.dataType, type.__getattribute__(TermNames, name))
        elif name in ['uniqueValueEnum', 'multipleValuesEnum']:
            x = Terms.getNamedEnumerator(self.maxCapacity, type.__getattribute__(TermNames, name))
        elif name in ['pickObjectRuleEnum', 'createObjectRuleEnum']:
            x = Terms.getNamedEnumerator(self.addObjectRule, type.__getattribute__(TermNames, name))
        elif name in ['yesEnum', 'noEnum']:
            x = Terms.getNamedEnumerator(self.boolean, type.__getattribute__(TermNames, name))
        elif name in ['findPrivilegeEnum', 'readPrivilegeEnum', 'writePrivilegeEnum', 'administerPrivilegeEnum', 'registerPrivilegeEnum']:
            x = Terms.getNamedEnumerator(self.privilege, type.__getattribute__(TermNames, name))
        elif name == 'defaultCustomEnum':
            x = Terms.getNamedEnumerator(self.defaultAccess, TermNames.custom);
        elif name == 'customAccessEnum':
            x = Terms.getNamedEnumerator(self.specialAccess, TermNames.custom);
        else:
            x = self[type.__getattribute__(TermNames, name)]
        self.__setattr__(name, x)
        return x
        
    def getOrCreateTerm(name, transactionState):
        try:
            return terms[name]
        except Instance.DoesNotExist:
            i = terms.term.createEmptyInstance(None, transactionState)
            i.addStringValue(terms.name, name, 0, transactionState)
            return i
            
    
    # Return an Instance representing the specified Ontology object. 
    # If the Instance doesn't exist, raise a Value.DoesNotExist.   
    def getNamedEnumerator(term, name):
        if not term:
            raise ValueError("term is null")
        try:
            v = Value.objects.get(instance=term, field=terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.name,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact=name)
            return v.referenceValue
        except Value.DoesNotExist:
            if name.startswith('_'):
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.name,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact=name[1:])
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
            else:
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              deleteTransaction__isnull=True,
                              referenceValue__value__field=terms.name,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact='_'+name)
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getTranslationNamedEnumerator(term, name, languageCode):
        try:
            v = Value.objects.get(instance=term, field = terms.enumerator,
                                  referenceValue__value__deleteTransaction__isnull=True,
                                  referenceValue__value__field=terms.translation,
                                  referenceValue__value__stringValue=name,
                                  referenceValue__value__languageCode=languageCode)
            return v.referenceValue
        except Value.DoesNotExist:
            if name.startswith('_'):
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              referenceValue__value__field=terms.translation,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact=name[1:],
                              referenceValue__value__languageCode=languageCode)
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
            else:
                try: 
                    v = Value.objects.get(instance=term, field=terms.enumerator,
                              referenceValue__value__field=terms.translation,
                              referenceValue__value__deleteTransaction__isnull=True,
                              referenceValue__value__stringValue__iexact='_'+name,
                              referenceValue__value__languageCode=languageCode)
                    return v.referenceValue
                except Value.DoesNotExist:
                    raise Value.DoesNotExist('the enumerator "%s" for term "%s" is not recognized' % (name, str(term)))
        
    def isUUID(self, s):
        return re.search('^[a-fA-F0-9]{32}$', s)
                
terms = Terms()

class FieldsDataDictionary(dict):
    def __init__(self, *args, **kwargs):
        self.language = kwargs.pop('language', None)
        dict.__init__(self, *args, **kwargs)
    
    def getType(self, t):
        if isinstance(t, uuid.UUID):
            return next((key for key in self.keys() if key.id == t), None) or \
                   Instance.objects.get(pk=t)
        elif isinstance(t, str):
            return next((key for key in self.keys() if key.id.hex == t), None) or \
                   Instance.objects.get(pk=uuid.UUID(t))
        elif isinstance(t, Instance):
            return t
        else:
            raise ValueError("%s is not a type" % t)
    
    def __getitem__(self, t):
        typeInstance = self.getType(t)
                            
        if typeInstance not in self:
            self[typeInstance] = typeInstance.getFieldsData(self.language)
        
        return dict.__getitem__(self, typeInstance)
    
    def getData(self, types):
        values = map(lambda t: self[t], types)
        return list(itertools.chain.from_iterable(self.values()))
        
class UserInfo:
    def __init__(self, authUser):
        self.authUser = authUser
        self.instance = Instance.getUserInstance(authUser) if authUser.is_authenticated else None
        self._findValueFilter = None
        self._readValueFilter = None
        self._logs = []
        self.log('Create UserInfo')
        self.typeNames = {}
        
        # privileges is a cache of privileges where the keys are instance ids.
        self._privileges = {}
    
    @property    
    def is_administrator(self):
        return self.authUser.is_staff
        
    @property
    def is_authenticated(self):
        return self.authUser.is_authenticated

    def findFilter(self, resultSet):
        return resultSet.findableQuerySet(self)

    def readFilter(self, resultSet):
        return resultSet.readableQuerySet(self)

    def administerFilter(self, resultSet):
        return resultSet.administerableQuerySet(self)
        
    def isPrimaryAdministrator(self, instance):
        return self.is_authenticated and self.instance and self.instance.isPrimaryAdministrator(instance)

    def log(self, s):
        self._logs.append({"text": s, "timestamp": str(datetime.datetime.now())})
        
    def getTypeName(self, idString):
        if idString in self.typeNames:
            return self.typeNames[idString]
        else:
            description = Description.objects.get(instance_id=idString).text
            self.typeNames[idString] = description
            return description
    
    def loadPrivilege(self, source_id):
        try:
            minPrivilege = Value.objects.select_related('referenceValue__description')\
                                .get(instance=source_id,
                                     field=terms.publicAccess, 
                                     deleteTransaction__isnull=True)\
                                   .referenceValue
        except Value.DoesNotExist:
            minPrivilege = None
    
        if not self.instance:
            self._privileges[source_id] = minPrivilege
        elif Value.objects.filter(instance=source_id,
                                field=terms.primaryAdministrator, 
                                deleteTransaction__isnull=True,
                                referenceValue=self.instance).exists():
            self._privileges[source_id] = terms.administerPrivilegeEnum
        else:
            # create a query set of all of the access records that contain this instance.        
            f = Instance.objects.filter(parent=source_id, typeID=terms.accessRecord)\
                .filter(Q(value__referenceValue=self.instance,
                          value__deleteTransaction__isnull=True)|
                        Q(value__deleteTransaction__isnull=True,
                          value__referenceValue__value__referenceValue=self.instance,
                          value__referenceValue__value__deleteTransaction__isnull=True))
    
            g = Value.objects.filter(instance__in=f, field=terms.privilege, 
                    deleteTransaction__isnull=True)\
                    .select_related('referenceValue__description')
            
            # map the access records to their corresponding privilege values.              
            p = map(lambda i: i.referenceValue, g)
    
            self._privileges[source_id] = reduce(Instance.comparePrivileges, p, minPrivilege)
    
    # Returns a privilege instance for the specified source_id.
    def getPrivilege(self, source_id):
        if source_id not in self._privileges:
            self.loadPrivilege(source_id)
        
        return self._privileges[source_id]
            
class ObjectQuerySet:
    def __init__(self, querySet=None):
        if isinstance(querySet, ObjectQuerySet):
            raise ValueError("querySet is an ObjectQuerySet")
        self.querySet = querySet

    def getQClause(self, field, symbol, testValue):
        if isinstance(testValue, list):
            simples = map(lambda t: self.getValueQ(field, symbol, t), testValue)
            return reduce(lambda q1, q2: q1 | q2, simples)
        else:
            return self.getValueQ(field, symbol, testValue)

    def getAncestorClause(self, symbol, testValue):
        if isinstance(testValue, list):
            simples = map(lambda t: self.getSimpleAncestorClause(symbol, t), testValue)
            return reduce(lambda q1, q2: q1 | q2, simples)
        else:
            return self.getSimpleAncestorClause(symbol, testValue)

    # Return the Q Clause based on all of the elements within a []
    # This function factors out '|' operations within the clause into simple tests.
    def clause(self, params, userInfo):
        paramClauses = []
        paramClause = []
        for s in params:
            if s == '|':
                if len(paramClause):
                    paramClauses.append(paramClause)
                    paramClause = []
            else:
                paramClause.append(s)
        if len(paramClause):
            paramClauses.append(paramClause)
        
        if len(paramClauses) == 1:
            return self.filterClause(paramClauses[0], userInfo)
        else:
            return reduce(lambda q1, q2: ((q1[0] | q2[0]), combineTerms(q1[1], q2[1])), \
                          map(lambda p: self.filterClause(p, userInfo), paramClauses))

    def getFieldQ(field, symbol, testValue):
        if symbol == '^=':
            q = Q((field + 'istartswith', testValue))
        elif symbol == '=':
            q = Q((field + 'iexact', testValue))
        elif symbol == '*=':
            q = Q((field + 'iregex', '[[:<:]]' + testValue))
        elif symbol == '<':
            q = Q((field + 'lt', testValue))
        elif symbol == '<=':
            q = Q((field + 'lte', testValue))
        elif symbol == '>':
            q = Q((field + 'gt', testValue))
        elif symbol == '>=':
            q = Q((field + 'gte', testValue))
        else:
            raise ValueError("unrecognized symbol: %s"%symbol)

    def getValueQ(self, field, symbol, testValue):
        if terms.isUUID(testValue):
            if symbol == '=':
                q = Q(value__referenceValue_id=testValue)
            else:
                raise ValueError("unrecognized symbol: %s" % symbol)
        else:
            if symbol == '^=':
                q = Q(value__stringValue__istartswith=testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__istartswith=testValue)
            elif symbol == '=':
                q = Q(value__stringValue__iexact=testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__iexact=testValue)
            elif symbol == '*=':
                q = Q(value__stringValue__iregex='[[:<:]]' + testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__iregex='[[:<:]]' + testValue)
            elif symbol == '<':
                q = Q(value__stringValue__lt=testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__lt=testValue)
            elif symbol == '<=':
                q = Q(value__stringValue__lte=testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__lte=testValue)
            elif symbol == '>':
                q = Q(value__stringValue__gt=testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__gt=testValue)
            elif symbol == '>=':
                q = Q(value__stringValue__gte=testValue,value__referenceValue__isnull=True)|\
                    Q(value__referenceValue__description__text__gte=testValue)
            else:
                raise ValueError("unrecognized symbol: %s"%symbol)
        q = q & Q(value__deleteTransaction__isnull=True)
        if field: q = q & Q(value__field=field)
        return q

    def refineFilter(self, params, userInfo):
        if params[0] == 'ancestor' and params[1] == ':':
            # Filter by items that contain an ancestor with the specified field clause. 
            if params[2] != '?':
                i = terms[params[2]]
            else:
                i = None
            if len(params) == 5:
                # example: ancestor:name*='foo'
                #
                # Get a Q clause that compares either a single test value or a comma-separated list of test values
                # according to the specified symbol.
                stringText = self.getAncestorClause(symbol=params[3], testValue=params[-1])
    
                if i:
                    q = stringText & Q(ancestors__ancestor__value__field=i,
                                       ancestors__ancestor__value__deleteTransaction__isnull=True)
                else:
                    q = stringText & Q(ancestors__ancestor__value__deleteTransaction__isnull=True)
            else:
                raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
        else:
            q, i = self.clause(params, userInfo)
            
        # Need to add distinct after the tests to prevent duplicates if there is
        # more than one value of the instance that matches.
        return self.applyClause(q, i)
    
    # Returns a duple containing a new result set based on the first "phrase" of the path 
    # and a subset of path containing everything but the first "phrase" of the path.
    def refineResults(self, path, userInfo):
#         logger = logging.getLogger(__name__)
#         logger.error("refineResults(%s, %s)" % (str(self.querySet), path))
    
        if path[0] == '#':
            return InstanceQuerySet(Instance.objects.filter(pk=path[1])), path[2:]
        elif path[0] == '*':
            return InstanceQuerySet(Instance.objects.filter(deleteTransaction__isnull=True)), path[1:]
        elif path[0] == '[':
            return self.refineFilter(path[1], userInfo), path[2:]
        elif path[0] == '>' or path[0] == '/':
            i = terms[path[1]]
            if len(path) == 2:
                f = Value.objects.filter(instance__in=self.findableQuerySet(userInfo),
                                         field=i,
                                         deleteTransaction__isnull=True)\
                                 .order_by('instance', 'position')
                return wrapValueQuerySet(i, f), []
            elif len(path) == 4 and path[2] == '/' and terms.isUUID(path[3]):
                f = Value.objects.filter(instance__in=self.findableQuerySet(userInfo),
                                         field=i,
                                         deleteTransaction__isnull=True,
                                         referenceValue_id=path[3])\
                                 .order_by('instance', 'position')
                return wrapValueQuerySet(i, f), []
            else:
                f = Instance.objects.filter(referenceValues__instance__in=self.findableQuerySet(userInfo),
                                            referenceValues__field=i,
                                            referenceValues__deleteTransaction__isnull=True)\
                                    .order_by('parent', 'parentValue__position')
                return wrapInstanceQuerySet(i, f), path[2:]       
        elif path[0] == '::':
            function = path[1]
            if function == 'reference':
                if isinstance(path[2], list):
                    if len(path[2]) != 1:
                        t = map(terms.__getitem__, path[2])
                        f = Instance.objects.filter(typeID__in=t,
                                                    value__deleteTransaction__isnull=True,
                                                    value__referenceValue__in=self.findableQuerySet(userInfo))
                    else:
                        t = terms[path[2][0]]
                        f = Instance.objects.filter(value__deleteTransaction__isnull=True,
                                                    value__referenceValue__in=self.findableQuerySet(userInfo),
                                                    typeID=t,
                                                   )
                    return InstanceQuerySet(f), path[3:]
                else:
                    raise ValueError("malformed reference (missing parentheses)")
            else:
                raise ValueError("unrecognized function: %s" % function)
        elif path[0] == '|':
            # 'or' case.
            parsed = InstanceQuerySet().parse(path[1:], userInfo)
            return InstanceObjectSet(Instance.objects.filter(self.instanceQ()|parsed.instanceQ())), []
        elif len(path) >= 3 and path[0] == ':' and path[1] == 'not':
            if isinstance(path[2], list):
                if path[2][0] == '[':
                    params = path[2][1]
                    i = terms[params[0]]
                    if len(params) == 1:
                        f = self.excludeByField(i)
                        return f, path[3:]
                    elif len(params) == 3:
                        symbol = params[1]
                        testValue = params[2]
                        f = self.excludeByValue(i, symbol, testValue)
                        return f, path[3:]
                    else:
                        raise ValueError("unrecognized contents within ':not([...])'")
                else:
                    raise ValueError("unimplemented 'not' expression")
            else:
                raise ValueError("malformed 'not' expression")
        elif isinstance(path[0], list): # Path[0] is a list of type IDs.
            t = map(terms.__getitem__, path[0])
            f = Instance.objects.filter(typeID__in=t,
                                        deleteTransaction__isnull=True)
            return wrapInstanceQuerySet(t, f), path[1:]
        elif terms.isUUID(path[0]):
            pathID = uuid.UUID(path[0])
            if self.querySet:
                return InstanceQuerySet(self.querySet.filter(pk=pathID, deleteTransaction__isnull=True)), path[1:]
            else:
                return InstanceQuerySet(Instance.objects.filter(pk=pathID, deleteTransaction__isnull=True)), path[1:]
        else:   # Path[0] is the name of a type.
            i = terms[path[0]]
            f = Instance.objects.filter(typeID=i, deleteTransaction__isnull=True)
            return wrapInstanceQuerySet(i, f), path[1:]

    def parse(self, a, userInfo):
        qs = self
        path = a
        while len(path) > 0:
            qs, path = qs.refineResults(path, userInfo)
        return qs
    
    def getSubValueQuerySet(vqs, userInfo):
        return ValueQuerySet(vqs.filter(deleteTransaction__isnull=True)).findableQuerySet(userInfo) \
                       .order_by('position')\
                       .select_related('referenceValue')\
                       .select_related('referenceValue__description')

    ### Applies the appropriate findFilter operation to the querySet associated with this
    ### ObjectQuerySet.
    def applyFindFilter(self, userInfo):
        self.querySet = self.findableQuerySet(userInfo)
    
class ValueQuerySet(ObjectQuerySet):
    
    # Extends the specified QuerySet of Values with data to be returned to the client.
    def select_related(self, fieldNames, userInfo):

        # preload the typeID, parent, value_set and description to improve performance.
        # For each field that is in the fields list, also preload its field, referenceValue and referenceValue__description.
        valueQueryset = ObjectQuerySet.getSubValueQuerySet(Value.objects, userInfo)

        if len(fieldNames):
            # The distinct is required to eliminate duplicate subValues.
            subValues = Value.objects.filter(instance__deleteTransaction__isnull=True,
                                      instance__referenceValues__deleteTransaction__isnull=True,
                                      instance__referenceValues__field__description__text__in=fieldNames)\
                .distinct()
            subValueQueryset = ObjectQuerySet.getSubValueQuerySet(subValues, userInfo)
            valueQueryset =  valueQueryset.prefetch_related(Prefetch('referenceValue__value_set',
                                  queryset=subValueQueryset,
                                  to_attr='subValues'))

        self.querySet = self.querySet.select_related('referenceValue__description')\
                  .prefetch_related(Prefetch('referenceValue__value_set',
                                             queryset=valueQueryset,
                                             to_attr='values'))
        return self
    
    def __init__(self, querySet=None):
        super(ValueQuerySet, self).__init__(querySet)
        
    def createObjectQuerySet(self, querySet):
        return ValueQuerySet(querySet)
        
    # Return a Q expression that returns all of the instances in this query set.
    def instanceQ(self):
        return Q(referenceValues__in=self.querySet)
        
    def excludeByField(self, field):
        raise RuntimeError("ValueQuerySet.excludeByField not implemented")

    def excludeByValue(self, field, symbol, testValue):
        raise RuntimeError("ValueQuerySet.excludeByValue not implemented")
        
    # return an InstanceQuerySet derived from the contents of self.
    def filterToInstances(self):
        return InstanceQuerySet(Instance.objects.filter(referenceValues__in=self.querySet))
        
    # returns a Q clause to filter instances to those that contain references in 
    # the specified fields to one of the specified referenceValues.
    def clauseByReferenceValues(self, fieldNames, referenceValues):
        if isinstance(referenceValues, ObjectQuerySet):
            raise ValueError("referenceValues is an ObjectQuerySet")
            
        if isinstance(fieldNames, list):
            t = list(map(terms.__getitem__, fieldNames))
            return Q(field__in=t,
                     deleteTransaction__isnull=True,
                     referenceValue__in=referenceValues), t
        else:
            t = terms[fieldNames]
            return Q(field=t,
                     deleteTransaction__isnull=True,
                     referenceValue__in=referenceValues), t

    # Return a Q clause according to the specified params.
    # If the parameter list is a single item:
    #     If there is a list, then the object must contain a value with the specified field type.
    #     If there is a question mark, then this is a no-op.
    #     If there is a single term name, then each instance must contain a value of that term.
    # If the parameter list is three or more items and the second item is a '>',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match params[2:]. For example:
    #     /api/Offering[Service>Domain>%22Service%20Domain%22[_name=Sports]]
    # If the parameter list is three or more items and the second item is a '[',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match the clause in params[2] and any following clauses. For example: 
    #     /api/Service[Domain[%22Service%20Domain%22[_name=Sports]][_name^=B]
    # If the parameter list is three values, interpret the three values as a query clause and
    #     filter self on that clause.  
    def filterClause(self, params, userInfo):
    #     print('_filterClause params: %s'% (params))
        if len(params) == 1:
            if isinstance(params[0], list):
                return Q(referenceValue__value__field__in=map(terms.__getitem__, params[0]), 
                         referenceValue__value__deleteTransaction__isnull=True)
            elif params[0] == '?':
                return Q(referenceValue__value__deleteTransaction__isnull=True) #degenerate case
            else:
                return Q(referenceValue__value__field=terms[params[0]], value__deleteTransaction__isnull=True)
        elif len(params) > 2 and params[1]=='>':
            return self.clauseByReferenceValues(params[0], self.getReferenceValues(params, userInfo))
        elif len(params) > 2 and params[1]=='[':
            subF = InstanceQuerySet(Instance.objects.all()).refineFilter(params[2], userInfo)
            subF.applyFindFilter(userInfo)
            if len(params) > 3:
                parsed = subF.parse(params[3:], userInfo)
                subF = parsed.filterToInstances()
            return self.clauseByReferenceValues(params[0], subF.querySet)
        elif len(params) == 3:
            i = None if params[0] == '?' else \
                map(terms.__getitem__, params[0]) if isinstance(params[0], list) else \
                terms[params[0]]
        
            # Return a Q clause that compares either a single test value or a comma-separated list of test values
            # according to the specified symbol to a list of fields or a single field.
            if isinstance(i, map):
                return reduce(lambda q1, q2: q1 | q2, \
                                    map(lambda field: self.getQClause(field, params[1], params[2]), i))
            else:
                return self.getQClause(i, symbol=params[1], testValue=params[2])
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in params]))

    def applyClause(self, q, i):
        return wrapValueQuerySet(i, self.querySet.filter(q).distinct())
        
    def findableQuerySet(self, userInfo):
        qs = self.querySet
        if userInfo._findValueFilter:
            return qs.filter(userInfo._findValueFilter)
        elif userInfo.is_administrator:
            return qs
        else:
            if not userInfo.is_authenticated:
                userInfo._findValueFilter = Value.anonymousFindFilter()
            else:
                userInfo._findValueFilter = userInfo.instance.findValueFilter
            return qs.filter(userInfo._findValueFilter)

    def readableQuerySet(self, userInfo):
        qs = self.querySet
        if userInfo._readValueFilter:
            return qs.filter(userInfo._readValueFilter)
        elif userInfo.is_administrator:
            return qs
        else:
            if not userInfo.is_authenticated:
                userInfo._readValueFilter = Value.anonymousReadFilter()
            else:
                userInfo._readValueFilter = userInfo.instance.readValueFilter
            return qs.filter(userInfo._readValueFilter)

    def administerableQuerySet(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return []   # If not authenticated, then return an empty iterable.
        elif userInfo.is_administrator:
            return qs
        else:
            return userInfo.instance.administerValueFilter(qs)
            
    @property        
    def types(self):
        return map(lambda i: Instance.objects.get(pk=i),
                   frozenset([x.referenceValue.typeID_id for x in self.querySet]))
    
    def getData(self, fields, fieldNames, fieldsDataDictionary, start, end, userInfo, language):
        self.select_related(fieldNames, userInfo)
        uuObjects = self.querySet.order_by('instance', 'position');
        if end > 0:
            uuObjects = uuObjects[start:end]
        elif start > 0:
            uuObjects = uuObjects[start:]
            
        return [v.getData(fields, fieldsDataDictionary, language, userInfo) for v in uuObjects]        

    def deleteObjects(self, user, nameLists, userInfo, transactionState):
        for value in self.querySet:
            if not value.referenceValue or value.referenceValue.parentValue != value:
                value.checkWriteAccess(userInfo)
                
                value.deepDelete(transactionState)
                if value.isDescriptor:
                    Instance.updateDescriptions([value.instance], nameLists)
            else:
                uuObject = value.referenceValue
                uuObject.checkWriteAccess(userInfo)
                
                for v in uuObject.referenceValues.filter(deleteTransaction__isnull=True):
                    v.markAsDeleted(transactionState)
                    if v.isDescriptor:
                        Instance.updateDescriptions([v.instance], nameLists)

                uuObject.deepDelete(transactionState)

### ReadValueQuerySet is an ValueQuerySet where all users have read access.
class ReadValueQuerySet(ValueQuerySet):

    def __init__(self, querySet=None):
        super(ReadValueQuerySet, self).__init__(querySet)
    
    ### Returns the querySet associated with self.    
    def findableQuerySet(self, userInfo):
        return self.querySet

    ### Returns the querySet associated with self.    
    def readableQuerySet(self, userInfo):
        return self.querySet

    # return an InstanceQuerySet derived from the contents of self.
    def filterToInstances(self):
        return ReadInstanceQuerySet(Instance.objects.filter(referenceValues__in=self.querySet))
        
class InstanceQuerySet(ObjectQuerySet):

    def __init__(self, querySet=None):
        super(InstanceQuerySet, self).__init__(querySet)
        
    def createObjectQuerySet(self, querySet):
        return InstanceQuerySet(querySet)
    
    ### Preloads the querySet of self with associated description and values
    def select_related(self, fieldNames, instanceDataPath, userInfo):
        valueQueryset = ObjectQuerySet.getSubValueQuerySet(Value.objects, userInfo)

        if len(fieldNames):
            # The distinct is required to eliminate duplicate subValues.
            subValues = Value.objects.filter(instance__deleteTransaction__isnull=True,
                                      instance__referenceValues__deleteTransaction__isnull=True,
                                      instance__referenceValues__field__description__text__in=fieldNames)\
                .distinct()
            subValueQueryset = ObjectQuerySet.getSubValueQuerySet(subValues, userInfo)
            valueQueryset =  valueQueryset.prefetch_related(Prefetch('referenceValue__value_set',
                                  queryset=subValueQueryset,
                                  to_attr='subValues'))

        self.querySet = self.querySet.select_related(instanceDataPath + 'description')\
                            .prefetch_related(Prefetch(instanceDataPath + 'value_set',
                                                        queryset=valueQueryset,
                                                        to_attr='values'))
        return self
    
     
    # Return a Q expression that returns all of the instances in this query set.
    def instanceQ(self):
        return Q(pk__in=self.querySet)
    
    ### Returns an instance queryset that excludes instances from the current query set
    ### That contain the specified field.    
    def excludeByField(self, field):
        return type(self)(field,
                          self.querySet.exclude(value__field=field, 
                                                value__deleteTransaction__isnull=True))

    ### Returns an instance queryset that excludes instances from the current query set
    ### that have a field that matches the testValue.    
    def excludeByValue(self, field, symbol, testValue):
        f = self.querySet
        
        if isinstance(testValue, list):
            for test in testValue:
                f = f.exclude(self.getValueQ(field, symbol, test))
        else:
            f = f.exclude(self.getValueQ(field, symbol, testValue))
        
        return type(self)(f)

    # Returns an InstanceQuerySet derived from the contents of self.
    def filterToInstances(self):
        return self
    
    # returns a Q clause to filter instances to those that contain references in 
    # the specified fields to one of the specified referenceValues.
    def clauseByReferenceValues(self, fieldNames, referenceValues):
        if isinstance(referenceValues, ObjectQuerySet):
            raise ValueError("referenceValues is an ObjectQuerySet")
            
        if isinstance(fieldNames, list):
            t = map(terms.__getitem__, fieldNames)
            return Q(value__field__in=t,
                     value__deleteTransaction__isnull=True,
                     value__referenceValue__in=referenceValues), t
        else:
            t = terms[fieldNames]
            return Q(value__field=t,
                     value__deleteTransaction__isnull=True,
                     value__referenceValue__in=referenceValues), t

    def applyClause(self, q, i):
        return wrapInstanceQuerySet(i, self.querySet.filter(q))
        
    def getSimpleAncestorClause(self, symbol, testValue):
        if symbol == '^=':
            q = Q(ancestors__ancestor__value__stringValue__istartswith=testValue)
        elif symbol == '=':
            q = Q(ancestors__ancestor__value__stringValue__iexact=testValue)
        elif symbol == '*=':
            q = Q(ancestors__ancestor__value__stringValue__icontains=testValue)
        elif symbol == '<':
            q = Q(ancestors__ancestor__value__stringValue__lt=testValue)
        elif symbol == '<=':
            q = Q(ancestors__ancestor__value__stringValue__lte=testValue)
        elif symbol == '>':
            q = Q(ancestors__ancestor__value__stringValue__gt=testValue)
        elif symbol == '>=':
            q = Q(ancestors__ancestor__value__stringValue__gte=testValue)
        else:
            raise ValueError("unrecognized symbol: %s" & symbol)
        return q
        # Handles a degenerate case where a referenceValue was stored in the same place as
        # the stringValue and it happens to match the query string, 

    # returns an QuerySet that matches the specified parameters.
    def getReferenceValues(self, params, userInfo):
    #     print('getReferenceValues: %s'%params)
        if len(params) > 2 and params[1] == '>':
            q, i = self.clauseByReferenceValues(params[2], self.getReferenceValues(params[2:], userInfo))
            subF = wrapInstanceQuerySet(i, Instance.objects.filter(q))
        else:
            # Replace the type name with a * for any item, because params[0] contains a field name, not a typeID.
            subF = InstanceQuerySet().parse(['*'] + params[1:], userInfo)
        return userInfo.findFilter(subF)

    # Returns a duple of a Q clause and term(s) according to the specified params.
    # If the parameter list is a single item:
    #     If there is a list, then the object must contain a value with the specified field type.
    #     If there is a question mark, then this is a no-op.
    #     If there is a single term name, then each instance must contain a value of that term.
    # If the parameter list is three or more items and the second item is a '>',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match params[2:]. For example:
    #     /api/Offering[Service>Domain>%22Service%20Domain%22[_name=Sports]]
    # If the parameter list is three or more items and the second item is a '[',
    #     then tighten the filter of the result set for only those fields that are references to objects
    #     that match the clause in params[2] and any following clauses. For example: 
    #     /api/Service[Domain[%22Service%20Domain%22[_name=Sports]][_name^=B]
    # If the parameter list is three values, interpret the three values as a query clause and
    #     filter self on that clause.  
    def filterClause(self, params, userInfo):
#         print('filterClause params: %s'% (params))
    
        if len(params) == 1:
            if isinstance(params[0], list):
                t = list(map(terms.__getitem__, params[0]))
                return Q(value__field__in=t, 
                         value__deleteTransaction__isnull=True), t
            elif params[0] == '?':
                return Q(value__deleteTransaction__isnull=True), None #degenerate case
            else:
                t = terms[params[0]]
                return Q(value__field=t, value__deleteTransaction__isnull=True), t
        elif len(params) == 3 and params[0] == 'TagTarget' and params[1] == '=':
            return Q(value__field=terms['Service'],
                     value__deleteTransaction__isnull=True,
                     value__referenceValue__tag_sources__target_id=params[2]), terms['Service']
        elif len(params) > 2 and params[1]=='>':
            return self.clauseByReferenceValues(params[0], self.getReferenceValues(params, userInfo))
        elif len(params) > 2 and params[1]=='[':
            subF = InstanceQuerySet(Instance.objects.all()).refineFilter(params[2], userInfo)
            subF.applyFindFilter(userInfo)
            if len(params) > 3:
                parsed = subF.parse(params[3:], userInfo)
                subF = parsed.filterToInstances()
            return self.clauseByReferenceValues(params[0], subF.querySet)
        elif len(params) == 3:
            i = None if params[0] == '?' else \
                map(terms.__getitem__, params[0]) if isinstance(params[0], list) else \
                terms[params[0]]
        
            # Return a Q clause that compares either a single test value or a comma-separated list of test values
            # according to the specified symbol to a list of fields or a single field.
            if isinstance(i, map):
                return reduce(lambda q1, q2: q1 | q2, \
                                    map(lambda field: self.getQClause(field, params[1], params[2]), i)), i
            else:
                return self.getQClause(i, symbol=params[1], testValue=params[2]), i
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in params]))

    def findableQuerySet(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return qs.filter(Instance.anonymousFindFilter())
        elif userInfo.is_administrator:
            return qs
        elif userInfo.instance:
            return userInfo.instance.findFilter(qs)
        else:
            return qs.filter(Instance.anonymousFindFilter()) # This case occurs while setting up a user.

    def readableQuerySet(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return qs.filter(Instance.anonymousReadFilter())
        elif userInfo.is_administrator:
            return qs
        else:
            return userInfo.instance.readFilter(qs)

    def administerableQuerySet(self, userInfo):
        qs = self.querySet
        if not userInfo.is_authenticated:
            return []   # If not authenticated, then return an empty iterable.
        elif userInfo.is_administrator:
            return qs
        else:
            return userInfo.instance.administerFilter(qs)
    
    @property        
    def types(self):
        return map(lambda i: Instance.objects.get(pk=i),
                   frozenset([x.typeID_id for x in self.querySet]))
    
    def getData(self, fields, fieldNames, fieldsDataDictionary, start, end, userInfo, language):
        self.select_related(fieldNames, '', userInfo)
        
        uuObjects = self.querySet.order_by('description__text', 'id');
        if end > 0:
            uuObjects = uuObjects[start:end]
        elif start > 0:
            uuObjects = uuObjects[start:]

        return [i.getData(fields, fieldsDataDictionary, language, userInfo) for i in uuObjects]        

    def deleteObjects(self, user, nameLists, userInfo, transactionState):
        for uuObject in self.querySet:
            for v in uuObject.referenceValues.filter(deleteTransaction__isnull=True):
                v.markAsDeleted(transactionState)
                if v.isDescriptor:
                    Instance.updateDescriptions([v.instance], nameLists)

            uuObject.deepDelete(transactionState)

### ReadInstanceQuerySet is an InstanceQuerySet where all users have read access.
class ReadInstanceQuerySet(InstanceQuerySet):

    def __init__(self, querySet=None):
        super(ReadInstanceQuerySet, self).__init__(querySet)
    
    ### Returns the querySet associated with self.    
    def findableQuerySet(self, userInfo):
        return self.querySet

    ### Returns the querySet associated with self.    
    def readableQuerySet(self, userInfo):
        return self.querySet

### Returns either a ReadValueQuerySet or a ValueQuerySet depending on whether
### or not the objects of the term need to be secured.
def wrapValueQuerySet(t, qs=None):
    if isinstance(t, list) or isinstance(t, map):
        isGlobal = reduce(lambda a, b: a and b,
                          map(lambda i: i.getSubInstance('of kind') != None, t),
                          True)
    else:
        isGlobal = t != None and t.getSubInstance('of kind') != None
        
    return ReadValueQuerySet(qs) if isGlobal else ValueQuerySet(qs)
    
### Returns either a ReadInstanceQuerySet or a InstanceQuerySet depending on whether
### or not the objects of the term need to be secured.
def wrapInstanceQuerySet(t, qs=None):
    if isinstance(t, list) or isinstance(t, map):
        isGlobal = reduce(lambda a, b: a and b,
                          map(lambda i: i.getSubInstance('of kind') != None, t),
                          True)
    else:
        isGlobal = t != None and t.getSubInstance('of kind') != None
        
    return ReadInstanceQuerySet(qs) if isGlobal else InstanceQuerySet(qs)

### A Multiple Picked Value
class UserGrant(AccessInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUserGrants')
    lastTransaction = lastTransactionField('changedUserGrants')
    deleteTransaction = deleteTransactionField('deletedUserGrants')

    grantor_id = dbmodels.UUIDField(editable=False, db_index=True)
    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='grantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantee': ('grantee__', 'User', 'grantees'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == UserGrant:
            return qs, accessType
        elif not user:
            return qs.none(), UserGrant
        elif user.is_administrator:
            return qs, UserGrant
        else:
            return AccessInstance.administrableQuerySet(qs, user, ''), UserGrant

    def filterForGetData(qs, user, accessType):
        return UserGrant.getSubClause(qs, user, accessType)[0]
            
    def order_by(queryset, context):
        return queryset.filter(Q(grantee__emails__deleteTransaction__isnull=True)& 
                               Q(grantee__emails__position=0))\
                       .order_by('grantee__emails__text')
    
    def create(parent, data, context, newIDs={}):
        if not context.canAdminister(parent):
           raise PermissionDenied('you do not have permission to administer this user')
        
        grantee = _orNoneForeignKey(data, 'grantee', context, User)
        if not grantee:
            raise ValueError("the grantee for a new user grant is not specified")
        elif type(grantee) != User:
            raise ValueError("the grantee for a new user grant is not a user: %s(%s)" % (str(type(grantee)), str(grantee)))
            
        if 'privilege' not in data:
            raise ValueError("the privilege for a new user grant is not specified")
        elif data['privilege'] not in ['find', 'read', 'register', 'write', 'administer']:
            raise ValueError('the privilege "%s" is not recognized' % data['privilege'])
            
        oldItem = parent.userGrants.filter(deleteTransaction__isnull=True,
                                           grantor_id=parent.id,
                                           grantee=grantee)
        if oldItem.exists():
            if parent == context.user:
                raise ValueError('%s is already following you' % str(grantee))
            else:
                raise ValueError('%s is already following %s' % (str(grantee), str(parent)))

        newItem = UserGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=parent.id,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, User),
                                 privilege=_orNone(data, 'privilege'))
        
        # Remove any corresponding access requests.
        vs = parent.userGrantRequests.filter(deleteTransaction__isnull=True,
                                             grantee=grantee)
        for v in vs:
            v.markDeleted(context)
    
        # Notify the grantee that they have been accepted.
        n = Notification.objects.create(transaction=context.transaction,
            lastTransaction=context.transaction,
            parent=grantee,
            name='crn.FollowerAccept',
            isFresh='yes')
        na=NotificationArgument.objects.create(transaction=context.transaction,
            lastTransaction=context.transaction,
            parent=n,
            position=0,
            argument=parent.id.hex)

        return newItem                          
        
class UserGrantHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userGrantHistories')
    instance = historyInstanceField(UserGrant)

    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='granteeHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

### A Multiple Picked Value
class GroupGrant(AccessInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroupGrants')
    lastTransaction = lastTransactionField('changedGroupGrants')
    deleteTransaction = deleteTransactionField('deletedGroupGrants')

    grantor_id = dbmodels.UUIDField(editable=False, db_index=True)
    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='grantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantee': ('grantee__', 'Group', 'grantees'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == GroupGrant:
            return qs, accessType
        elif not user:
            return qs.none(), GroupGrant
        elif user.is_administrator:
            return qs, GroupGrant
        else:
            return AccessInstance.administrableQuerySet(qs, user, ''), GroupGrant

    def filterForGetData(qs, user, accessType):
        return GroupGrant.getSubClause(qs, user, accessType)[0]
            
    def order_by(queryset, context):
        return queryset.filter(Q(grantee__names__deleteTransaction__isnull=True)& 
                               (Q(grantee__names__languageCode=context.languageCode)|(Q(grantee__names__languageCode='en')&~Q(grantee__names__parent__names__languageCode=context.languageCode))))\
                       .order_by('grantee__names__text')
    
    def create(parent, data, context, newIDs={}):
        if not context.canAdminister(parent):
           raise PermissionDenied('you do not have permission to administer this user')
        
        grantee = _orNoneForeignKey(data, 'grantee', context, Group)
        if not grantee:
            raise ValueError("the grantee for a new group grant is not specified")
            
        if 'privilege' not in data:
            raise ValueError("the privilege for a new group grant is not specified")
        elif data['privilege'] not in ['find', 'read', 'register', 'write', 'administer']:
            raise ValueError('the privilege "%s" is not recognized' % data['privilege'])
            
        oldItem = parent.groupGrants.filter(deleteTransaction__isnull=True,
                                           grantor=parent,
                                           grantee=grantee)
        if oldItem.exists():
            if parent == context.user:
                raise ValueError('%s is already following you' % str(grantee))
            else:
                raise ValueError('%s is already following %s' % (str(grantee), str(parent)))

        newItem = GroupGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=parent.id,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, Group),
                                 privilege=_orNone(data, 'privilege'))
        
        return newItem                          
        
class GroupGrantHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('groupAccessHistories')
    instance = historyInstanceField(GroupGrant)

    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='granteeHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

class Address(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdAddresses')
    lastTransaction = lastTransactionField('changedAddresses')
    deleteTransaction = deleteTransactionField('deletedAddresses')

    parent = parentField('consentrecords.Site', 'addresses')
    city = dbmodels.CharField(max_length=255, db_index=True, null=True)
    state = dbmodels.CharField(max_length=255, db_index=True, null=True)
    zipCode = dbmodels.CharField(max_length=255, db_index=True, null=True)
    
    class Meta:
        verbose_name_plural = 'Addresses'
    
    fieldMap = {'city': 'city',
                'state': 'state',
                'zip code': 'zipCode',
               }
               
    elementMap = {'street': ('streets__', "Street", 'parent'),
                 }
    
    def description(self, language=None):
        streets = ' '.join(map(lambda s: s.text, self.streets.filter(deleteTransaction=self.deleteTransaction).order_by('position')))
        if streets: streets = streets + ' '
        return streets + ('%s, %s  %s' % (self.city or '', self.state or '', self.zipCode or '')) 
        
    def __str__(self):
        return self.description() 

    def select_related(querySet, fields=[]):
        return querySet.prefetch_related(Prefetch('streets', 
                           queryset=Street.select_related(Street.objects.filter(deleteTransaction__isnull=True)).order_by('position'),
                           to_attr='currentStreets'))
    
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.city:
                data['city'] = self.city
            if self.state:
                data['state'] = self.state
            if self.zipCode:
                data['zip code'] = self.zipCode
            if 'streets' in fields:
                data['streets'] = [i.getData([], context) for i in self.currentStreets]
            else:
                data['streets'] = [i.headData(context) for i in self.currentStreets]
        
        return data
    
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, prefix='parent__parent')
            
    def markDeleted(self, context):
        for i in self.streets.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Address, self).markDeleted(context)
    
    def valueCheckState(data, key):
        if key not in data:
            return
        if len(data[key]) < 2 or len(data[key]) > 3:
            raise ValueError("a state must be described by a two or three letter code")
        
    def valueCheckZipCode(data, key):
        if key not in data:
            return
        if re.search('^[0-9]{5}$', data[key]):
            return
        if re.search('^[0-9]{5}-[0-9]{4}$', data[key]):
            return
        raise ValueError('a zip code must be five digits or five digits followed by "-" followed by and four digits')
        
    def create(parent, data, context, newIDs={}):
        Address.valueCheckState(data, 'state')
        Address.valueCheckZipCode(data, 'zip code')
        newItem = Address.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 city=_orNone(data, 'city'),
                                 state=_orNone(data, 'state'),
                                 zipCode=_orNone(data, 'zip code'),
                                )
        
        newItem.createChildren(data, 'streets', context, Street, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return AddressHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             city=self.city,
                                             state=self.state,
                                             zipCode=self.zipCode)
        
    def revert(self, h):
        self.city = h.city 
        self.state = h.state 
        self.zipCode = h.zipCode 
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'city' in changes and changes['city'] != self.city:
            history = history or self.buildHistory(context)
            self.city = changes['city'] or None
        if 'state' in changes and changes['state'] != self.state:
            Address.valueCheckState(changes, 'state')
            history = history or self.buildHistory(context)
            self.state = changes['state'] or None
        if 'zip code' in changes and changes['zip code'] != self.state:
            Address.valueCheckZipCode(changes, 'zip code')
            history = history or self.buildHistory(context)
            self.zipCode = changes['zip code'] or None
        
        self.updateChildren(changes, 'streets', context, Street, self.streets, newIDs)
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class AddressHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('addressHistories')
    instance = historyInstanceField(Address)

    city = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    state = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    zipCode = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

class Comment(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdComments')
    lastTransaction = lastTransactionField('changedComments')
    deleteTransaction = deleteTransactionField('deletedComments')

    parent = parentField('consentrecords.Experience', 'comments')
    text = dbmodels.CharField(max_length=1023, db_index=True, null=True)
    question = dbmodels.CharField(max_length=1023, db_index=True, null=True)
    asker = dbmodels.ForeignKey('consentrecords.Path', related_name='askedComments', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    
    fieldMap = {'text': 'text',
                'question': 'question',
               }
               
    elementMap = {'asker': ('asker__', 'Path', 'askedComments'),
                 }
                 
    def description(self, languageCode=None):
        return str(self.transaction.creation_time);
        
    def __str__(self):
        return self.description()
        
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        return querySet.select_related('asker')
        
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.text:
                data['text'] = self.text
            if self.asker:
                data['asker'] = self.asker.headData(context)
            if self.question:
                data['question'] = self.question
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent__parent'), Path

    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent__parent')
            
    def order_by(queryset, context):
        return queryset.order_by('transaction__creation_time')
    
    def markDeleted(self, context):
        # When deleting a comment, delete any notifications that refer to that comment.
        for i in Notification.objects.filter(deleteTransaction__isnull=True,
            notificationArguments__argument=self.id):
            i.markDeleted(context)
            
        super(Comment, self).markDeleted(context)
    
    def create(parent, data, context, newIDs={}):
        question = _orNone(data, 'question')
        askerPath = _orNoneForeignKey(data, 'asker', context, Path)
        if not (context.canWrite(parent) or \
                (askerPath and question and context.user and askerPath == context.user.path and context.canRead(parent))):
           raise PermissionDenied('you do not have permission to create this comment')
        
        newItem = Comment.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 text = _orNone(data, 'text'),
                                 question = question,
                                 asker = askerPath,
                                )
                                
        if not newItem.text and newItem.question and newItem.asker \
            and newItem.asker.id != parent.parent.id:
            n = Notification.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        name='crn.ExperienceCommentRequested',
                                        isFresh='yes',
                                        parent=parent.parent.parent,
                                        )
            NotificationArgument.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        parent=n,
                                        position=0,
                                        argument=newItem.asker.id.hex)
            NotificationArgument.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        parent=n,
                                        position=1,
                                        argument=parent.id.hex)
            NotificationArgument.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        parent=n,
                                        position=2,
                                        argument=newItem.id.hex)
            
            # Send an email to the following user.
            recipient = parent.parent.parent
            recipientEMail = recipient.emails.filter(deleteTransaction__isnull=True).order_by('position')[0].text
            path = parent.parent
            salutation = path.name or recipient.firstName
            
            # Send an email to the recipient that they have a question.
            Emailer.sendRequestExperienceCommentEmail(settings.PASSWORD_RESET_SENDER, 
                salutation,
                recipientEMail,
                parent,
                askerPath.caption(context),
                (askerPath.id.hex == context.user.path.id.hex and \
                 context.authUser.is_staff),
                question,
                newItem,
                context.hostURL)
        
        return newItem

    def buildHistory(self, context):
        if self.lastTransaction == context.transaction:
            return True # history has already been built
        else:
            return CommentHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             text=self.text,
                                             question=self.question,
                                             asker=self.asker)
        
    def revert(self, h):
        self.text = h.text 
        self.question = h.question 
        self.asker = h.asker 
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise PermissionDenied('you do not have permission to complete this update')
        
        history = None
        if 'text' in changes and changes['text'] != self.text:
            history = history or self.buildHistory(context)
            self.text = changes['text'] or None
        if 'question' in changes and changes['question'] != self.question:
            history = history or self.buildHistory(context)
            self.question = changes['question'] or None
        if 'asker' in changes:
            newAsker = _orNoneForeignKey(changes, 'asker', context, Path)
            if newAsker != self.asker:
                history = history or self.buildHistory(context)
                self.asker = newAsker
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class CommentHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentHistories')
    instance = historyInstanceField(Comment)
    
    text = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    question = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    asker = dbmodels.ForeignKey('consentrecords.Path', related_name='askedCommentHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

class CommentPrompt(RootInstance, PublicInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdCommentPrompts')
    lastTransaction = lastTransactionField('changedCommentPrompts')
    deleteTransaction = deleteTransactionField('deletedCommentPrompts')
    
    fieldMap = {}
    
    elementMap = {'translation': ('texts__', 'CommentPromptText', 'parent'),
                 }
                 
    @property
    def names(self):
        return self.texts
    
    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('texts',
                                                  queryset=CommentPromptText.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return CommentPrompt.select_head_related(querySet)
    
    def getData(self, fields, context):
        data = self.headData(context)
        data['translations'] = [i.getData([], context) for i in self.currentNames]
        return data
        
    def order_by(queryset, context):
        return queryset.filter(Q(texts__deleteTransaction__isnull=True)& 
                               (Q(texts__languageCode=context.languageCode)|(Q(texts__languageCode='en')&~Q(texts__parent__texts__languageCode=context.languageCode))))\
                       .order_by('texts__text')
    
    def markDeleted(self, context):
        for i in self.texts.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(CommentPrompt, self).markDeleted(context)
    
    def create(data, context, newIDs={}):
        if not context.is_administrator:
           raise PermissionDenied
        
        newItem = CommentPrompt.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                )
        
        newItem.createChildren(data, 'translations', context, CommentPromptText, newIDs)
        
        return newItem                          
        
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        self.updateChildren(changes, 'translations', context, CommentPromptText, self.texts, newIDs)
                                                         
class CommentPromptHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentPromptHistories')
    instance = historyInstanceField(CommentPrompt)
    
class CommentPromptText(TranslationInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdCommentPromptTexts')
    lastTransaction = lastTransactionField('changedCommentPromptTexts')
    deleteTransaction = deleteTransactionField('deletedCommentPromptTexts')

    parent = parentField(CommentPrompt, 'texts')
    text = dbmodels.CharField(max_length=1023, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(CommentPromptText.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return CommentPromptTextHistory

class CommentPromptTextHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentPromptTextHistories')
    instance = historyInstanceField(CommentPromptText)

    text = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class DisqualifyingTag(ServiceLinkInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdDisqualifyingTags')
    lastTransaction = lastTransactionField('changedDisqualifyingTags')
    deleteTransaction = deleteTransactionField('deletedDisqualifyingTags')
    
    parent = parentField('consentrecords.ExperiencePrompt', 'disqualifyingTags')
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='disqualifyingTags', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {}
    
    elementMap = {'service': ('service__', 'Service', 'disqualifyingTags'),
                 }

    def __str__(self):
        return str(self.service)

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = DisqualifyingTag.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        
        return newItem                          
        
    @property
    def historyType(self):
        return DisqualifyingTagHistory

class DisqualifyingTagHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('disqualifyingTagHistories')
    instance = historyInstanceField(DisqualifyingTag)

    service = dbmodels.ForeignKey('consentrecords.Service', related_name='disqualifyingTagHistories', db_index=True, editable=True, on_delete=dbmodels.CASCADE)

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.service or '-')
           
class Engagement(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdEngagements')
    lastTransaction = lastTransactionField('changedEngagements')
    deleteTransaction = deleteTransactionField('deletedEngagements')

    parent = parentField('consentrecords.Session', 'engagements')
    user = dbmodels.ForeignKey('consentrecords.User', related_name='userEngagements', db_index=True, on_delete=dbmodels.CASCADE)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'start': 'start',
                'end': 'end',
               }
    
    elementMap = {'user': ('user__', 'User', 'userEngagements'),
                  'session': ('parent__', 'Session', 'engagements'),
                 }

    def description(self, languageCode=None):
        return self.user.description(languageCode)
        
    def __str__(self):
        return str(self.user)

    def select_head_related(querySet):
        return querySet.select_related('user')
        
    def select_related(querySet, fields=[]):
        qs = querySet.select_related('user')
        if 'offering' in fields:
            qs = qs.prefetch_related(Prefetch('parent__parent',
                                              queryset=Offering.select_head_related(Offering.objects.filter(deleteTransaction__isnull=True)),
                                              to_attr='currentOfferings'))
        if 'site' in fields:
            qs = qs.prefetch_related(Prefetch('parent__parent__parent',
                                              queryset=Site.select_head_related(Site.objects.filter(deleteTransaction__isnull=True)),
                                              to_attr='currentSites'))
        if 'organization' in fields:
            qs = qs.prefetch_related(Prefetch('parent__parent__parent__parent',
                                              queryset=Organization.select_head_related(Organization.objects.filter(deleteTransaction__isnull=True)),
                                              to_attr='currentOrganizations'))
        return qs
        
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.user:
                data['user'] = self.user.headData(context)
            if self.start:
                data['start'] = self.start
            if self.end:
                data['end'] = self.end
            if 'organization' in fields:
                data['organization'] = self.parent.parent.parent.currentOrganizations.headData(context)
            if 'site' in fields:
                data['site'] = self.parent.parent.currentSites.headData(context)
            if 'offering' in fields:
                data['offering'] = self.parent.currentOfferings.headData(context)
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, prefix='parent__parent__parent__parent')
            
    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def create(parent, data, context, newIDs={}):
        newItem = Engagement.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                 start=_orNone(data, 'start'),
                                 end=_orNone(data, 'end'),
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return EngagementHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             user=self.user,
                                             start=self.start,
                                             end=self.end)
        
    def revert(self, h):
        self.user = h.user 
        self.start = h.start 
        self.end = h.end 
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'user' in changes:
            newUser = _orNoneForeignKey(changes, 'user', context, User)
            if newUser != self.user:
                history = history or self.buildHistory(context)
                self.user = newUser
        if 'start' in changes and changes['start'] != self.start:
            _validateDate(changes, 'start')
            history = history or self.buildHistory(context)
            self.start = changes['start'] or None
        if 'end' in changes and changes['end'] != self.end:
            _validateDate(changes, 'end')
            history = history or self.buildHistory(context)
            self.end = changes['end'] or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class EngagementHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('engagementHistories')
    instance = historyInstanceField(Engagement)

    user = dbmodels.ForeignKey('consentrecords.User', related_name='userEngagementHistories', db_index=True, on_delete=dbmodels.CASCADE)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

class Enrollment(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdEnrollments')
    lastTransaction = lastTransactionField('changedEnrollments')
    deleteTransaction = deleteTransactionField('deletedEnrollments')

    parent = parentField('consentrecords.Session', 'enrollments')
    user = dbmodels.ForeignKey('consentrecords.User', related_name='userEnrollments', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {}
    
    elementMap = {'user': ('user__', 'User', 'userEnrollments'),
                 }

    def description(self, languageCode=None):
        return self.user.description(languageCode)
        
    def __str__(self):
        return str(self.user)

    def select_head_related(querySet):
        return querySet.select_related('user')
        
    def select_related(querySet, fields=[]):
        return querySet.select_related('user')
        
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.user:
                data['user'] = self.user.headData(context)
        
        return data
    
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, prefix='parent__parent__parent__parent')
            
    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def create(parent, data, context, newIDs={}):
        newItem = Enrollment.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return EnrollmentHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             user=self.user)
        
    def revert(self, h):
        self.user = h.user 
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'user' in changes:
            newUser = _orNoneForeignKey(changes, 'user', context, User)
            if newUser != self.user:
                history = history or self.buildHistory(context)
                self.user = newUser
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class EnrollmentHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('enrollmentHistories')
    instance = historyInstanceField(Enrollment)

    user = dbmodels.ForeignKey('consentrecords.User', related_name='userEnrollmentHistories', db_index=True, on_delete=dbmodels.CASCADE)

class Experience(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdExperiences')
    lastTransaction = lastTransactionField('changedExperiences')
    deleteTransaction = deleteTransactionField('deletedExperiences')

    parent = parentField('consentrecords.Path', 'experiences')
    organization = dbmodels.ForeignKey('consentrecords.Organization', related_name='experiences', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    customOrganization = dbmodels.CharField(max_length=255, db_index=True, null=True)
    site = dbmodels.ForeignKey('consentrecords.Site', related_name='experiences', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    customSite = dbmodels.CharField(max_length=255, db_index=True, null=True)
    offering = dbmodels.ForeignKey('consentrecords.Offering', related_name='experiences', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    customOffering = dbmodels.CharField(max_length=255, db_index=True, null=True)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True)
    timeframe = dbmodels.CharField(max_length=10, db_index=True, null=True)
    
    fieldMap = {'custom organization': 'customOrganization',
                'custom site': 'customSite',
                'custom offering': 'customOffering',
                'start': 'start',
                'end': 'end',
                'timeframe': 'timeframe',
               }
               
    elementMap = {'organization': ('organization__', "Organization", 'experiences'),
                  'site': ('site__', "Site", 'experiences'),
                  'offering': ('offering__', "Offering", 'experiences'),
                  'custom service': ('customServices__', "ExperienceCustomService", 'parent'),
                  'service': ('services__', "ExperienceService", 'parent'),
                  'comment': ('comments__', "Comment", 'parent'),
                  'implication': ('experienceImplications__', "ExperienceImplication", 'experience'),
                 }
                 
    @property
    def currentNamesQuerySet(self):
        return self.currentNames if 'currentNames' in self.__dict__ else self.offering.names.filter(deleteTransaction__isnull=True)

    def description(self, languageCode=None):
        if self.offering_id:
            return IInstance.getName(self.currentNamesQuerySet, languageCode)
        elif self.customOffering:
            return self.customOffering
        else:
            return 'Unnamed Offering'
    
    def __str__(self):
        return self.description(None)
    
    def select_head_related(querySet):
        return querySet.select_related('parent')\
                       .select_related('offering')\
                       .prefetch_related(Prefetch('offering__names',
                                                  queryset=OfferingName.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
    
    def select_related(querySet, fields=[]):
        csqs = ExperienceCustomService.objects.filter(deleteTransaction__isnull=True).order_by('position')
        sqs = ExperienceService.objects.filter(deleteTransaction__isnull=True).order_by('position')
        qs = Experience.select_head_related(querySet).select_related('organization')\
                       .select_related('site')\
                       .prefetch_related(Prefetch('customServices', 
                           queryset= (ExperienceCustomService.select_related(csqs)
                               if 'custom services' in fields else \
                               ExperienceCustomService.select_head_related(csqs)),
                           to_attr='currentCustomServices'))\
                       .prefetch_related(Prefetch('services', 
                           queryset=(ExperienceService.select_related(sqs)
                               if 'services' in fields else \
                               ExperienceCustomService.select_head_related(sqs)),
                           to_attr='currentServices'))
        if 'comments' in fields:
            qs = qs.prefetch_related(Prefetch('comments',
                Comment.select_related(Comment.objects.filter(deleteTransaction__isnull=True)).order_by('transaction__creation_time'),
                                              to_attr='currentComments'))
        return qs
            
    
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.customOrganization:
                data['custom organization'] = self.customOrganization
            if self.customSite:
                data['custom site'] = self.customSite
            if self.customOffering:
                data['custom offering'] = self.customOffering
            if self.organization_id:
                if 'organization' in fields:
                    data['organization'] = self.organization.getData([], context)
                else:
                    data['organization'] = self.organization.headData(context)
            if self.site_id:
                if 'site' in fields:
                    data['site'] = self.site.getData([], context)
                else:
                    data['site'] = self.site.headData(context)
            if self.offering_id:
                if 'offering' in fields:
                    offeringFields = list(map(lambda s: s[len('offering/'):], 
                        filter(lambda s: s.startswith('offering/'), fields)))
                    data['offering'] = self.offering.getData(offeringFields, context)
                else:
                    data['offering'] = self.offering.headData(context)
            if 'services' in fields:
                data['services'] = [i.getData([], context) for i in self.currentServices]
            else:
                data['services'] = [i.headData(context) for i in self.currentServices]
            if 'custom services' in fields:
                data['custom services'] = [i.getData([], context) for i in self.currentCustomServices]
            else:
                data['custom services'] = [i.headData(context) for i in self.currentCustomServices]
            if self.start:
                data['start'] = self.start
            if self.end:
                data['end'] = self.end
                
            if 'comments' in fields:
                data['comments'] = [i.getData([], context) for i in self.currentComments];
            if self.timeframe:
                data['timeframe'] = self.timeframe
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent'), Path

    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent')
            
    def markDeleted(self, context):
        for i in self.customServices.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.services.filter(deleteTransaction__isnull=True):
            i.markDeleted(context, needToCheck=False)
        for i in self.comments.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        
        # When deleting an experience, delete any notifications that refer to that comment.
        for i in Notification.objects.filter(deleteTransaction__isnull=True,
            notificationArguments__argument=self.id):
            i.markDeleted(context)
        
        # Delete all of the experience implications.   
        self.experienceImplications.all().delete()
            
        super(Experience, self).markDeleted(context)
    
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
        
        ExperiencePrompt.validateTimeframe(data, 'timeframe')
        _validateDate(data, 'start')
        _validateDate(data, 'end')
        if 'start' in data and 'end' in data and data['start'] > data['end']:
            raise ValueError('the start date of an experience cannot be after the end date of the experience')
             
        newItem = Experience.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 organization = _orNoneForeignKey(data, 'organization', context, Organization),
                                 customOrganization = _orNone(data, 'custom organization'),
                                 site = _orNoneForeignKey(data, 'site', context, Site),
                                 customSite = _orNone(data, 'custom site'),
                                 offering = _orNoneForeignKey(data, 'offering', context, Offering),
                                 customOffering = _orNone(data, 'custom offering'),
                                 timeframe = _orNone(data, 'timeframe'),
                                 start = _orNone(data, 'start'),
                                 end = _orNone(data, 'end'),
                                )
        
        newItem.createChildren(data, 'services', context, ExperienceService, newIDs)
        newItem.createChildren(data, 'custom services', context, ExperienceCustomService, newIDs)
        newItem.createChildren(data, 'comments', context, Comment, newIDs)
        
        if newItem.offering: newItem.checkImplications()
        
        return newItem
        
    def checkImplications(self):
        serviceSet = set()
        for es in self.services.filter(deleteTransaction__isnull=True):
            for imp in es.service.serviceImplications.filter(deleteTransaction__isnull=True):
                serviceSet.add(imp.impliedService)
        if self.offering:
            for os in self.offering.services.filter(deleteTransaction__isnull=True):
                for imp in os.service.serviceImplications.filter(deleteTransaction__isnull=True):
                    serviceSet.add(imp.impliedService)
        
        # For each existing service implication, either remove it from the service
        # set if it is there, or delete it from the database.
        for ei in self.experienceImplications.all():
            if ei.service in serviceSet:
                serviceSet.remove(ei.service)
            else:
                ei.delete()
        
        # For any leftever elements in the service set, create experience implications.     
        for s in serviceSet:
            ExperienceImplication.objects.create(experience=self, service=s)

    def buildHistory(self, context):
        return ExperienceHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             organization=self.organization,
                                             customOrganization=self.customOrganization,
                                             site=self.site,
                                             customSite=self.customSite,
                                             offering=self.offering,
                                             customOffering=self.customOffering,
                                             start=self.start,
                                             end=self.end,
                                             timeframe=self.timeframe)
        
    def revert(self, h):
        self.organization = h.organization 
        self.customOrganization = h.customOrganization 
        self.site = h.site 
        self.customSite = h.customSite 
        self.offering = h.offering 
        self.customOffering = h.customOffering 
        self.start = h.start 
        self.end = h.end 
        self.timeframe = h.timeframe 
           
    def update(self, changes, context, newIDs={}):
        history = None

        if context.canWrite(self):
            ExperiencePrompt.validateTimeframe(changes, 'timeframe')
            _validateDate(changes, 'start')
            _validateDate(changes, 'end')
            testStart = changes['start'] if 'start' in changes and changes['start'] else (self.start or "0000-00-00")
            testEnd = changes['end'] if 'end' in changes and changes['end'] else (self.end or "9999-99-99")
            if testStart > testEnd:
                raise ValueError("the start date of an experience cannot be after the end date of the experience")

            if 'organization' in changes:
                newValue = _orNoneForeignKey(changes, 'organization', context, Organization)
                if newValue != self.organization:
                    history = history or self.buildHistory(context)
                    self.organization = newValue
            if 'custom organization' in changes and changes['custom organization'] != self.customOrganization:
                history = history or self.buildHistory(context)
                self.customOrganization = changes['custom organization']
            if 'site' in changes:
                newValue = _orNoneForeignKey(changes, 'site', context, Site)
                if newValue != self.site:
                    history = history or self.buildHistory(context)
                    self.site = newValue
            if 'custom site' in changes and changes['custom site'] != self.customSite:
                history = history or self.buildHistory(context)
                self.customSite = changes['custom site']
            if 'offering' in changes:
                newValue = _orNoneForeignKey(changes, 'offering', context, Offering)
                if newValue != self.offering:
                    history = history or self.buildHistory(context)
                    self.offering = newValue
                    # Check that all of the services associated with this experience are correct.
                    self.checkImplications()
            if 'custom offering' in changes and changes['custom offering'] != self.customOffering:
                history = history or self.buildHistory(context)
                self.customOffering = changes['custom offering']
            if 'start' in changes and changes['start'] != self.start:
                history = history or self.buildHistory(context)
                self.start = changes['start']
            if 'end' in changes and changes['end'] != self.end:
                history = history or self.buildHistory(context)
                self.end = changes['end']
            if 'timeframe' in changes and changes['timeframe'] != self.timeframe:
                history = history or self.buildHistory(context)
                self.timeframe = changes['timeframe']
        
            self.updateChildren(changes, 'services', context, ExperienceService, self.services, newIDs)
            self.updateChildren(changes, 'custom services', context, ExperienceCustomService, self.customServices, newIDs)
        
        if context.canRead(self):
            self.updateChildren(changes, 'comments', context, Comment, self.comments, newIDs)

        if history:
            self.lastTransaction = context.transaction
            self.save()
    
    @property
    def impliedServicesQuerySet(self):
        return Service.objects.filter(deleteTransaction__isnull=True,
            implyingService__deleteTransaction__isnull=True,
            implyingService__experienceServices__deleteTransaction__isnull=True,
            implyingService__experienceServices__parent=self)\
            .union(Service.objects.filter(deleteTransaction__isnull=True,
            implyingService__deleteTransaction__isnull=True,
            implyingService__offeringServices__deleteTransaction__isnull=True,
            implyingService__offeringServices__parent__experiences=self))

    def cacheImplications(self):
        ExperienceImplication.objects.filter(experience=self).delete()
        ExperienceImplication.objects.bulk_create(\
            [ExperienceImplication(experience=self, service=s) for s in self.impliedServicesQuerySet])
            
class ExperienceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experienceHistories')
    instance = historyInstanceField(Experience)

    organization = dbmodels.ForeignKey('consentrecords.Organization', related_name='experienceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    customOrganization = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    site = dbmodels.ForeignKey('consentrecords.Site', related_name='experienceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    customSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    offering = dbmodels.ForeignKey('consentrecords.Offering', related_name='experienceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    customOffering = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    timeframe = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

class ExperienceImplication(dbmodels.Model):
    id = idField()
    experience = dbmodels.ForeignKey('consentrecords.Experience', related_name='experienceImplications', db_index=True, null=False, on_delete=dbmodels.CASCADE)
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experienceImplications', db_index=True, null=False, on_delete=dbmodels.CASCADE)
    
    fieldMap = {}
                
    elementMap = {'experience': ('experience__', 'Experience', 'experienceImplications'),
                  'service': ('service__', 'Service', 'experienceImplications'),
                 }
    
class ExperienceCustomService(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdExperienceCustomServices')
    lastTransaction = lastTransactionField('changedExperienceCustomServices')
    deleteTransaction = deleteTransactionField('deletedExperienceCustomServices')

    parent = parentField(Experience, 'customServices')
    position = dbmodels.IntegerField()
    name = dbmodels.CharField(max_length=255, db_index=True, null=True)

    fieldMap = {'name': 'name',
                'position': 'position'}
                
    elementMap = {}
    
    def description(self, languageCode=None):
        return self.name
    
    def __str__(self):
        return self.name
    
    def getData(self, fields, context):
        data = self.headData(context)
        data['position'] = self.position
        if self.name:
            data['name'] = self.name
        return data
        
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        return querySet
        
    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent__parent'), Path

    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent__parent')
    
    def order_by(queryset, context):
        return queryset.order_by('position')
                
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
        
        if 'name' not in data or not data['name']:
            raise ValueError('the name of a custom service is required.')
        
        newItem = ExperienceCustomService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=data['position'],
                                 name=data['name'],
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return ExperienceCustomServiceHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             position=self.position,
                                             name=self.name)
        
    def revert(self, h):
        self.position = h.position 
        self.name = h.name 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'name' in changes and changes['name'] != self.name:
            if not changes['name']:
                raise ValueError('the name of a custom service is required.')
            history = history or self.buildHistory(context)
            self.name = changes['name'] or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class ExperienceCustomServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experienceCustomServiceHistories')
    instance = historyInstanceField(ExperienceCustomService)
    position = dbmodels.IntegerField()
    name = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

class ExperienceService(OrderedServiceLinkInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdExperienceServices')
    lastTransaction = lastTransactionField('changedExperienceServices')
    deleteTransaction = deleteTransactionField('deletedExperienceServices')

    parent = parentField(Experience, 'services')
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experienceServices', db_index=True, null=True, on_delete=dbmodels.CASCADE)

    def __str__(self):
        return str(self.service)
    
    fieldMap = {'position': 'position',
               }
               
    elementMap = {'service': ('service__', "Service", 'experienceServices'),
                 }
                 
    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent__parent'), Path
    
    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent__parent')
            
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
        
        service = _orNoneForeignKey(data, 'service', context, Service)
        if not service:
            raise ValueError("service of a new experience service is not specified")
            
        newItem = ExperienceService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=data['position'],
                                 service=service,
                                )
                                
        newItem.createImplications()
        
        return newItem
        
    def createImplications(self):
        serviceSet = set()
        for s in self.service.implication.all():
            serviceSet.add(s)
        
        # for each existing service implication, remove it from the service
        # set if it is there.
        for ei in self.parent.experienceImplications.all():
            if ei.service in serviceSet:
                serviceSet.remove(ei.service)
        
        # For any leftever elements in the service set, create experience implications.     
        for s in serviceSet:
            ExperienceImplication.objects.get_or_create(experience=self.parent, service=s)
        
    def markDeleted(self, context, needToCheck=True):
        super(ExperienceService, self).markDeleted(context)
        if needToCheck:
            self.parent.checkImplications()

    @property
    def historyType(self):
        return ExperienceServiceHistory

class ExperienceServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experienceServiceHistories')
    instance = historyInstanceField(ExperienceService)
    
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experienceServiceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.service or '-')
           
class ExperiencePrompt(RootInstance, PublicInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdExperiencePrompts')
    lastTransaction = lastTransactionField('changedExperiencePrompts')
    deleteTransaction = deleteTransactionField('deletedExperiencePrompts')
    
    name = dbmodels.CharField(max_length=255, db_index=True, null=True)
    organization = dbmodels.ForeignKey('consentrecords.Organization', related_name='experiencePrompts', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    site = dbmodels.ForeignKey('consentrecords.Site', related_name='experiencePrompts', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    offering = dbmodels.ForeignKey('consentrecords.Offering', related_name='experiencePrompts', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    domain = dbmodels.ForeignKey('consentrecords.Service', related_name='domainExperiencePrompts', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    stage = dbmodels.CharField(max_length=20, db_index=True, null=True)
    timeframe = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'name': 'name',
                'stage': 'stage',
                'timeframe': 'timeframe',
               }
    
    elementMap = {'translation': ('texts__', 'ExperiencePromptText', 'parent'),
                  'service': ('services__', 'ExperiencePromptService', 'parent'),
                  'organization': ('organization__', 'Organization', 'experiencePrompts'),
                  'site': ('site__', 'Site', 'experiencePrompts'),
                  'offering': ('offering__', 'Offering', 'experiencePrompts'),
                  'domain': ('domain__', 'Service', 'domainExperiencePrompts'),
                  'disqualifying tag': ('disqualifyingTags__', 'DisqualifyingTag', 'parent'),
                 }

    def description(self, languageCode=None):
        return self.name
    
    def __str__(self):
        return self.name

    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        # Disqualifying tags cannot be sorted without a context. 
        return ExperiencePrompt.select_head_related(querySet)\
                    .select_related('organization')\
                    .select_related('site')\
                    .select_related('offering')\
                    .select_related('domain')\
                    .prefetch_related(Prefetch('services',
                                               ExperiencePromptService.select_related(ExperiencePromptService.objects.filter(deleteTransaction__isnull=True)).order_by('position'),
                                               to_attr='fetchedServices'))\
                    .prefetch_related(Prefetch('texts',
                                               ExperiencePromptText.select_related(ExperiencePromptText.objects.filter(deleteTransaction__isnull=True)).order_by('languageCode', 'text'),
                                               to_attr='fetchedTexts'))\
                    .prefetch_related(Prefetch('disqualifyingTags',
                                               DisqualifyingTag.select_related(DisqualifyingTag.objects.filter(deleteTransaction__isnull=True)),
                                               to_attr='fetchedDisqualifyingTags'))
    
    def getData(self, fields, context):
        data = self.headData(context)
        data['name'] = self.name
        if self.organization:
            data['organization'] = self.organization.headData(context)
        if self.site:
            data['site'] = self.site.headData(context)
        if self.offering:
            data['offering'] = self.offering.headData(context)
        if self.domain:
            data['domain'] = self.domain.headData(context)
        if self.stage:
            data['stage'] = self.stage
        if self.timeframe:
            data['timeframe'] = self.timeframe
        data['services'] = [i.getData([], context) for i in self.fetchedServices]
        data['translations'] = [i.getData([], context) for i in self.fetchedTexts]
        
        data['disqualifying tags'] = [i.getData([], context) for i in self.fetchedDisqualifyingTags]
        data['disqualifying tags'].sort(key=lambda s: s['description'])
        
        return data
        
    def order_by(queryset, context):
        return queryset.filter(Q(texts__deleteTransaction__isnull=True)& 
                               (Q(texts__languageCode=context.languageCode)|(Q(texts__languageCode='en')&~Q(texts__parent__texts__languageCode=context.languageCode))))\
                       .order_by('texts__text')
    
    def markDeleted(self, context):
        for i in self.texts.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.services.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.disqualifyingTags.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(ExperiencePrompt, self).markDeleted(context)

    def validateTimeframe(data, key):
        validValues = ['Previous', 'Current', 'Goal']
        _validateEnumeration(data, key, validValues)
    
    def create(data, context, newIDs={}):
        if not context.is_administrator:
           raise PermissionDenied("write permission failed")
        
        if 'name' not in data or not data['name']:
            raise ValueError('name of experience prompt is not specified')
        Service.validateStage(data, 'stage')
        ExperiencePrompt.validateTimeframe(data, 'timeframe')
             
        newItem = ExperiencePrompt.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 name = _orNone(data, 'name'),
                                 organization = _orNoneForeignKey(data, 'organization', context, Organization),
                                 site = _orNoneForeignKey(data, 'site', context, Site),
                                 offering = _orNoneForeignKey(data, 'offering', context, Offering),
                                 domain = _orNoneForeignKey(data, 'domain', context, Service),
                                 stage = _orNone(data, 'stage'),
                                 timeframe = _orNone(data, 'timeframe'),
                                )
        
        newItem.createChildren(data, 'translations', context, ExperiencePromptText, newIDs)
        newItem.createChildren(data, 'services', context, ExperiencePromptService, newIDs)
        newItem.createChildren(data, 'disqualifying tags', context, DisqualifyingTag, newIDs)
        
        return newItem

    def buildHistory(self, context):
        return ExperiencePromptHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             name=self.name,
                                             organization=self.organization,
                                             site=self.site,
                                             offering=self.offering,
                                             domain=self.domain,
                                             stage=self.stage,
                                             timeframe=self.timeframe)
        
    def revert(self, h):
        self.name = h.name 
        self.organization = h.organization 
        self.site = h.site 
        self.offering = h.offering 
        self.domain = h.domain 
        self.stage = h.stage 
        self.timeframe = h.timeframe 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        Service.validateStage(changes, 'stage')
        ExperiencePrompt.validateTimeframe(changes, 'timeframe')

        history = None
        if 'name' in changes and changes['name']:
            if changes['name'] != self.name:
                history = history or self.buildHistory(context)
                self.name = changes['name']
        if 'organization' in changes:
            newValue = _orNoneForeignKey(changes, 'organization', context, Organization)
            if newValue != self.organization:
                history = history or self.buildHistory(context)
                self.organization = newValue
        if 'site' in changes:
            newValue = _orNoneForeignKey(changes, 'site', context, Site)
            if newValue != self.site:
                history = history or self.buildHistory(context)
                self.site = newValue
        if 'offering' in changes:
            newValue = _orNoneForeignKey(changes, 'offering', context, Offering)
            if newValue != self.offering:
                history = history or self.buildHistory(context)
                self.offering = newValue
        if 'domain' in changes:
            newValue = _orNoneForeignKey(changes, 'domain', context, Service)
            if newValue != self.domain:
                history = history or self.buildHistory(context)
                self.domain = newValue
        if 'stage' in changes:
            if changes['stage'] != self.stage:
                history = history or self.buildHistory(context)
                self.stage = changes['stage']
        if 'timeframe' in changes:
            if changes['timeframe'] != self.timeframe:
                history = history or self.buildHistory(context)
                self.timeframe = changes['timeframe']
        
        self.updateChildren(changes, 'translations', context, ExperiencePromptText, self.texts, newIDs)
        self.updateChildren(changes, 'services', context, ExperiencePromptService, self.services, newIDs)
        self.updateChildren(changes, 'disqualifying tags', context, DisqualifyingTag, self.disqualifyingTags, newIDs)

        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class ExperiencePromptHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experiencePromptHistories')
    instance = historyInstanceField(ExperiencePrompt)
    
    name = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    organization = dbmodels.ForeignKey('consentrecords.Organization', related_name='experiencePromptHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    site = dbmodels.ForeignKey('consentrecords.Site', related_name='experiencePromptHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    offering = dbmodels.ForeignKey('consentrecords.Offering', related_name='experiencePromptHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    domain = dbmodels.ForeignKey('consentrecords.Service', related_name='experiencePromptDomainHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    stage = dbmodels.CharField(max_length=20, db_index=True, null=True, editable=False)
    timeframe = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

class ExperiencePromptService(OrderedServiceLinkInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdExperiencePromptServices')
    lastTransaction = lastTransactionField('changedExperiencePromptServices')
    deleteTransaction = deleteTransactionField('deletedExperiencePromptServices')
    
    parent = parentField(ExperiencePrompt, 'services')
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experiencePromptServices', db_index=True, on_delete=dbmodels.CASCADE)
    
    fieldMap = {}
    
    elementMap = {'service': ('service__', 'Service', 'experiencePromptServices'),
                 }
    
    def __str__(self):
        return str(self.service)

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
           
        newItem = ExperiencePromptService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=data['position'],
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        
        return newItem                          
        
    @property
    def historyType(self):
        return ExperiencePromptServiceHistory

class ExperiencePromptServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experiencePromptServiceHistories')
    instance = historyInstanceField(ExperiencePromptService)

    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experiencePromptServiceHistories', db_index=True, editable=True, on_delete=dbmodels.CASCADE)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.service or '-')
           
class ExperiencePromptText(TranslationInstance, PublicInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdExperiencePromptTexts')
    lastTransaction = lastTransactionField('changedExperiencePromptTexts')
    deleteTransaction = deleteTransactionField('deletedExperiencePromptTexts')
    
    parent = parentField(ExperiencePrompt, 'texts')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(ExperiencePromptText.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return ExperiencePromptTextHistory

class ExperiencePromptTextHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experiencePromptTextHistories')
    instance = historyInstanceField(ExperiencePromptText)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class Group(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroups')
    deleteTransaction = deleteTransactionField('deletedGroups')
    parent = parentField('consentrecords.Organization', 'groups')

    fieldMap = {}
               
    elementMap = {'name': ('names__', "GroupName", 'parent'),
                  'member': ('members__', "GroupMember", 'parent'),
                  'organization': ('parent__', 'Organization', 'groups'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=GroupName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return Group.select_head_related(querySet)\
                       .prefetch_related(Prefetch('members', 
                                                  queryset=GroupMember.select_related(GroupMember.objects.filter(deleteTransaction__isnull=True)),
                                                  to_attr='fetchedMembers'))
        
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
            data['members'] = [i.getData([], context) for i in self.fetchedMembers]
        return data
    
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), Organization
    
    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent')

    def order_by(queryset, context):
        return queryset.filter(Q(names__deleteTransaction__isnull=True)& 
                               (Q(names__languageCode=context.languageCode)|(Q(names__languageCode='en')&~Q(names__parent__names__languageCode=context.languageCode))))\
                       .order_by('names__text')
    
    def markDeleted(self, context):
        for i in self.names.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.members.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Group, self).markDeleted(context)

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
           
        newItem = Group.objects.create(transaction=context.transaction,
                                 parent=parent,
                                )
        
        newItem.createChildren(data, 'names', context, GroupName, newIDs)
        newItem.createChildren(data, 'members', context, GroupMember, newIDs)
        
        return newItem                          
        
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        self.updateChildren(changes, 'names', context, GroupName, self.names, newIDs)
        self.updateChildren(changes, 'members', context, GroupMember, self.members, newIDs)
            
class GroupName(TranslationInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroupNames')
    lastTransaction = lastTransactionField('changedGroupNames')
    deleteTransaction = deleteTransactionField('deletedGroupNames')

    parent = parentField(Group, 'names')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(GroupName.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return GroupNameHistory

class GroupNameHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('groupNameHistories')
    instance = historyInstanceField(GroupName)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class GroupMember(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroupMembers')
    lastTransaction = lastTransactionField('changedGroupMembers')
    deleteTransaction = deleteTransactionField('deletedGroupMembers')

    parent = parentField(Group, 'members')
    user = dbmodels.ForeignKey('consentrecords.User', related_name='groupMembers', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {}
               
    elementMap = {'user': ('user__', 'User', 'groupMembers'),
                  'group': ('parent__', 'Group', 'members'),
                 }
                 
    def description(self, languageCode=None):
        return self.user.description(languageCode) if self.user else ''
        
    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.select_related('user')
    
    def select_related(querySet, fields=[]):
        return GroupMember.select_head_related(querySet)
    
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.user:
                data['user'] = self.user.headData(context)
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
           
        newItem = GroupMember.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return GroupMemberHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             user=self.user)
        
    def revert(self, h):
        self.user = h.user 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'user' in changes:
            newUser = _orNoneForeignKey(changes, 'user', context, User)
            if newUser != self.user:
                history = history or self.buildHistory(context)
                self.user = newUser
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class GroupMemberHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('groupMemberHistories')
    instance = historyInstanceField(GroupMember)

    user = dbmodels.ForeignKey('consentrecords.User', related_name='groupMemberHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)

class Inquiry(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdInquiries')
    lastTransaction = lastTransactionField('changedInquiries')
    deleteTransaction = deleteTransactionField('deletedInquiries')

    parent = parentField('consentrecords.Session', 'inquiries')
    user = dbmodels.ForeignKey('consentrecords.User', related_name='inquiries', db_index=True, on_delete=dbmodels.CASCADE)
    
    class Meta:
        verbose_name_plural = 'Inquiries'
    
    fieldMap = {}
    
    elementMap = {'user': ('user__', 'User', 'inquiries'),
                 }

    def description(self, languageCode=None):
        return self.user.description(languageCode)
        
    def select_head_related(querySet):
        return querySet.select_related('user')
    
    def select_related(querySet, fields=[]):
        return Inquiry.select_head_related(querySet)
    
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.user:
                data['user'] = self.user.headData(context)
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent__parent')

    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def create(parent, data, context, newIDs={}):
        user = _orNoneForeignKey(data, 'user', context, User)
        if not user:
            raise ValueError('no user was specified for a new inquiry')
        
        newItem = Inquiry.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=user,
                                )
        
        # When adding an inquiry, ensure that the inquiry access group of the organization 
        # containing the inquiry can read the user.
        organization = parent.parent.parent.parent
        if type(organization) != Organization:
            raise ValueError('this session is not associated with an organization')
            
        if organization.inquiryAccessGroup and \
           not user.groupGrants.filter(deleteTransaction__isnull=True,
                                       grantee=organization.inquiryAccessGroup,
                                       privilege__in=['read', 'write', 'administer']).exists():
            newGrant = GroupGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=user.id,
                                 grantee=organization.inquiryAccessGroup,
                                 privilege='read')
            
        return newItem                          
        
    def buildHistory(self, context):
        return InquiryHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             user=self.user)
        
    def revert(self, h):
        self.user = h.user 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'user' in changes:
            newUser = _orNoneForeignKey(changes, 'user', context, User)
            if newUser != self.user:
                history = history or self.buildHistory(context)
                self.user = newUser
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class InquiryHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('inquiryHistories')
    instance = historyInstanceField(Inquiry)

    user = dbmodels.ForeignKey('consentrecords.User', related_name='inquiryHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)

class Notification(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdNotifications')
    lastTransaction = lastTransactionField('changedNotifications')
    deleteTransaction = deleteTransactionField('deletedNotifications')
    parent = parentField('consentrecords.User', 'notifications')
    name = dbmodels.CharField(max_length=255, db_index=True, null=True)
    isFresh = dbmodels.CharField(max_length=10, null=True)
    
    def description(self, languageCode=None):
        return self.name
    
    def __str__(self):
        return self.name
        
    def select_head_related(querySet):
        return querySet
    
    def select_related(querySet, fields=[]):
        return querySet.prefetch_related(Prefetch('notificationArguments', 
                           queryset=NotificationArgument.objects.filter(deleteTransaction__isnull=True).order_by('position')))
    
    def getArgumentTypes(self):
        if self.name == 'crn.FollowerAccept':
            return [User]
        elif self.name == 'crn.ExperienceCommentRequested':
            return [Path, Experience, Comment]
        elif self.name == 'crn.ExperienceQuestionAnswered':
            return [Path, Experience]
        elif self.name == 'crn.ExperienceSuggestion':
            return [Path, Service]
        else:
            return []
        
    def getData(self, fields, context):
        data = self.headData(context)
        data['name'] = self.name
        data['is fresh'] = self.isFresh
        
        arguments = self.notificationArguments.filter(deleteTransaction__isnull=True).order_by('position')
        
        types = self.getArgumentTypes()

        data['arguments'] = [types[i].objects.get(id=arguments[i].argument).headData(context) \
                            for i in range(0, min(len(arguments), len(types)))]
        
        return data
    
    fieldMap = {'name': 'name',
                'is fresh': 'isFresh',
               }
               
    elementMap = {'argument': ('notificationArguments__', "NotificationArgument", 'parent'),
                 }

    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), User

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent')

    def order_by(queryset, context):
        return queryset.order_by('transaction__creation_time')
    
    def markDeleted(self, context):
        for i in self.notificationArguments.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Notification, self).markDeleted(context)

    def validateIsFresh(data, key):
        validValues = ['no', 'yes']
        _validateEnumeration(data, key, validValues)
        
    def create(parent, data, context, newIDs={}):
        Notification.validateIsFresh(data, 'is fresh')
        newItem = Notification.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 name = data['name'],
                                 isFresh = _orNone(data, 'is fresh'),
                                )
        
        types = newItem.getArgumentTypes()
        for position in range(0, len(types)):
            path = data['arguments'][position]
            fk = _getForeignKey(path, context, types[position])
            NotificationArgument.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=newItem,
                                 position=position,
                                 argument=fk.id.hex)
            
        return newItem                          
        
    def buildHistory(self, context):
        return NotificationHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             name=self.name,
                                             isFresh=self.isFresh)
        
    def revert(self, h):
        self.name = h.name 
        self.isFresh = h.isFresh 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'is fresh' in changes and changes['is fresh'] != self.isFresh:
            Notification.validateIsFresh(changes, 'is fresh')
            history = history or self.buildHistory(context)
            self.isFresh = changes['is fresh'] or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class NotificationHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('notificationHistories')
    instance = historyInstanceField(Notification)

    name = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    isFresh = dbmodels.CharField(max_length=10, null=True, editable=False)
    
class NotificationArgument(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdNotificationArguments')
    lastTransaction = lastTransactionField('changedNotificationArguments')
    deleteTransaction = deleteTransactionField('deletedNotificationArguments')
    
    parent = parentField('consentrecords.Notification', 'notificationArguments')
    position = dbmodels.IntegerField()
    argument = dbmodels.CharField(max_length=255, db_index=True, null=True)

    def description(self, languageCode=None):
        return str(self.position)
        
    def __str__(self):
        return '%s: %s' % (self.position, str(self.argument))

    def select_head_related(querySet):
        return querySet.order_by('position')
    
    def select_related(querySet, fields=[]):
        return querySet.order_by('position')
        
    def getData(self, fields, context):
        data = self.headData(context)
        data['position'] = self.position
        data['argument'] = self.argument
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent'), User

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

class NotificationArgumentHistory(dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('notificationArgumentHistories')
    instance = historyInstanceField(NotificationArgument)
    position = dbmodels.IntegerField()
    argument = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

class Offering(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdOfferings')
    lastTransaction = lastTransactionField('changedOfferings')
    deleteTransaction = deleteTransactionField('deletedOfferings')
    parent = parentField('consentrecords.Site', 'offerings')
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True)
    minimumAge = dbmodels.CharField(max_length=255, db_index=True, null=True)
    maximumAge = dbmodels.CharField(max_length=255, db_index=True, null=True)
    minimumGrade = dbmodels.CharField(max_length=255, db_index=True, null=True)
    maximumGrade = dbmodels.CharField(max_length=255, db_index=True, null=True)
    service = dbmodels.ManyToManyField('consentrecords.Service', related_name='offering',
        through='consentrecords.OfferingService',
        through_fields=('parent','service'))
    
    fieldMap = {'web site': 'webSite',
                'minimum age': 'minimumAge',
                'maximum age': 'maximumAge',
                'minimum grade': 'minimumGrade',
                'maximum grade': 'maximumGrade',
               }
               
    elementMap = {'name': ('names__', "OfferingName", 'parent'),
                  'service': ('services__', "OfferingService", 'parent'),
                  'session': ('sessions__', "Session", 'parent'),
                  'site': ('parent__', 'Site', 'offerings'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=OfferingName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return Offering.select_head_related(querySet)\
                       .prefetch_related(Prefetch('services',
                                         queryset=OfferingService.select_related(OfferingService.objects.filter(deleteTransaction__isnull=True)).order_by('position'),
                                         to_attr='currentServices'))\
                       .prefetch_related(Prefetch('sessions',
                                         queryset=Session.select_head_related(Session.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentSessions'))
        
    def getData(self, fields, context):
        data = super(Offering, self).getData(fields, context)
        
        if context.canRead(self):
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
            if self.webSite:
                data['web site'] = self.webSite
            if self.minimumAge:
                data['minimum age'] = self.minimumAge
            if self.maximumAge:
                data['maximum age'] = self.maximumAge
            if self.minimumGrade:
                data['minimum grade'] = self.minimumGrade
            if self.maximumGrade:
                data['maximum grade'] = self.maximumGrade
        
            if 'services' in fields:
                data['services'] = [i.getData([], context) for i in self.currentServices]
            else:
                data['services'] = [i.headData(context) for i in self.currentServices]
            
            if 'sessions' in fields:
                data['sessions'] = [i.getData([], context) for i in self.currentSessions]
            else:
                data['sessions'] = [i.headData(context) for i in self.currentSessions]
            data['sessions'].sort(key=lambda i: i['description'])
            
            if 'parents' in fields:
                if context.canRead(self.parent):
                    if 'organization' in fields:
                        data['organization'] = self.parent.parent.getData([], context)
                    else:
                        data['organization'] = self.parent.parent.headData(context)
                    if 'site' in fields:
                        data['site'] = self.parent.getData([], context)
                    else:
                        data['site'] = self.parent.headData(context)
        else:
            raise PermissionDenied('this offering can not be read: %s' % self.description())
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

    def order_by(queryset, context):
        return queryset.filter(Q(names__deleteTransaction__isnull=True)& 
                               (Q(names__languageCode=context.languageCode)|(Q(names__languageCode='en')&~Q(names__parent__names__languageCode=context.languageCode))))\
                       .order_by('names__text')
    
    def markDeleted(self, context):
        for name in self.currentNamesQuerySet:
            name.markDeleted(context)
        for i in self.services.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.sessions.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Offering, self).markDeleted(context)
        
    def validateMinimumAge(self, data, key):
        if key not in data:
            return
        elif int(data[key]) < 0:
            raise ValueError("minimum age cannot be less than 0")
        else:
            return

    def validateMaximumAge(self, data, key):
        if key not in data:
            return
        elif int(data[key]) < 0:
            raise ValueError("maximum age cannot be less than 0")
        else:
            return

    def validateMinimumGrade(self, data, key):
        pass

    def validateMaximumGrade(self, data, key):
        pass

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
           
        newItem = Offering.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 webSite=_orNone(data, 'web site'),
                                 minimumAge=_orNone(data, 'minimum age'),
                                 maximumAge=_orNone(data, 'maximum age'),
                                 minimumGrade=_orNone(data, 'minimum grade'),
                                 maximumGrade=_orNone(data, 'maximum grade'),
                                )
        
        newItem.createChildren(data, 'names', context, OfferingName, newIDs)
        newItem.createChildren(data, 'services', context, OfferingService, newIDs)
        newItem.createChildren(data, 'sessions', context, Session, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return OfferingHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             webSite=self.webSite,
                                             minimumAge=self.minimumAge,
                                             maximumAge=self.maximumAge,
                                             minimumGrade=self.minimumGrade,
                                             maximumGrade=self.maximumGrade)
        
    def revert(self, h):
        self.webSite = h.webSite 
        self.minimumAge = h.minimumAge 
        self.maximumAge = h.maximumAge 
        self.minimumGrade = h.minimumGrade 
        self.maximumGrade = h.maximumGrade 
           
    @property    
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s\t%s" % (self.id, self.webSite or '-', 
            self.minimumAge or '-', 
            self.maximumAge or '-', 
            self.minimumGrade or '-', 
            self.maximumGrade or '-')
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'web site' in changes and changes['web site'] != self.webSite:
            history = history or self.buildHistory(context)
            self.webSite = changes['web site'] or None
        if 'minimum age' in changes and changes['minimum age'] != self.minimumAge:
            self.validateMinimumAge(changes, 'minimum age')
            history = history or self.buildHistory(context)
            self.minimumAge = changes['minimum age'] or None
        if 'maximum age' in changes and changes['maximum age'] != self.maximumAge:
            self.validateMaximumAge(changes, 'maximum age')
            history = history or self.buildHistory(context)
            self.maximumAge = changes['maximum age'] or None
        if 'minimum grade' in changes and changes['minimum grade'] != self.minimumGrade:
            self.validateMinimumGrade(changes, 'minimum grade')
            history = history or self.buildHistory(context)
            self.minimumGrade = changes['minimum grade'] or None
        if 'maximum grade' in changes and changes['maximum grade'] != self.maximumGrade:
            self.validateMaximumGrade(changes, 'maximum grade')
            history = history or self.buildHistory(context)
            self.maximumGrade = changes['maximum grade'] or None
        
        self.updateChildren(changes, 'names', context, OfferingName, self.names, newIDs)
        self.updateChildren(changes, 'services', context, OfferingService, self.services, newIDs)
        self.updateChildren(changes, 'sessions', context, Session, self.sessions, newIDs)
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class OfferingHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('offeringHistories')
    instance = historyInstanceField(Offering)
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    minimumAge = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    maximumAge = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    minimumGrade = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    maximumGrade = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s\t%s" % (self.id, self.webSite or '-', 
            self.minimumAge or '-', 
            self.maximumAge or '-', 
            self.minimumGrade or '-', 
            self.maximumGrade or '-')
           
class OfferingName(TranslationInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdOfferingNames')
    lastTransaction = lastTransactionField('changedOfferingNames')
    deleteTransaction = deleteTransactionField('deletedOfferingNames')

    parent = parentField(Offering, 'names')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else self.text

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(OfferingName.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return OfferingNameHistory

class OfferingNameHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('offeringNameHistories')
    instance = historyInstanceField(OfferingName)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class OfferingService(OrderedServiceLinkInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdOfferingServices')
    lastTransaction = lastTransactionField('changedOfferingServices')
    deleteTransaction = deleteTransactionField('deletedOfferingServices')

    parent = parentField(Offering, 'services')
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='offeringServices', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {'position': 'position',
               }
               
    elementMap = {'service': ('service__', "Service", 'offeringServices'),
                 }
                 
    @property
    def __str__(self):
        return str(self.service)

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent')

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
           
        newItem = OfferingService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=data['position'],
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        
        return newItem                          
        
    @property
    def historyType(self):
        return OfferingServiceHistory
            
class OfferingServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('offeringServiceHistories')
    instance = historyInstanceField(OfferingService)
    
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='offeringServiceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.service or '-')
           
class Organization(SecureRootInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdOrganizations')
    lastTransaction = lastTransactionField('changedOrganizations')
    deleteTransaction = deleteTransactionField('deletedOrganizations')
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True)
    inquiryAccessGroup = dbmodels.ForeignKey('consentrecords.Group', related_name='inquiryAccessGroupOrganizations', db_index=True, null=True, on_delete=dbmodels.CASCADE)

    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administeredOrganizations', db_index=True, null=True, on_delete=dbmodels.CASCADE)

    fieldMap = {'web site': 'webSite',
               }
               
    elementMap = {'inquiry access group': ('inquiryAccessGroup__', "Group", 'inquiryAccessGroupOrganizations'),
                  'group': ('groups__', 'Group', 'parent'),
                  'name': ('names__', 'OrganizationName', 'parent'),
                  'site': ('sites__', 'Site', 'parent'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=OrganizationName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return Organization.select_head_related(querySet)\
                       .prefetch_related(Prefetch('sites',
                                         queryset=Site.select_head_related(Site.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentSites'))\
                       .prefetch_related(Prefetch('groups',
                                         queryset=Group.select_head_related(Group.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentGroups'))\
                       .select_related('inquiryAccessGroup')
        
    def getData(self, fields, context):
        data = super(Organization, self).getData(fields, context)
        if context.canRead(self):
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
            if self.webSite:
                data['web site'] = self.webSite
            
            data['sites'] = [i.headData(context) for i in self.currentSites]
            data['sites'].sort(key=lambda s: s['description'])
                
            data['groups'] = [i.headData(context) for i in self.currentGroups]
            data['groups'].sort(key=lambda s: s['description'])
                
        if context.getPrivilege(self) == 'administer':
            if self.inquiryAccessGroup:
                data['inquiry access group'] = self.inquiryAccessGroup.headData(context)

        return data
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, '')

    def order_by(queryset, context):
        return queryset.filter(Q(names__deleteTransaction__isnull=True)& 
                               (Q(names__languageCode=context.languageCode)|(Q(names__languageCode='en')&~Q(names__parent__names__languageCode=context.languageCode))))\
                       .order_by('names__text')
    
    def markDeleted(self, context):
        for name in self.currentNamesQuerySet:
            name.markDeleted(context)
        for i in self.groups.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.sites.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Organization, self).markDeleted(context)

    def create(data, context, newIDs={}):
        if not context.is_administrator:
           raise PermissionDenied("write permission failed")
           
        # Handle special case for primary administrator when creating a new SecureRootInstance subclass.
        if 'primary administrator' in data and data['primary administrator'].startswith('user/'):
            id = data['primary administrator'][len('user/'):]
            primaryAdministrator = User.objects.get(pk=id)
        else:
            primaryAdministrator = _orNoneForeignKey(data, 'primary administrator', context, User)
            
        newItem = Organization.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 webSite = _orNone(data, 'web site'),
                                 publicAccess=_orNone(data, 'public access'),
                                 primaryAdministrator=primaryAdministrator
                                )
        
        newItem.createChildren(data, 'names', context, OrganizationName, newIDs)
        newItem.createChildren(data, 'groups', context, Group, newIDs)
        newItem.createChildren(data, 'sites', context, Site, newIDs)
        
        newItem.createChildren(data, 'user grants', context, UserGrant, newIDs)
        newItem.createChildren(data, 'group grants', context, GroupGrant, newIDs)
        
        if 'inquiry access group' in data:
            newItem.inquiryAccessGroup = _orNoneForeignKey(data, 'inquiry access group', context, Group, Organization.objects.filter(pk=newItem.id),
                                                          Organization)
            newItem.save()
        
        return newItem                          
        
    def buildHistory(self, context):
        return OrganizationHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             webSite=self.webSite,
                                             inquiryAccessGroup=self.inquiryAccessGroup,
                                             publicAccess=self.publicAccess,
                                             primaryAdministrator=self.primaryAdministrator)
    
    def revert(self, h):
        self.webSite = h.webSite 
        self.inquiryAccessGroup = h.inquiryAccessGroup 
        self.publicAccess = h.publicAccess 
        self.primaryAdministrator = h.primaryAdministrator 
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'web site' in changes and changes['web site'] != self.webSite:
            history = history or self.buildHistory(context)
            self.webSite = changes['web site'] or None
        
        self.updateChildren(changes, 'names', context, OrganizationName, self.names, newIDs)
        self.updateChildren(changes, 'groups', context, Group, self.groups, newIDs)
        self.updateChildren(changes, 'sites', context, Site, self.sites, newIDs)
                                                         
        if 'inquiry access group' in changes:
            newInquiryAccessGroup = _orNoneForeignKey(changes, 'inquiry access group', context, Group, Organization.objects.filter(pk=self.id),
                                                      Organization)
            if newInquiryAccessGroup != self.inquiryAccessGroup:
                history = history or self.buildHistory(context)
                self.inquiryAccessGroup = newInquiryAccessGroup
        if 'public access' in changes and changes['public access'] != self.publicAccess:
            SecureRootInstance.valueCheckPublicAccess(changes, 'public access')
            history = history or self.buildHistory(context)
            self.publicAccess = changes['public access'] or None
        if 'primary administrator' in changes:
            newValue = _getForeignKey(changes['primary administrator'], context, User)
            if newValue != self.primaryAdministrator:
                 SecureRootInstance.valueCheckPrimaryAdministrator(newValue)
                 history = history or self.buildHistory(context)
                 self.primaryAdministrator = newValue or None
        
        if context.canAdminister(self):
            self.updateChildren(changes, 'user grants', context, UserGrant, self.userGrants, newIDs)
            self.updateChildren(changes, 'group grants', context, GroupGrant, self.groupGrants, newIDs)
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class OrganizationHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('organizationHistories')
    instance = historyInstanceField(Organization)
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    inquiryAccessGroup = dbmodels.ForeignKey('consentrecords.Group', related_name='InquiryAccessGroupOrganizationHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    publicAccess = dbmodels.CharField(max_length=10, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administeredOrganizationHistories', db_index=True, null=True, on_delete=dbmodels.CASCADE)

class OrganizationName(TranslationInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdOrganizationNames')
    lastTransaction = lastTransactionField('changedOrganizationNames')
    deleteTransaction = deleteTransactionField('deletedOrganizationNames')

    parent = parentField(Organization, 'names')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(OrganizationName.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return OrganizationNameHistory

class OrganizationNameHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('organizationNameHistories')
    instance = historyInstanceField(OrganizationName)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class Path(IInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdPaths')
    lastTransaction = lastTransactionField('changedPaths')
    deleteTransaction = deleteTransactionField('deletedPaths')

    parent = parentField('consentrecords.User', 'paths')
    birthday = dbmodels.CharField(max_length=10, db_index=True, null=True)
    name = dbmodels.CharField(max_length=255, db_index=True, null=True)
    specialAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    canAnswerExperience = dbmodels.CharField(max_length=10, null=True)

    def description(self, languageCode='en'):
        return self.name or "Someone's path"
    
    def __str__(self):
        return self.name or ("%s %s" % (str(self.parent), "path"))
        
    def caption(self, context):
        user = context.canRead(self.parent) and self.parent
        return (user and user.fullName) or \
               self.name or \
               (user and user.description) or \
               "Someone"

    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        return querySet
        
    @property    
    def privilegeSource(self):
        return self
        
    def fetchPrivilege(self, user):
        userPrivilege = self.parent.fetchPrivilege(user)
        if self.specialAccess == 'custom':
            return IInstance.reducePrivileges([{'privilege': self.publicAccess}], userPrivilege)
        else:
            return userPrivilege

    def headData(self, context):
        return {'id': self.id.hex, 
                'description': self.name, 
                'parentID': self.parent_id.hex, 
                'privilege': context.getPrivilege(self),
               }
    
    def getData(self, fields, context):
        data = self.headData(context)
        
        data['birthday'] = self.birthday
        if self.name:
            data['name'] = self.name
        if self.specialAccess:
            data['special access'] = self.specialAccess
        if self.canAnswerExperience:
            data['can answer experience'] = self.canAnswerExperience

        if 'parents' in fields:
            if context.canRead(self.parent):
                if 'user' in fields:
                    data['user'] = self.parent.getData([], context)
                else:
                    data['user'] = self.parent.headData(context)
        
        if 'experiences' in fields:
            experienceFields = list(map(lambda s: s[len('experiences/'):], 
                filter(lambda s: s.startswith('experiences/'), fields)))
            data['experiences'] = [i.getData(experienceFields, context) for i in \
                Experience.select_related(self.experiences.filter(deleteTransaction__isnull=True), experienceFields)]

        return data
    
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousFindFilter(prefix=''):
        inClause = (prefix + '__publicAccess__in') if prefix else 'publicAccess__in'
        userInClause = (prefix + '__parent__publicAccess__in') if prefix else 'parent__publicAccess__in'
        return Q((inClause, ["find", "read"]))|\
               Q((userInClause, ["find", "read"]))
        
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousReadFilter(prefix=''):
        inClause = (prefix + '__publicAccess') if prefix else 'publicAccess'
        userInClause = (prefix + '__parent__publicAccess') if prefix else 'parent__publicAccess'
        return Q((inClause, "read"))|\
               Q((userInClause, "read"))
    
    def privilegedQuerySet(qs, user, prefix, privileges):
        if prefix: prefix += '__'
        inClause = prefix + 'publicAccess'
        userPublicAccessClause = prefix + 'parent__publicAccess__in'
        userPrimaryAdministratorClause = prefix + 'parent__primaryAdministrator'
        userInClause = prefix + 'parent_id__in'
        grantClause = SecureRootInstance.grantorIDs(user, privileges)
        qClause = Q((inClause, privileges))|\
                  Q((userPublicAccessClause, privileges))|\
                  Q((userPrimaryAdministratorClause, user))|\
                  Q((userInClause, grantClause))
        return qs.filter(qClause)
    
    def findableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.filter(Path.anonymousFindFilter(prefix))
        elif user.is_administrator:
            return qs
        else:
            return Path.privilegedQuerySet(qs, user, prefix, ["find", "read", "register", "write", "administer"])

    def readableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.filter(Path.anonymousReadFilter(prefix))
        elif user.is_administrator:
            return qs
        else:
            return Path.privilegedQuerySet(qs, user, prefix, ["read", "write", "administer"])

    fieldMap = {'screen name': 'name',
                'birthday': 'birthday',
                'special access': 'specialAccess',
                'can answer experience': 'canAnswerExperience',
               }
               
    elementMap = {'experience': ('experiences__', "Experience", 'parent'),
                  'user': ('parent__', "User", 'paths'),
                 }

    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, Path
        else:
            return Path.findableQuerySet(qs, user), Path

    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, '')

    def markDeleted(self, context):
        for i in self.experiences.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Path, self).markDeleted(context)

    def validateBirthday(data, key):
        if key not in data:
            return
        return User.validateBirthday(data, key)
    
    def validateSpecialAccess(data, key):
        validValues = ['custom']
        _validateEnumeration(data, key, validValues)
    
    def validateCanAnswerExperience(data, key):
        validValues = ['yes', 'no']
        _validateEnumeration(data, key, validValues)
    
    def create(parent, data, context, newIDs={}):
        Path.validateBirthday(data, 'birthday')
        Path.validateSpecialAccess(data, 'special access')
        Path.validateCanAnswerExperience(data, 'can answer experience')
        
        birthday = data['birthday'] if 'birthday' in data \
            else parent.birthday[0:7] if parent.birthday else None
        
        newItem = Path.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent = parent,
                                 name = _orNone(data, 'screen name'),
                                 birthday = birthday,
                                 specialAccess = _orNone(data, 'special access'),
                                 publicAccess = _orNone(data, 'public access'),
                                 canAnswerExperience = _orNone(data, 'can answer experience'),
                                )
        
        newItem.createChildren(data, 'experiences', context, Experience, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return PathHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             birthday=self.birthday,
                                             name=self.name,
                                             specialAccess=self.specialAccess,
                                             publicAccess=self.publicAccess,
                                             canAnswerExperience=self.canAnswerExperience)
    
    ### Revert the data components of this object to values in the corresponding history    
    def revert(self, h):
        self.birthday = h.birthday
        self.name = h.name
        self.specialAccess = h.specialAccess
        self.publicAccess = h.publicAccess
        self.canAnswerExperience = self.canAnswerExperience
    
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        Path.validateCanAnswerExperience(changes, 'can answer experience')
        
        history = None
        if 'birthday' in changes and changes['birthday'] != self.birthday:
            _validateDate(changes, 'birthday')
            history = history or self.buildHistory(context)
            self.birthday = changes['birthday']
        if 'screen name' in changes and changes['screen name'] != self.name:
            history = history or self.buildHistory(context)
            self.name = changes['screen name'] or None
        if context.canAdminister(self):
            if 'special access' in changes and changes['special access'] != self.specialAccess:
                Path.validateSpecialAccess(changes, 'special access')
                history = history or self.buildHistory(context)
                self.specialAccess = changes['special access'] or None
                # Special behavior: Only change special access if the current user can administer
            if 'public access' in changes and changes['public access'] != self.publicAccess:
                SecureRootInstance.valueCheckPublicAccess(changes, 'public access')
                history = history or self.buildHistory(context)
                self.publicAccess = changes['public access'] or None
        if 'can answer experience' in changes and changes['can answer experience'] != self.canAnswerExperience:
            Path.validateCanAnswerExperience(changes, 'can answer experience')
            history = history or self.buildHistory(context)
            self.canAnswerExperience = changes['can answer experience'] or None
        
        self.updateChildren(changes, 'experiences', context, Experience, self.experiences, newIDs)

        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class PathHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('pathHistories')
    instance = historyInstanceField(Path)
    
    birthday = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    name = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    specialAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    canAnswerExperience = dbmodels.CharField(max_length=10, null=True)

class Period(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdPeriods')
    lastTransaction = lastTransactionField('changedPeriods')
    deleteTransaction = deleteTransactionField('deletedPeriods')

    parent = parentField('consentrecords.Session', 'periods')
    weekday = dbmodels.IntegerField(db_index=True, null=True)
    startTime = dbmodels.CharField(max_length=10, db_index=True, null=True)
    endTime = dbmodels.CharField(max_length=10, db_index=True, null=True)
    
    fieldMap = {'weekday': 'weekday',
                'start time': 'startTime',
                'end time': 'endTime',
               }
    elementMap = {}
    
    weekdays = {'en': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                'sp': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
               }
    
    def description(self, languageCode=None):
        return '%s: %s-%s' % ('any day' if (self.weekday == None) else Period.weekdays[languageCode][self.weekday], 
                              self.startTime or '', self.endTime or '')
        
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        return querySet
    
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.weekday:
                data['weekday'] = self.weekday
            if self.startTime:
                data['start time'] = self.startTime
            if self.endTime:
                data['end time'] = self.endTime
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent__parent')

    def order_by(queryset, context):
        return queryset.order_by('weekday', 'startTime', 'endTime')
    
    def validateWeekday(data, key):
        if key not in data or re.search('^[0-6]$', str(data[key])):
            return
        raise ValueError('the specified weekday is not valid: %s' % data[key])
    
    def validateTime(data, key):
        pass
    
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied("write permission failed")
        
        Period.validateWeekday(data, 'weekday')
        Period.validateTime(data, 'start time')
        Period.validateTime(data, 'end time')
        newItem = Period.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 weekday=_orNone(data, 'weekday'),
                                 startTime=_orNone(data, 'start time'),
                                 endTime=_orNone(data, 'end time'),
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return PeriodHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             weekday=self.weekday,
                                             startTime=self.startTime,
                                             endTime=self.endTime)
        
    def revert(self, h):
        self.weekday = h.weekday 
        self.startTime = h.startTime 
        self.endTime = h.endTime 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'weekday' in changes and changes['weekday'] != self.weekday:
            Period.validateWeekday(changes, 'weekday')
            history = history or self.buildHistory(context)
            self.weekday = changes['weekday'] or None
        if 'start time' in changes and changes['start time'] != self.startTime:
            Period.validateTime(changes, 'start time')
            history = history or self.buildHistory(context)
            self.startTime = changes['start time'] or None
        if 'end time' in changes and changes['end time'] != self.endTime:
            Period.validateTime(changes, 'end time')
            history = history or self.buildHistory(context)
            self.endTime = changes['end time'] or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class PeriodHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('periodHistories')
    instance = historyInstanceField(Period)

    weekday = dbmodels.IntegerField(db_index=True, null=True, editable=False)
    startTime = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    endTime = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

class Service(RootInstance, PublicInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdServices')
    lastTransaction = lastTransactionField('changedServices')
    deleteTransaction = deleteTransactionField('deletedServices')
    stage = dbmodels.CharField(max_length=20, db_index=True, null=True)
    implication = dbmodels.ManyToManyField('consentrecords.Service', related_name='implyingService',
        through='consentrecords.ServiceImplication',
        through_fields=('parent','impliedService'))

    fieldMap = {'stage': 'stage',
               }
               
    elementMap = {'name': ('names__', "ServiceName", 'parent'),
                  'organization label': ('organizationLabels__', "ServiceOrganizationLabel", 'parent'),
                  'site label': ('siteLabels__', "ServiceSiteLabel", 'parent'),
                  'offering label': ('offeringLabels__', "ServiceOfferingLabel", 'parent'),
                  'implies': ('serviceImplications__', 'ServiceImplication', 'parent'),
                  'implied by': ('impliedServiceImplications__', 'ServiceImplication', 'impliedService'),
                  'implication': ('implication__', 'Service', 'implyingService'),
                 }
                 
    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=ServiceName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return Service.select_head_related(querySet)\
                      .prefetch_related(Prefetch('organizationLabels',
                                                 queryset=ServiceOrganizationLabel.objects.filter(deleteTransaction__isnull=True),
                                                 to_attr='currentOrganizationLabels'))\
                      .prefetch_related(Prefetch('siteLabels',
                                                 queryset=ServiceSiteLabel.objects.filter(deleteTransaction__isnull=True),
                                                 to_attr='currentSiteLabels'))\
                      .prefetch_related(Prefetch('offeringLabels',
                                                 queryset=ServiceOfferingLabel.objects.filter(deleteTransaction__isnull=True),
                                                 to_attr='currentOfferingLabels'))\
                      .prefetch_related(Prefetch('serviceImplications',
                                                 queryset=\
                                                     ServiceImplication.select_related(ServiceImplication.objects.filter(deleteTransaction__isnull=True)) \
                                                     if 'services' in fields else \
                                                     ServiceImplication.select_head_related(ServiceImplication.objects.filter(deleteTransaction__isnull=True)),
                                                 to_attr='currentServiceImplications'))
    
    def order_by(queryset, context):
        return queryset.filter(Q(names__deleteTransaction__isnull=True)& 
                               (Q(names__languageCode=context.languageCode)|(Q(names__languageCode='en')&~Q(names__parent__names__languageCode=context.languageCode))))\
                       .order_by('names__text')
    
    def getData(self, fields, context):
        data = super(Service, self).getData(fields, context)
        if context.canRead(self):
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
            if self.stage:
                data['stage'] = self.stage
            labels = self.currentOrganizationLabels
            if 'organization label' in fields:
                data['organization labels'] = [i.getData([], context) for i in labels]
            else:
                data['organization labels'] = [i.headData(context) for i in labels]
            labels = self.currentSiteLabels
            if 'site label' in fields:
                data['site labels'] = [i.getData([], context) for i in labels]
            else:
                data['site labels'] = [i.headData(context) for i in labels]
            labels = self.currentOfferingLabels
            if 'offering label' in fields:
                data['offering labels'] = [i.getData([], context) for i in labels]
            else:
                data['offering labels'] = [i.headData(context) for i in labels]
            if 'services' in fields:
                data['services'] = [i.getData([], context) for i in self.currentServiceImplications]
            else:
                data['services'] = [i.headData(context) for i in self.currentServiceImplications]
            data['services'].sort(key=lambda i: i['description'])
        return data
    
    def validateStage(data, key):
        validValues = ['Certificate', 'Coaching', 'Expert', 'Housing', 'Mentoring', 
                       'Skills', 'Studying', 'Teaching', 'Training', 'Tutoring', 
                       'Volunteering', 'Wellness', 'Whatever', 'Working']
        _validateEnumeration(data, key, validValues)
    
    def markDeleted(self, context):
        for name in self.currentNamesQuerySet:
            name.markDeleted(context)
        for i in self.organizationLabels.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.siteLabels.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.offeringLabels.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.serviceImplications.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.impliedServiceImplications.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Service, self).markDeleted(context)

    def create(data, context, newIDs={}):
        if not context.is_administrator:
           raise PermissionDenied("write permission failed")
        
        Service.validateStage(data, 'stage')
             
        newItem = Service.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 stage = _orNone(data, 'stage'),
                                )
        
        newItem.createChildren(data, 'names', context, ServiceName, newIDs)
        newItem.createChildren(data, 'organization labels', context, ServiceOrganizationLabel, newIDs)
        newItem.createChildren(data, 'site labels', context, ServiceSiteLabel, newIDs)
        newItem.createChildren(data, 'offering labels', context, ServiceOfferingLabel, newIDs)
        newItem.createChildren(data, 'services', context, ServiceImplication, newIDs)
        
        return newItem
    
    def createElement(elementName, data, context, newIDs):
        if not context.canWrite(self):
            raise PermissionDenied('you do not have sufficient write privileges for this operation')
        if elementName == 'inquiry':
            return Inquiry.create(self, data, context, newIDs) 
        else:
            raise ValueError('you cannot create %s elements within session "%s"' % (elementName, self.description()))
    
    def buildHistory(self, context):
        return ServiceHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             stage=self.stage)
        
    def revert(self, h):
        self.stage = h.stage 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'stage' in changes and changes['stage'] != self.stage:
            Service.validateStage(changes, 'stage')
            history = history or self.buildHistory(context)
            self.stage = changes['stage'] or None
        
        self.updateChildren(changes, 'names', context, ServiceName, self.names, newIDs)
        self.updateChildren(changes, 'organization labels', context, ServiceOrganizationLabel, self.organizationLabels, newIDs)
        self.updateChildren(changes, 'site labels', context, ServiceSiteLabel, self.siteLabels, newIDs)
        self.updateChildren(changes, 'offering labels', context, ServiceOfferingLabel, self.offeringLabels, newIDs)
        self.updateChildren(changes, 'services', context, ServiceImplication, self.serviceImplications, newIDs)
                                                         
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class ServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceHistories')
    instance = historyInstanceField(Service)
    stage = dbmodels.CharField(max_length=20, db_index=True, null=True, editable=False)

class ServiceName(TranslationInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdServiceNames')
    lastTransaction = lastTransactionField('changedServiceNames')
    deleteTransaction = deleteTransactionField('deletedServiceNames')

    parent = parentField(Service, 'names')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(ServiceName.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return ServiceNameHistory

class ServiceNameHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceNameHistories')
    instance = historyInstanceField(ServiceName)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class ServiceOrganizationLabel(TranslationInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdServiceOrganizationLabels')
    lastTransaction = lastTransactionField('changedServiceOrganizationLabels')
    deleteTransaction = deleteTransactionField('deletedServiceOrganizationLabels')

    parent = parentField(Service, 'organizationLabels')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(ServiceOrganizationLabel.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return ServiceOrganizationLabelHistory

class ServiceOrganizationLabelHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceOrganizationLabelHistories')
    instance = historyInstanceField(ServiceOrganizationLabel)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class ServiceSiteLabel(TranslationInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdServiceSiteLabels')
    lastTransaction = lastTransactionField('changedServiceSiteLabels')
    deleteTransaction = deleteTransactionField('deletedServiceSiteLabels')

    parent = parentField(Service, 'siteLabels')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(ServiceSiteLabel.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return ServiceSiteLabelHistory

class ServiceSiteLabelHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceSiteLabelHistories')
    instance = historyInstanceField(ServiceSiteLabel)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class ServiceOfferingLabel(TranslationInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdServiceOfferingLabels')
    lastTransaction = lastTransactionField('changedServiceOfferingLabels')
    deleteTransaction = deleteTransactionField('deletedServiceOfferingLabels')

    parent = parentField(Service, 'offeringLabels')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(ServiceOfferingLabel.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return ServiceOfferingLabelHistory

class ServiceOfferingLabelHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceOfferingLabelHistories')
    instance = historyInstanceField(ServiceOfferingLabel)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class ServiceImplication(ChildInstance, PublicInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdServiceImplications')
    lastTransaction = lastTransactionField('changedServiceImplications')
    deleteTransaction = deleteTransactionField('deletedServiceImplications')
    
    parent = parentField(Service, 'serviceImplications')
    impliedService = dbmodels.ForeignKey('consentrecords.Service', related_name='impliedServiceImplications', db_index=True, on_delete=dbmodels.CASCADE)

    def description(self, languageCode=None):
        if 'currentNames' in self.__dict__:
            return IInstance.getName(self.currentNames, languageCode)
        else:
            return self.impliedService.description(languageCode)
        
    def select_head_related(querySet):
        return querySet.select_related('impliedService')\
                       .prefetch_related(Prefetch('impliedService__names',
                                                  queryset=ServiceName.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
    def select_related(querySet, fields=[]):
        return ServiceImplication.select_head_related(querySet)
    
    def __str__(self):
        return str(self.impliedService)

    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.impliedService:
                data['service'] = self.impliedService.headData(context)
        
        return data
    
    fieldMap = {
               }
               
    elementMap = {'parent': ('parent__', "Service", 'serviceImplications'),
                  'service': ('impliedService__', "Service", 'impliedServiceImplications'),
                 }
                 
    def order_by(queryset, context):
        return queryset.filter(Q(impliedService__names__deleteTransaction__isnull=True)& 
                               (Q(impliedService__names__languageCode=context.languageCode)|
                                (Q(impliedService__names__languageCode='en')&
                                 ~Q(impliedService__names__parent__names__languageCode=context.languageCode))))\
                       .order_by('impliedService__names__text')
    
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
            raise PermissionError
            
        newItem = ServiceImplication.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 impliedService=_orNoneForeignKey(data, 'service', context, Service),
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return ServiceImplicationHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             impliedService=self.impliedService)
        
    def revert(self, h):
        self.impliedService = h.impliedService 

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.impliedService or '-')
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'service' in changes:
            newService = _orNoneForeignKey(changes, 'service', context, Service)
            if newService != self.impliedService:
                history = history or self.buildHistory(context)
                self.impliedService = newService
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class ServiceImplicationHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceImplicationHistories')
    instance = historyInstanceField(ServiceImplication)

    impliedService = dbmodels.ForeignKey('consentrecords.Service', related_name='impliedServiceHistories', db_index=True, editable=True, on_delete=dbmodels.CASCADE)

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.impliedService or '-')
           
class Session(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdSessions')
    lastTransaction = lastTransactionField('changedSessions')
    deleteTransaction = deleteTransactionField('deletedSessions')
    
    parent = parentField(Offering, 'sessions')
    registrationDeadline = dbmodels.CharField(max_length=10, db_index=True, null=True)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True)
    canRegister = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'registration deadline': 'registrationDeadline',
                'start': 'start',
                'end': 'end',
                'can register': 'can register',
               }

    elementMap = {'name': ('names__', "SessionName", 'parent'),
                  'engagement': ('engagements__', "Engagement", 'parent'),
                  'enrollment': ('enrollments__', "Enrollment", 'parent'),
                  'inquiry': ('inquiry__', "Inquiry", 'parent'),
                  'period': ('periods__', "Period", 'parent'),
                  'offering': ('parent__', "Offering", 'sessions'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=SessionName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return Session.select_head_related(querySet)\
                       .prefetch_related(Prefetch('engagements',
                                         queryset=Engagement.select_head_related(Engagement.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentEngagements'))\
                       .prefetch_related(Prefetch('enrollments',
                                         queryset=Enrollment.select_head_related(Enrollment.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentEnrollments'))\
                       .prefetch_related(Prefetch('inquiries',
                                         queryset=Inquiry.select_head_related(Inquiry.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentInquiries'))\
                       .prefetch_related(Prefetch('periods',
                                         queryset=Period.select_related(Period.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentPeriods'))
        
    @property    
    def privilegeSource(self):
        return self
        
    def fetchPrivilege(self, user):
        parentPrivilege = self.parent.privilegeSource.fetchPrivilege(user)
        if parentPrivilege:
            return parentPrivilege
        elif self.canRegister == 'yes':
            return "register"
        else:
            return None

    def getData(self, fields, context):
        data = super(Session, self).getData(fields, context)
        
        if context.canRead(self):
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
            if self.registrationDeadline:
                data['registration deadline'] = self.registrationDeadline
            if self.start:
                data['start'] = self.start
            if self.end:
                data['end'] = self.end
            if self.canRegister:
                data['can register'] = self.canRegister
            
            if 'engagements' in fields:    
                data['engagements'] = [i.headData(context) for i in self.currentEngagements]
                data['engagements'].sort(key=lambda s: s['description'])
            
            if 'enrollments' in fields:
                data['enrollments'] = [i.headData(context) for i in self.currentEnrollments]
                data['enrollments'].sort(key=lambda s: s['description'])
            
            if 'inquiries' in fields:
                data['inquiries'] = [i.headData(context) for i in self.currentInquiries]
                data['inquiries'].sort(key=lambda s: s['description'])
            
            data['periods'] = [i.getData([], context) for i in self.currentPeriods]
            data['periods'].sort(key=lambda s: s['description'])
                
        if 'parents' in fields:
            if 'offering' in fields:
                data['offering'] = self.parent.getData([], context)
            else:
                data['offering'] = self.parent.headData(context)
            if 'site' in fields:
                data['site'] = self.parent.parent.getData([], context)
            else:
                data['site'] = self.parent.parent.headData(context)
            if 'organization' in fields:
                data['organization'] = self.parent.parent.parent.getData([], context)
            else:
                data['organization'] = self.parent.parent.parent.headData(context)

        return data
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent')

    def order_by(queryset, context):
        return queryset.filter(Q(names__deleteTransaction__isnull=True)& 
                               (Q(names__languageCode=context.languageCode)|(Q(names__languageCode='en')&~Q(names__parent__names__languageCode=context.languageCode))))\
                       .order_by('names__text')
    
    def markDeleted(self, context):
        for name in self.currentNamesQuerySet:
            name.markDeleted(context)
        for i in self.engagements.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.enrollments.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.inquiries.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.periods.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Session, self).markDeleted(context)

    def validateCanRegister(data, key):
        validValues = ['no', 'yes']
        _validateEnumeration(data, key, validValues)
    
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
        
        _validateDate(data, 'registration deadline')
        _validateDate(data, 'start')
        _validateDate(data, 'end')
        Session.validateCanRegister(data, 'can register')
           
        newItem = Session.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 registrationDeadline=_orNone(data, 'registration deadline'),
                                 start=_orNone(data, 'start'),
                                 end=_orNone(data, 'end'),
                                 canRegister=_orNone(data, 'can register'),
                                )
        
        newItem.createChildren(data, 'names', context, SessionName, newIDs)
        newItem.createChildren(data, 'engagements', context, Engagement, newIDs)
        newItem.createChildren(data, 'enrollments', context, Enrollment, newIDs)
        newItem.createChildren(data, 'inquiries', context, Inquiry, newIDs)
        newItem.createChildren(data, 'periods', context, Period, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return SessionHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             registrationDeadline=self.registrationDeadline,
                                             start=self.start,
                                             end=self.end,
                                             canRegister=self.canRegister)
        
    def revert(self, h):
        self.registrationDeadline = h.registrationDeadline 
        self.start = h.start 
        self.end = h.end 
        self.canRegister = h.canRegister 
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise PermissionDenied('you do not have permission to complete this update')
        
        _validateDate(changes, 'start')
        _validateDate(changes, 'end')
        testStart = changes['start'] if 'start' in changes and changes['start'] else (self.start or "0000-00-00")
        testEnd = changes['end'] if 'end' in changes and changes['end'] else (self.end or "9999-99-99")
        if testStart > testEnd:
            raise ValueError('the start date of a session cannot be after the end date of the session')
        
        history = None
        if 'registration deadline' in changes and changes['registration deadline'] != self.registrationDeadline:
            _validateDate(changes, 'registration deadline')
            history = history or self.buildHistory(context)
            self.registrationDeadline = changes['registration deadline'] or None
        if 'start' in changes and changes['start'] != self.start:
            history = history or self.buildHistory(context)
            self.start = changes['start'] or None
        if 'end' in changes and changes['end'] != self.end:
            history = history or self.buildHistory(context)
            self.end = changes['end'] or None
        if 'can register' in changes and changes['can register'] != self.canRegister:
            Session.validateCanRegister(changes, 'can register')
            history = history or self.buildHistory(context)
            self.canRegister = changes['can register'] or None
        
        self.updateChildren(changes, 'names', context, SessionName, self.names, newIDs)
        self.updateChildren(changes, 'engagements', context, Engagement, self.engagements, newIDs)
        self.updateChildren(changes, 'enrollments', context, Enrollment, self.enrollments, newIDs)
        self.updateChildren(changes, 'inquiries', context, Inquiry, self.inquiries, newIDs)
        self.updateChildren(changes, 'periods', context, Period, self.periods, newIDs)
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class SessionHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('sessionHistories')
    instance = historyInstanceField(Session)

    registrationDeadline = dbmodels.CharField(max_length=10, db_index=True, null=True)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    canRegister = dbmodels.CharField(max_length=10, db_index=True, null=True)

class SessionName(TranslationInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdSessionNames')
    lastTransaction = lastTransactionField('changedSessionNames')
    deleteTransaction = deleteTransactionField('deletedSessionNames')

    parent = parentField(Session, 'names')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {'inquiry': ('inquiries__', 'Inquiry', 'parent'),}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent__parent')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(SessionName.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return SessionNameHistory

class SessionNameHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('sessionNameHistories')
    instance = historyInstanceField(SessionName)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class Site(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdSites')
    lastTransaction = lastTransactionField('changedSites')
    deleteTransaction = deleteTransactionField('deletedSites')
    parent = parentField('consentrecords.Organization', 'sites')
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True)

    fieldMap = {'web site': 'webSite',
               }
               
    elementMap = {'name': ('names__', 'SiteName', 'parent'),
                  'offering': ('offerings__', 'Offering', 'parent'),
                  'address': ('addresses__', 'Address', 'parent'),
                  'organization': ('parent__', 'Organization', 'sites'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=SiteName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet, fields=[]):
        return Site.select_head_related(querySet)\
                       .prefetch_related(Prefetch('addresses',
                                         queryset=Address.select_related(Address.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentAddresses'))\
                       .prefetch_related(Prefetch('offerings',
                                         queryset=Offering.select_head_related(Offering.objects.filter(deleteTransaction__isnull=True)),
                                         to_attr='currentOfferings'))
        
    def getData(self, fields, context):
        data = super(Site, self).getData(fields, context)
        if context.canRead(self):
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
            if self.webSite:
                data['web site'] = self.webSite
            
            qs = self.currentAddresses
            if len(qs):
                if 'address' in fields:
                    data['address'] = qs[0].getData([], context)
                else:
                    data['address'] = qs[0].headData(context)
            
            if 'offerings' in fields:    
                data['offerings'] = [i.headData(context) for i in self.currentOfferings]
                data['offerings'].sort(key=lambda s: s['description'])
                
            if 'parents' in fields:
                if context.canRead(self.parent):
                    if 'organization' in fields:
                        data['organization'] = self.parent.getData([], context)
                    else:
                        data['organization'] = self.parent.headData(context)
        return data
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent')

    def order_by(queryset, context):
        return queryset.filter(Q(names__deleteTransaction__isnull=True)& 
                               (Q(names__languageCode=context.languageCode)|(Q(names__languageCode='en')&~Q(names__parent__names__languageCode=context.languageCode))))\
                       .order_by('names__text')
    
    def markDeleted(self, context):
        for name in self.currentNamesQuerySet:
            name.markDeleted(context)
        for i in self.addresses.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.offerings.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Site, self).markDeleted(context)
            
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = Site.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 webSite=_orNone(data, 'web site'),
                                )
        
        newItem.createChildren(data, 'names', context, SiteName, newIDs)
        newItem.createChildren(data, 'offerings', context, Offering, newIDs)
        
        if 'address' in data:
            Address.create(newItem, data['address'], context, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return SiteHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             webSite=self.webSite)
        
    def revert(self, h):
        self.webSite = h.webSite 
    
    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.webSite or '-')
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'web site' in changes and changes['web site'] != self.webSite:
            history = history or self.buildHistory(context)
            self.webSite = changes['web site'] or None
        
        self.updateChildren(changes, 'names', context, SiteName, self.names, newIDs)
        self.updateChildren(changes, 'addresses', context, Address, self.addresses, newIDs)
        self.updateChildren(changes, 'offerings', context, Offering, self.offerings, newIDs)
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class SiteHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('siteHistories')
    instance = historyInstanceField(Site)
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.webSite or '-')
           
class SiteName(TranslationInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdSiteNames')
    lastTransaction = lastTransactionField('changedSiteNames')
    deleteTransaction = deleteTransactionField('deletedSiteNames')

    parent = parentField(Site, 'names')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'text': 'text',
                'language code': 'languageCode',
               }
               
    elementMap = {}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

    def create(parent, data, context, newIDs={}):
        return TranslationInstance.create(SiteName.objects, parent, data, context, newIDs)
        
    @property
    def historyType(self):
        return SiteNameHistory

class SiteNameHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('siteNameHistories')
    instance = historyInstanceField(SiteName)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    languageCode = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    
    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.languageCode or '-', self.text or '-')
           
class Street(ChildInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdStreets')
    lastTransaction = lastTransactionField('changedStreets')
    deleteTransaction = deleteTransactionField('deletedStreets')
    
    parent = parentField('consentrecords.Address', 'streets')
    position = dbmodels.IntegerField()
    text = dbmodels.CharField(max_length=255, null=True)

    fieldMap = {'position': 'position',
                'text': 'text',
               }
               
    elementMap = {}
    
    def description(self, languageCode=None):
        return self.text
    
    def __str__(self):
        return self.text or ''
        
    def select_head_related(querySet):
        return querySet

    def select_related(querySet, fields=[]):
        return querySet

    def headData(self, context):
        data = super(Street, self).headData(context)
        data['position'] = self.position
        data['text'] = self.text
        return data
               
    def getData(self, fields, context):
        return self.headData(context)
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent')

    def order_by(queryset, context):
        return queryset.order_by('position')
        
    def create(parent, data, context, newIDs={}):
        newItem = Street.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=data['position'],
                                 text=_orNone(data, 'text'),
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return StreetHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             position=self.position,
                                             text=self.text)
        
    def revert(self, h):
        self.position = h.position 
        self.text = h.text 

    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'text' in changes and changes['text'] != self.text:
            history = history or self.buildHistory(context)
            self.text = changes['text'] or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class StreetHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('streetHistories')
    instance = historyInstanceField(Street)
    position = dbmodels.IntegerField(editable=False)
    text = dbmodels.CharField(max_length=255, null=True, editable=False)

class User(SecureRootInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUsers')
    lastTransaction = lastTransactionField('changedUsers')
    deleteTransaction = deleteTransactionField('deletedUsers')

    firstName = dbmodels.CharField(max_length=255, db_index=True, null=True)
    lastName = dbmodels.CharField(max_length=255, db_index=True, null=True)
    birthday = dbmodels.CharField(max_length=10, db_index=True, null=True)
    
    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administeredUsers', db_index=True, null=True, on_delete=dbmodels.CASCADE)

    fieldMap = {'first name': 'firstName',
                'last name': 'lastName',
                'birthday': 'birthday',
               }
               
    elementMap = {'email': ('emails__', 'UserEmail', 'parent'),
                  'notification': ('notifications__', "Notification", 'parent'),
                  'path': ('paths__', "Path", 'parent'),
                  'user grant request': ('userGrantRequests__', "UserUserGrantRequest", 'parent'),
                  'engagement': ('userEngagements__', "Engagement", 'user'),
                  'group':('groupMembers__parent__', 'Group', 'members__user'),
                 }

    @property
    def path(self):
        return self.paths.filter(deleteTransaction__isnull=True)[0]
        
    @property
    def currentEmailsQuerySet(self):
        return self.emails.filter(deleteTransaction__isnull=True).order_by('position')
    
    def __init__(self, *args, **kwargs):
        super(User, self).__init__(*args, **kwargs)
        self._authUser = None

    def description(self, language=None):
        qs = self.currentEmailsQuerySet
        if len(qs):
            return qs[0].text
        else:
            return 'Unbound user: %s %s' % (self.firstName, self.lastName)
        
    def __str__(self):
        return self.description()
    
    @property    
    def fullName(self):
        if self.firstName:
            if self.lastName:
                return "%s %s" % (self.firstName, self.lastName)
            else:
                return self.firstName
        else:
            return self.lastName
        
    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('emails',
                                                  queryset=UserEmail.objects.filter(deleteTransaction__isnull=True).order_by('position'),
                                                  to_attr='currentEMails'))

    def select_related(querySet, fields=[]):
        qs = User.select_head_related(querySet)
        if 'path' in fields:
            qs = qs.prefetch_related(Prefetch('paths',
                                         queryset=Path.select_related(Path.objects.filter(deleteTransaction__isnull=True), []),
                                         to_attr='currentPaths'))
        if 'notifications' in fields:
            qs = qs.prefetch_related(Prefetch('notifications',
                                         queryset=Notification.select_related(Notification.objects.filter(deleteTransaction__isnull=True).order_by('transaction__creation_time'), []),
                                         to_attr='currentNotifications'))
        return qs
        
    def getAuthorizedUserQuerySet(authUser):
        return User.objects.filter(deleteTransaction__isnull=True, 
                                   emails__text=authUser.email, 
                                   emails__deleteTransaction__isnull=True)
    
    def getData(self, fields, context):
        data = super(User, self).getData(fields, context)
        
        if self.birthday: data['birthday'] = self.birthday
        if self.firstName: data['first name'] = self.firstName
        if self.lastName: data['last name'] = self.lastName
        if 'system access' in fields:
            if context.is_administrator:
                data['system access'] = 'administer'
            elif context.is_staff:
                data['system access'] = 'write'

        emails = self.currentEMails
        if 'emails' in fields: 
            data['emails'] = [i.getData([], context) for i in emails]
        else:
            data['emails'] = [i.headData(context) for i in emails]

        if 'path' in fields: 
            data['path'] = self.currentPaths[0].getData([], context)

        if 'notifications' in fields: 
            data['notifications'] = [i.getData([], context) for i in self.currentNotifications]

        if context.getPrivilege(self) == 'administer':
            if 'user grant requests' in fields: 
                data['user grant requests'] = [i.getData([], context) for i in \
                    UserUserGrantRequest.select_related(self.userGrantRequests.filter(deleteTransaction__isnull=True))]

        return data
    
    @property
    def authUser(self):
        if not self._authUser:
            emails = self.currentEmailsQuerySet
            if not emails.count():
                return AnonymousUser()
            qs = AuthUser.objects.filter(email=emails[0].text)
            self._authUser = qs[0] if len(qs) else AnonymousUser()
        return self._authUser
        
    @property
    def is_administrator(self):
        return self.authUser and self.authUser.is_superuser
            
    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user), User

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, '')

    def order_by(queryset, context):
        return queryset.filter(Q(emails__deleteTransaction__isnull=True)& 
                               Q(emails__position=0))\
                       .order_by('emails__text')
    
    def markDeleted(self, context):
        for i in self.emails.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.notifications.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.paths.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.userGrantRequests.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(User, self).markDeleted(context)

    def validateBirthday(data, key):
        if key not in data:
            return
        if not data[key]:
            raise ValuError('birthday can not be empty if specified')
        _validateDate(data, key)
    
    def create(data, context, newIDs={}):
        User.validateBirthday(data, 'birthday')
        
        # Handle special case for primary administrator when creating a new SecureRootInstance subclass.
        if 'primary administrator' in data and data['primary administrator'] == 'user/%s' % id.hex:
            primaryAdministrator = User.objects.get(pk=id)
        else:
            primaryAdministrator = _orNoneForeignKey(data, 'primary administrator', context, User)
            
        newItem = User.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 firstName = _orNone(data, 'first name'),
                                 lastName = _orNone(data, 'last name'),
                                 birthday = _orNone(data, 'birthday'),
                                 publicAccess=_orNone(data, 'public access'),
                                 primaryAdministrator=primaryAdministrator,
                                )
        
        # If there was no administrator associated with this user, then set the
        # primaryAdministrator to the user itself.                        
        if not primaryAdministrator:
            newItem.primaryAdministrator = newItem
            newItem.save()
        
        newItem.createChildren(data, 'user grants', context, UserGrant, newIDs)
        newItem.createChildren(data, 'group grants', context, GroupGrant, newIDs)
        
        newItem.createChildren(data, 'emails', context, UserEmail, newIDs)
        if not context.user:
            context.user = newItem
            
        if 'path' in data:
            Path.create(newItem, data['path'], context, newIDs=newIDs)
        else:
            Path.create(newItem, {}, context, newIDs=newIDs)
        
        newItem.createChildren(data, 'user grant requests', context, UserUserGrantRequest, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return UserHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             firstName=self.firstName,
                                             lastName=self.lastName,
                                             birthday=self.birthday,
                                             publicAccess=self.publicAccess,
                                             primaryAdministrator=self.primaryAdministrator)
    
    def revert(self, h):
        self.firstName = h.firstName
        self.lastName = h.lastName
        self.birthday = h.birthday
        self.publicAccess = h.publicAccess
        self.primaryAdministrator = h.primaryAdministrator
            
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        if 'birthday' in changes:
            _validateDate(changes, 'birthday')
            
        history = None
        if 'first name' in changes and changes['first name'] != self.firstName:
            history = history or self.buildHistory(context)
            self.firstName = changes['first name'] or None
        if 'last name' in changes and changes['last name'] != self.lastName:
            history = history or self.buildHistory(context)
            self.lastName = changes['last name'] or None
        if 'birthday' in changes and changes['birthday'] != self.birthday:
            history = history or self.buildHistory(context)
            self.birthday = changes['birthday'] or None
        
        self.updateChildren(changes, 'emails', context, UserEmail, self.emails, newIDs)
        if 'path' in changes:
            self.path.update(changes['path'], context, newIDs)
        self.updateChildren(changes, 'user grant requests', context, UserUserGrantRequest, self.userGrantRequests, newIDs)
        if 'public access' in changes and changes['public access'] != self.publicAccess:
            SecureRootInstance.valueCheckPublicAccess(changes, 'public access')
            history = history or self.buildHistory(context)
            self.publicAccess = changes['public access'] or None
        if 'primary administrator' in changes:
            newValue = _getForeignKey(changes['primary administrator'], context, User)
            if newValue != self.primaryAdministrator:
                 SecureRootInstance.valueCheckPrimaryAdministrator(newValue)
                 history = history or self.buildHistory(context)
                 self.primaryAdministrator = newValue or None
        if context.canAdminister(self):
            self.updateChildren(changes, 'user grants', context, UserGrant, self.userGrants, newIDs)
            self.updateChildren(changes, 'group grants', context, GroupGrant, self.groupGrants, newIDs)
            self.updateChildren(changes, 'notifications', context, Notification, self.notifications, newIDs)
        
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class UserHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userHistories')
    instance = historyInstanceField(User)

    firstName = dbmodels.CharField(max_length=255, null=True, editable=False)
    lastName = dbmodels.CharField(max_length=255, null=True, editable=False)
    birthday = dbmodels.CharField(max_length=10, null=True, editable=False)
    publicAccess = dbmodels.CharField(max_length=10, null=True, editable=False)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administeredUserHistories', db_index=True, null=True, on_delete=dbmodels.CASCADE)

### A Multiple String Value containing an email associated with the specified user.
class UserEmail(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUserEmails')
    lastTransaction = lastTransactionField('changedUserEmails')
    deleteTransaction = deleteTransactionField('deletedUserEmails')

    parent = parentField(User, 'emails')
    text = dbmodels.CharField(max_length=255, db_index=True, null=True)
    position = dbmodels.IntegerField()
    
    def description(self, languageCode=None):
        return self.text
    
    def __str__(self):
        return self.description()
    
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet, fields=[]):
        return querySet
        
    def headData(self, context):
        data = super(UserEmail, self).headData(context)
        data['position'] = self.position
        data['text'] = self.text
        return data
               
    def getData(self, fields, context):
        return self.headData(context)
        
    def order_by(queryset, context):
        return queryset.order_by('position')
    
    fieldMap = {'text': 'text',
                'position': 'position',
               }
               
    elementMap = {}

    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), User

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent')

    def validateText(data, key):
        if key in data and data[key]:
            if _isEmail(data[key]):
                return
            else:
                raise ValueError('the email address "%s" is not a valid email address' % data[key])
        else:
            raise ValueError('an email address is required in the "%s" field' % key)
            
    def create(parent, data, context, newIDs={}):
        UserEmail.validateText(data, 'text')
        
        newItem = UserEmail.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=data['position'],
                                 text=data['text'],
                                )
        
        return newItem                          
        
    def buildHistory(self, context):
        return UserEmailHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             text=self.text,
                                             position=self.position)
        
    def revert(self, h):
        self.position = h.position 
        self.text = h.text 

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.text or '-')
           
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'text' in changes and changes['text'] != self.text:
            UserEmail.validateText(changes, 'text')
            history = history or self.buildHistory(context)
            self.text = changes['text']
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class UserEmailHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userEmailHistories')
    instance = historyInstanceField(UserEmail)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)

    @property    
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.text or '-')
           
### A Multiple Picked Value
class UserUserGrantRequest(AccessInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUserUserGrantRequests')
    lastTransaction = lastTransactionField('changedUserUserGrantRequests')
    deleteTransaction = deleteTransactionField('deletedUserUserGrantRequests')

    parent = parentField(User, 'userGrantRequests')
    grantee = dbmodels.ForeignKey(User, related_name='userUserGrantRequests', db_index=True, on_delete=dbmodels.CASCADE)

    def __str__(self):
        return self.description()
    
    fieldMap = {}
               
    elementMap = {'grantee': ('grantee__', 'User', 'userUserGrantRequests'),
                  'parent': ('parent__', "User", 'userGrantRequests'),
                 }

    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), User

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent')

    def order_by(queryset, context):
        return queryset.filter(Q(grantee__emails__deleteTransaction__isnull=True)& 
                               Q(grantee__emails__position=0))\
                       .order_by('grantee__emails__text')
    
    def create(parent, data, context, newIDs={}):
        newItem = UserUserGrantRequest.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, User),
                                 )
        
        return newItem                          
        
    def buildHistory(self, context):
        return UserUserGrantRequestHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             grantee=self.grantee)
        
    def revert(self, h):
        self.grantee = h.grantee 

    def update(self, changes, context, newIDs={}):
        if not context.canAdminister(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'grantee' in changes:
            newValue = _orNoneForeignKey(changes, 'grantee', context, User)
            if newValue != self.grantee:
                 history = history or self.buildHistory(context)
                 self.grantee = newValue or None
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class UserUserGrantRequestHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userUserGrantRequestHistories')
    instance = historyInstanceField(UserUserGrantRequest)

    grantee = dbmodels.ForeignKey(User, related_name='userUserGrantRequestHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)

class Context:
    def __init__(self, languageCode, user, propertyList=None, hostURL=None):
        self.languageCode = languageCode
        self._transaction = None
        if user:
            if type(user) == User:
                self.user = user
                self.authUser = user.authUser
            else:
                self.user = None
                self.authUser = user
                if self.authUser.is_authenticated:
                    qs = User.getAuthorizedUserQuerySet(user)
                    if qs.exists():
                        self.user = User.select_related(qs)[0]
                    else:
                        self.user = self.createUserInstance(propertyList)
                    if not self.user.paths.filter(deleteTransaction__isnull=True).exists():
                        Path.create(self.user, {}, context)
        else:
            self.user = None
            self.authUser = AnonymousUser()
        self._privileges = {}
        self._hostURL = hostURL
        
    def __str__(self):
        return "context: %s/%s" % (str(self.user), self.languageCode)
        
    def createUserInstance(self, propertyList):
        if not propertyList: propertyList = {}
        propertyList['emails'] = [{'text': self.authUser.email, 'position': 0}]
        if self.authUser.first_name:
            propertyList['first name'] = self.authUser.first_name
        if self.authUser.last_name:
            propertyList['last name'] = self.authUser.last_name
        self.user = User.create(propertyList, self)
                    
        return self.user
            
    def getPrivilege(self, i):
        if self.is_administrator:
            return "administer"
            
        j = i.privilegeSource
            
        if j.id not in self._privileges:
            self._privileges[j.id] = j.fetchPrivilege(self.user)
        return self._privileges[j.id]
    
    @property
    def is_administrator(self):
        return self.authUser and self.authUser.is_superuser
    
    @property
    def transaction(self):
        if not self._transaction:
            if not self.authUser.is_authenticated:
                raise RuntimeError("transactions cannot be created without authenticated users")
            self._transaction = Transaction.createTransaction(self.authUser) 
        return self._transaction
         
    @property
    def is_staff(self):
        return self.authUser and self.authUser.is_staff
        
    @property
    def hostURL(self):
        return self._hostURL
            
    def canRead(self, i):
        privilege = self.getPrivilege(i)
        return privilege in ["read", "write", "administer"]
    
    def canWrite(self, i):
        privilege = self.getPrivilege(i)
        return privilege in ["write", "administer"]

    def canAdminister(self, i):
        privilege = self.getPrivilege(i)
        return privilege == "administer"
