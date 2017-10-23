from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import connection
from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch, Case, When, Min
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
            raise ValueError('unrecognized %s' % resources[qsType])
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

def _subFields(fields, parentField):
    prefix = parentField + '/'
    start = len(prefix)
    return list(map(lambda s: s[start:], 
        filter(lambda s: s.startswith(prefix), fields)))

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
    
    def checkCanWrite(self, context):
        if not context.canWrite(self):
            raise PermissionDenied('you do not have sufficient write privileges for this operation')
    
    def markDeleted(self, context):
        if self.deleteTransaction_id:
            raise RuntimeError('%s is already deleted' % str(self))
        self.checkCanWrite(context)
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
             'group name': GroupName,
             'group member': GroupMember,
             'inquiry': Inquiry,
             'notification': Notification,
             'notification argument': NotificationArgument,
             'offering': Offering,
             'offering name': OfferingName,
             'offering service': OfferingService,
             'organization': Organization,
             'organization group grant': OrganizationGroupGrant,
             'organization name': OrganizationName,
             'organization user grant': OrganizationUserGrant,
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
             'user group grant': UserGroupGrant,
             'user user grant': UserUserGrant,
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

    def getData(self, fields, context):
        data = super(SecureRootInstance, self).getData(fields, context)

        if context.getPrivilege(self) == 'administer':
            if self.publicAccess:
                data['public access'] = self.publicAccess
            if self.primaryAdministrator:
                data['primary administrator'] = self.primaryAdministrator.headData(context)
            if 'user grants' in fields:
                data['user grants'] = [i.getData([], context) for i in \
                                       UserUserGrant.order_by(self.userGrants.filter(deleteTransaction__isnull=True), context)]
            if 'group grants' in fields:
                data['group grants'] = [i.getData([], context) for i in \
                                        UserGroupGrant.order_by(self.groupGrants.filter(deleteTransaction__isnull=True), context)]

        return data
    
    def markDeleted(self, context):
        for i in self.userGrants.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.groupGrants.filter(deleteTransaction__isnull=True):
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
        return UserUserGrant.objects.filter(\
                privilege__in=privileges,
                deleteTransaction__isnull=True,
                grantee=user,
            ).values('grantor_id').union(\
            UserGroupGrant.objects.filter(\
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

class NamedInstance():
    def order_by(queryset, context):
        w1=When(names__languageCode=context.languageCode, names__deleteTransaction__isnull=True, then='names__text')
        if context.languageCode=='en':
            return queryset.annotate(ordering=Min(Case(w1))).order_by('ordering')
        else:
            w2=When(names__languageCode='en', names__deleteTransaction__isnull=True, then='names__text')
            return queryset.annotate(ordering=Min(Case(w1))).annotate(orderingen=Min(Case(w2)))\
                .order_by(Case(When(ordering__isnull=False, then='ordering'), default='orderingen'))
        
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
        self.checkCanWrite(context)
        
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
        parent.checkCanWrite(context)
            
        newItem = objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 text=_orNone(data, 'text'),
                                 languageCode=_orNone(data, 'languageCode'),
                                 )
        return newItem                         

### An instance that contains access information.
class Grant(IInstance):
    def description(self, languageCode=None):
        return self.grantee.description(languageCode)
        
    def select_head_related(querySet):
        return querySet.select_related('grantee')

    def select_related(querySet, fields=[]):
        return Grant.select_head_related(querySet)

    def headData(self, context):
        data = {'id': self.id.hex, 
                'description': self.description(context.languageCode), 
               }
        return data
        
    def getData(self, fields, context):
        data = self.headData(context)
        data['grantee'] = self.grantee.headData(context)
        data['privilege'] = self.privilege
        
        if 'parents' in fields:
            if context.canRead(self.grantor) and 'user' in fields:
                data['user'] = self.grantor.getData([], context)
            else:
                data['user'] = self.grantor.headData(context)
                
        return data
        
    def revert(self, h):
        self.grantee = h.grantee
        self.privilege = h.privilege
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s" % \
              (
                self.id, str(self.grantor), str(self.grantee), self.privilege or '-'
              )
     
    @property    
    def privilegeSource(self):
        return self
        
    def fetchPrivilege(self, user):
        return 'administer' if self.grantor.fetchPrivilege(user) == 'administer' else \
        'write' if self.grantee.id == user.id \
        else None
    
    def administrableQuerySet(qs, user):
            qClause = Q(grantor__primaryAdministrator=user) |\
                      Q(grantor__userGrants__grantee=user, 
                        grantor__userGrants__privilege='administer', 
                        grantor__userGrants__deleteTransaction__isnull=True) |\
                      Q(grantor__groupGrants__privilege='administer', 
                        grantor__groupGrants__deleteTransaction__isnull=True,
                        grantor__groupGrants__grantee__deleteTransaction__isnull=True,
                        grantor__groupGrants__grantee__members__user=user,
                        grantor__groupGrants__grantee__members__deleteTransaction__isnull=True)
            return qs.filter(qClause)
    
    def order_by(queryset, context):
        return queryset.filter(Q(grantee__emails__deleteTransaction__isnull=True)& 
                               Q(grantee__emails__position=0))\
                       .order_by('grantee__emails__text')
    
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
        self.checkCanWrite(context)
        
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
        if self.lastTransaction == context.transaction:
            return True # history has already been built
        else:
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
                
    def update(self, changes, context, newIDs={}):
        super(OrderedServiceLinkInstance, self).update(changes, context, newIDs)
        
        history = None
        if 'position' in changes:
            newPosition = int(changes['position'])
            if newPosition != self.position:
                history = history or self.buildHistory(context)
                self.position = newPosition
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class PublicInstance():
    def getSubClause(qs, user, accessType):
        return qs, accessType
        
    def filterForHeadData(qs, user, accessType):
        return qs

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

# The description of an instance.        
class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.OneToOneField('consentrecords.Instance', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)
                
# A denormalization that identifies instances that descend through the parent node to 
# other instances.
class Containment(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ancestor = dbmodels.ForeignKey('consentrecords.Instance', related_name='descendents', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    descendent = dbmodels.ForeignKey('consentrecords.Instance', related_name='ancestors', db_index=True, editable=False, on_delete=dbmodels.CASCADE)

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

### A Multiple Picked Value
class UserUserGrant(Grant, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUserGrants')
    lastTransaction = lastTransactionField('changedUserGrants')
    deleteTransaction = deleteTransactionField('deletedUserGrants')

    grantor = dbmodels.ForeignKey('consentrecords.User', related_name='userGrants', db_index=True, on_delete=dbmodels.CASCADE)
    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='userUserGrantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantor': ('grantor__', 'User', 'userGrants'),
                  'grantee': ('grantee__', 'User', 'userUserGrantees'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == UserUserGrant:
            return qs, accessType
        elif not user:
            return qs.none(), UserUserGrant
        elif user.is_administrator:
            return qs, UserUserGrant
        else:
            return Grant.administrableQuerySet(qs, user), UserUserGrant

    def filterForHeadData(qs, user, accessType):
        return UserUserGrant.getSubClause(qs, user, accessType)[0]
            
    def filterForGetData(qs, user, accessType):
        return UserUserGrant.getSubClause(qs, user, accessType)[0]
            
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
                                           grantee=grantee)
        if oldItem.exists():
            if parent == context.user:
                raise ValueError('%s is already following you' % str(grantee))
            else:
                raise ValueError('%s is already following %s' % (str(grantee), str(parent)))

        newItem = UserUserGrant.objects.create(transaction=context.transaction,
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
        
class UserUserGrantHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userGrantHistories')
    instance = historyInstanceField(UserUserGrant)

    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='granteeHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property
    def dataString(self):
        return"%s\t%s\t%s\t%s" % \
              (
                self.id, str(self.instance.grantor), str(self.grantee), self.privilege or '-'
              )
         
### A Multiple Picked Value
class UserGroupGrant(Grant, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroupGrants')
    lastTransaction = lastTransactionField('changedGroupGrants')
    deleteTransaction = deleteTransactionField('deletedGroupGrants')

    grantor = dbmodels.ForeignKey('consentrecords.User', related_name='groupGrants', db_index=True, on_delete=dbmodels.CASCADE)
    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='userGroupGrantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantor': ('grantor__', 'Group', 'groupGrants'),
                  'grantee': ('grantee__', 'Group', 'userGroupGrants'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == UserGroupGrant:
            return qs, accessType
        elif not user:
            return qs.none(), UserGroupGrant
        elif user.is_administrator:
            return qs, UserGroupGrant
        else:
            return Grant.administrableQuerySet(qs, user), UserGroupGrant

    def filterForHeadData(qs, user, accessType):
        return UserGroupGrant.getSubClause(qs, user, accessType)[0]
            
    def filterForGetData(qs, user, accessType):
        return UserGroupGrant.getSubClause(qs, user, accessType)[0]
            
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
                                           grantee=grantee)
        if oldItem.exists():
            if parent == context.user:
                raise ValueError('%s is already following you' % str(grantee))
            else:
                raise ValueError('%s is already following %s' % (str(grantee), str(parent)))

        newItem = UserGroupGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=parent.id,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, Group),
                                 privilege=_orNone(data, 'privilege'))
        
        return newItem                          
        
class UserGroupGrantHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('groupAccessHistories')
    instance = historyInstanceField(UserGroupGrant)

    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='granteeHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    
    @property
    def dataString(self):
        return"%s\t%s\t%s\t%s" % \
              (
                self.id, str(self.instance.grantor), str(self.grantee), self.privilege or '-'
              )
         
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent')
            
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s" % \
            (self.id, self.city or '-', self.state or '-', self.zipCode or '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s" % \
            (self.id, self.city or '-', self.state or '-', self.zipCode or '-')
           
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
        return querySet.select_related('asker')\
           .prefetch_related(Prefetch('asker__parent',
                                      queryset=\
                                         User.select_related(User.objects.filter(deleteTransaction__isnull=True)),
                                      to_attr='currentUser'))
        
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.text:
                data['text'] = self.text
            if self.asker:
                data['asker'] = self.asker.getData(['parents', 'user'], context)
            if self.question:
                data['question'] = self.question
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent__parent'), Path

    def filterForHeadData(qs, user, accessType):
        return Path.findableQuerySet(qs, user, prefix='parent__parent')
            
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
        
        if not (askerPath and question and context.user and askerPath == context.user.path and context.canRead(parent)):
            self.checkCanWrite(context)
        
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
    
    @property
    def dataString(self):
        return "%s\t%s\n\t%s\n\t%s" % \
            (self.id, 
             self.text or '-',
             str(self.asker) if self.asker else '-',
             self.question or '-',
             )
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
        history = None
        textChanging = 'text' in changes and changes['text'] and not self.text and changes['text'] != self.text
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
        
        if textChanging and self.asker and self.asker.id != context.user.path.id:
            follower = self.asker
            recipient = follower.parent
            recipientEMail = recipient.currentEmailsQuerySet[0].text
            experience = self.parent
            salutation = follower.name or recipient.firstName
            following = self.parent.parent
            isAdmin = context.is_administrator
            Emailer.sendAnswerExperienceQuestionEmail(salutation, recipientEMail, 
                experience, following, isAdmin, self, context.hostURL)

            # Create a notification for the asker.    
            n = Notification.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        name='crn.ExperienceQuestionAnswered',
                                        isFresh='yes',
                                        parent=follower.parent,
                                        )
            NotificationArgument.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        parent=n,
                                        position=0,
                                        argument=following.id.hex)
            NotificationArgument.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        parent=n,
                                        position=1,
                                        argument=experience.id.hex)
            NotificationArgument.objects.create(transaction=context.transaction,
                                        lastTransaction=context.transaction,
                                        parent=n,
                                        position=2,
                                        argument=self.id.hex)

class CommentHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentHistories')
    instance = historyInstanceField(Comment)
    
    text = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    question = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    asker = dbmodels.ForeignKey('consentrecords.Path', related_name='askedCommentHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    
    @property
    def dataString(self):
        return "%s\t%s\n\t%s\n\t%s" % \
            (self.id, 
             self.text or '-',
             str(self.asker) if self.asker else '-',
             self.question or '-',
             )
           
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
    
    @property
    def dataString(self):
        return self.id
            
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
        self.updateChildren(changes, 'translations', context, CommentPromptText, self.texts, newIDs)
                                                         
class CommentPromptHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentPromptHistories')
    instance = historyInstanceField(CommentPrompt)
    
    @property
    def dataString(self):
        return self.id
            
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
        parent.checkCanWrite(context)
           
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent')
            
    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, prefix='parent__parent__parent__parent')
            
    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def markDeleted(self, context):
        for i in self.experiences.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
            
        super(Engagement, self).markDeleted(context)
    
    def create(parent, data, context, newIDs={}):
        user = _orNoneForeignKey(data, 'user', context, User)
        newItem = Engagement.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=user,
                                 start=_orNone(data, 'start'),
                                 end=_orNone(data, 'end'),
                                )
        
        # When adding an inquiry, ensure that the inquiry access group of the organization 
        # containing the inquiry can read the user.
        organization = parent.parent.parent.parent
        if type(organization) != Organization:
            raise ValueError('this session is not associated with an organization')
        
        user.grantOrganizationDefaultGroupRead(organization, context)  
            
        offering = parent.parent
        newExperience = Experience.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=user.path,
                                 engagement=newItem,
                                 offering=offering,
                                 site=offering.parent,
                                 organization=organization,
                                 start=newItem.start,
                                 end=newItem.end)
        
        newExperience.cacheImplications()
                                 
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
    
    @property
    def dataString(self):
        return "%s\t%s\n\t%s\n\t%s" % \
            (self.id, 
             str(self.user) if self.user else '-',
             self.start,
             self.end,
             )
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
        
        experiences = self.user.path.experiences.filter(deleteTransaction__isnull=True, 
            engagement=self)
        if experiences.exists():
            experiences[0].update({'start': self.start, 'end': self.end}, context)
        else:
            offering = self.parent.parent
            newExperience = Experience.objects.create(transaction=context.transaction,
                lastTransaction=context.transaction,
                 parent=self.user.path,
                 organization = offering.parent.parent,
                 site = offering.parent,
                 offering = offering,
                 engagement = self,
                 start = self.start,
                 end = self.end,
                )
            newExperience.checkImplications()
        
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent__parent')
            
    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, prefix='parent__parent__parent__parent')
            
    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def create(parent, data, context, newIDs={}):
        user = _orNoneForeignKey(data, 'user', context, User)
        newItem = Enrollment.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=user,
                                )
        
        # When adding an inquiry, ensure that the inquiry access group of the organization 
        # containing the inquiry can read the user.
        organization = parent.parent.parent.parent
        if type(organization) != Organization:
            raise ValueError('this session is not associated with an organization')
        
        user.grantOrganizationDefaultGroupRead(organization, context)  
            
        return newItem                          
        
    def buildHistory(self, context):
        return EnrollmentHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             user=self.user)
        
    def revert(self, h):
        self.user = h.user 
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
    engagement = dbmodels.ForeignKey('consentrecords.Engagement', related_name='experiences', db_index=True, null=True, on_delete=dbmodels.CASCADE)
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
                  'engagement': ('engagement__', "Engagement", 'experiences'),
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
            return 'Unnamed Experience'
    
    def __str__(self):
        return self.description(None)
    
    def select_head_related(querySet):
        return querySet.select_related('parent')\
                       .select_related('offering')\
                       .select_related('engagement')\
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
                    subFields = _subFields(fields, 'offering')
                    if len(subFields):
                        offering = Offering.select_related(Offering.objects.filter(pk=self.offering_id), subFields)[0]
                    else:
                        offering = self.offering
                    data['offering'] = offering.getData(subFields, context)
                else:
                    data['offering'] = self.offering.headData(context)
            if self.engagement_id:
                if 'engagement' in fields:
                    data['engagement'] = self.engagement.getData([], context)
                else:
                    data['engagement'] = self.engagement.headData(context)
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

    def filterForHeadData(qs, user, accessType):
        return Path.findableQuerySet(qs, user, prefix='parent')
            
    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent')
            
    def checkCanWrite(self, context):
        if self.engagement and context.canWrite(self.engagement):
            return

        super(Experience, self).checkCanWrite(context)
    
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
        parent.checkCanWrite(context)
        
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
                                 engagement = _orNoneForeignKey(data, 'engagement', context, Engagement),
                                 timeframe = _orNone(data, 'timeframe'),
                                 start = _orNone(data, 'start'),
                                 end = _orNone(data, 'end'),
                                )
        if newItem.engagement and newItem.engagement.parent.parent != newItem.offering:
            newItem.offering = newItem.engagement.parent.parent
            newItem.save()
        
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
        if self.engagement:
            self.engagement.parent.parent.addServices(serviceSet)
        elif self.offering:
            self.offering.addServices(serviceSet)
        
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
                                             engagement=self.engagement,
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
        self.engagement = h.engagement 
        self.start = h.start 
        self.end = h.end 
        self.timeframe = h.timeframe 
    
    @property
    def dataString(self):
        s = "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s" % \
            (self.id, str(self.organization) if self.organization else '-', 
             self.customOrganization or '-',
             str(self.site) if self.site else '-',
             self.customSite or '-',
             str(self.offering) if self.offering else '-',
             self.customOffering or '-',
             str(self.engagement) if self.engagement else '-',
             self.start or '-',
             self.end or '-',
             self.timeframe or '-',
             )
        for j in self.experienceImplications.all():
            s += "\n\tImplied Service: %s" % str(j.service)
        return s
    
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
            if 'engagement' in changes:
                newValue = _orNoneForeignKey(changes, 'engagement', context, Engagement)
                if newValue != self.engagement:
                    history = history or self.buildHistory(context)
                    self.engagement = newValue
                    if newValue:
                        self.offering = newValue.parent.parent
                    
                    # Check that all of the services associated with this experience are correct.
                    self.checkImplications()
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
            implyingService__offeringServices__parent__experiences=self))\
            .union(Service.objects.filter(deleteTransaction__isnull=True,
            implyingService__deleteTransaction__isnull=True,
            implyingService__offeringServices__deleteTransaction__isnull=True,
            implyingService__offeringServices__parent__sessions__engagements__deleteTransaction__isnull=True,
            implyingService__offeringServices__parent__sessions__engagements__experiences=self))

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
    engagement = dbmodels.ForeignKey('consentrecords.Engagement', related_name='experienceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)
    start = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    end = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    timeframe = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property
    def dataString(self):
        s = "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s" % \
            (self.id, str(self.organization) if self.organization else '-', 
             self.customOrganization or '-',
             str(self.site) if self.site else '-',
             self.customSite or '-',
             str(self.offering) if self.offering else '-',
             self.customOffering or '-',
             str(self.engagement) if self.engagement else '-',
             self.start or '-',
             self.end or '-',
             self.timeframe or '-',
             )
        for j in self.experienceImplications.all():
            s += "\tImplied Service: %s" % str(j.service)
        return s
    
class ExperienceImplication(dbmodels.Model):
    id = idField()
    experience = dbmodels.ForeignKey('consentrecords.Experience', related_name='experienceImplications', db_index=True, null=False, on_delete=dbmodels.CASCADE)
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experienceImplications', db_index=True, null=False, on_delete=dbmodels.CASCADE)
    
    fieldMap = {}
                
    elementMap = {'experience': ('experience__', 'Experience', 'experienceImplications'),
                  'service': ('service__', 'Service', 'experienceImplications'),
                 }
    
    @property
    def dataString(self):
        return "%s\t%s\t%s" % \
            (self.id, 
             str(self.experience) if self.experience else '-',
             str(self.service) if self.service else '-',
             )
    
    def __str__(self):
        return self.dataString
    
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

    def filterForHeadData(qs, user, accessType):
        return Path.findableQuerySet(qs, user, prefix='parent__parent')
    
    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent__parent')
    
    def order_by(queryset, context):
        return queryset.order_by('position')
                
    def create(parent, data, context, newIDs={}):
        parent.checkCanWrite(context)
        
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

    @property
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, (self.position if (self.position != None) else '-'), self.name or '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, (self.position if (self.position != None) else '-'), self.name or '-')
           
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
    
    def filterForHeadData(qs, user, accessType):
        return Path.findableQuerySet(qs, user, prefix='parent__parent')
            
    def filterForGetData(qs, user, accessType):
        return Path.readableQuerySet(qs, user, prefix='parent__parent')
            
    def create(parent, data, context, newIDs={}):
        parent.checkCanWrite(context)
        
        service = _orNoneForeignKey(data, 'service', context, Service)
        if not service:
            raise ValueError("service of a new experience service is not specified")
        
        if 'position' not in data:
            raise ValueError("position of a new experience service is not specified")
            
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
    
    def update(self, changes, context, newIDs={}):
        super(ExperienceService, self).update(changes, context, newIDs)
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s" %\
            (self.id,
             self.name or '-',
             str(self.organization) if self.organization else '-',
             str(self.site) if self.site else '-',
             str(self.offering) if self.offering else '-',
             self.domain or '-',
             self.stage or '-',
             self.timeframe or '-'
            )
             
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
        parent.checkCanWrite(context)
           
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
    
    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent')

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
        parent.checkCanWrite(context)
           
        newItem = Group.objects.create(transaction=context.transaction,
                                 parent=parent,
                                )
        
        newItem.createChildren(data, 'names', context, GroupName, newIDs)
        newItem.createChildren(data, 'members', context, GroupMember, newIDs)
        
        return newItem                          
        
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
        self.updateChildren(changes, 'names', context, GroupName, self.names, newIDs)
        self.updateChildren(changes, 'members', context, GroupMember, self.members, newIDs)
            
    @property    
    def dataString(self):
        return "%s" % (self.id)
           
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent')

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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent')

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

    def order_by(queryset, context):
        return queryset.filter(Q(user__emails__deleteTransaction__isnull=True)& 
                               Q(user__emails__position=0))\
                       .order_by('user__emails__text')
    
    def create(parent, data, context, newIDs={}):
        parent.checkCanWrite(context)
           
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

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, str(self.user) if self.user else '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, str(self.user) if self.user else '-')
           
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent__parent')

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
        elif type(user) != User:
            raise ValueError('the specified user was not a user: %s' % user)
        
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
        
        user.grantOrganizationDefaultGroupRead(organization, context)  
            
        return newItem                          
        
    def buildHistory(self, context):
        return InquiryHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             user=self.user)
        
    def revert(self, h):
        self.user = h.user 

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, str(self.user) if self.user else '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, str(self.user) if self.user else '-')
           
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
            return [Path, Experience, Comment]
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent')

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
    
    @property
    def dataString(self):
        s = "%s\t%s\t%s\t%s" % \
        (self.id, 
         str(self.parent),
         self.name or '-',
         self.isFresh or '-',
         )
        for na in self.notificationArguments.filter(deleteTransaction__isnull=True).order_by('position'):
            s+= "\n\t%s\t%s\t%s" % \
                  (na.id, na.position, na.argument)
        return s

    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
    
    @property
    def dataString(self):
        s = "%s\t%s\t%s\t%s" % \
        (self.id, 
         str(self.parent),
         self.name or '-',
         self.isFresh or '-',
         )
        return s

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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent')

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
        
            data['services'] = [i.getData([], context) for i in self.currentServices]
            
            if 'sessions' in fields:
                data['sessions'] = [i.getData([], context) for i in self.currentSessions]
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent')

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent')

    def order_by(queryset, context):
        return NamedInstance.order_by(queryset, context)
    
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

    def addServices(self, serviceSet):
        for os in self.services.filter(deleteTransaction__isnull=True):
            for imp in os.service.serviceImplications.filter(deleteTransaction__isnull=True):
                serviceSet.add(imp.impliedService)

    def create(parent, data, context, newIDs={}):
        parent.checkCanWrite(context)
           
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
        self.checkCanWrite(context)
        
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent')

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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent')

    def filterForGetData(qs, user, accessType):
        return SecureRootInstance.readableQuerySet(qs, user, 'parent__parent__parent')

    def create(parent, data, context, newIDs={}):
        parent.checkCanWrite(context)
           
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
                  'user grant': ('userGrants__', 'OrganizationUserGrant', 'grantor'),
                  'group grant': ('groupGrants__', 'OrganizationGroupGrant', 'grantor'),
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, '')

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
        
        newItem.createChildren(data, 'user grants', context, UserUserGrant, newIDs)
        newItem.createChildren(data, 'group grants', context, UserGroupGrant, newIDs)
        
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s" % \
            (self.id, self.webSite or '-', 
             str(self.inquiryAccessGroup) if self.inquiryAccessGroup else '-',
             self.publicAccess or '-',
             str(self.primaryAdministrator) if self.primaryAdministrator else '-',
            )
    
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
            self.updateChildren(changes, 'user grants', context, UserUserGrant, self.userGrants, newIDs)
            self.updateChildren(changes, 'group grants', context, UserGroupGrant, self.groupGrants, newIDs)
        
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent')

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
           
### A Multiple Picked Value
class OrganizationUserGrant(Grant, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdOrganizationUserGrants')
    lastTransaction = lastTransactionField('changedOrganizationUserGrants')
    deleteTransaction = deleteTransactionField('deletedOrganizationUserGrants')

    grantor = dbmodels.ForeignKey('consentrecords.Organization', related_name='userGrants', db_index=True, on_delete=dbmodels.CASCADE)
    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='organizationUserGrantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantee': ('grantee__', 'User', 'organizationUserGrantees'),
                  'grantor': ('grantor__', 'Organization', 'userGrants'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == OrganizationUserGrant:
            return qs, accessType
        elif not user:
            return qs.none(), OrganizationUserGrant
        elif user.is_administrator:
            return qs, OrganizationUserGrant
        else:
            return Grant.administrableQuerySet(qs, user), OrganizationUserGrant

    def filterForHeadData(qs, user, accessType):
        return OrganizationUserGrant.getSubClause(qs, user, accessType)[0]
            
    def filterForGetData(qs, user, accessType):
        return OrganizationUserGrant.getSubClause(qs, user, accessType)[0]
            
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
                                           grantee=grantee)
        if oldItem.exists():
            if parent == context.user:
                raise ValueError('%s is already following you' % str(grantee))
            else:
                raise ValueError('%s is already following %s' % (str(grantee), str(parent)))

        newItem = OrganizationUserGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=parent.id,
                                 grantee=grantee,
                                 privilege=data['privilege'])
        
        return newItem                          
        
class OrganizationUserGrantHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('organizationUserGrantHistories')
    instance = historyInstanceField(OrganizationUserGrant)

    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='organizationGranteeHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

    @property
    def dataString(self):
        return"%s\t%s\t%s\t%s" % \
              (
                self.id, str(self.instance.grantor), str(self.grantee), self.privilege or '-'
              )
         
### A Multiple Picked Value
class OrganizationGroupGrant(Grant, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdOrganizationGroupGrants')
    lastTransaction = lastTransactionField('changedOrganizationGroupGrants')
    deleteTransaction = deleteTransactionField('deletedOrganizationGroupGrants')

    grantor = dbmodels.ForeignKey('consentrecords.Organization', related_name='groupGrants', db_index=True, on_delete=dbmodels.CASCADE)
    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='organizationGroupGrantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantor': ('grantor__', 'Group', 'groupGrants'),
                  'grantee': ('grantee__', 'Group', 'organizationGroupGrantees'),
                  }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == OrganizationGroupGrant:
            return qs, accessType
        elif not user:
            return qs.none(), OrganizationGroupGrant
        elif user.is_administrator:
            return qs, OrganizationGroupGrant
        else:
            return Grant.administrableQuerySet(qs, user), OrganizationGroupGrant

    def filterForHeadData(qs, user, accessType):
        return OrganizationGroupGrant.getSubClause(qs, user, accessType)[0]
            
    def filterForGetData(qs, user, accessType):
        return OrganizationGroupGrant.getSubClause(qs, user, accessType)[0]
            
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
                                           grantee=grantee)
        if oldItem.exists():
            if parent == context.user:
                raise ValueError('%s is already following you' % str(grantee))
            else:
                raise ValueError('%s is already following %s' % (str(grantee), str(parent)))

        newItem = OrganizationGroupGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=parent.id,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, Group),
                                 privilege=_orNone(data, 'privilege'))
        
        return newItem                          
        
class OrganizationGroupGrantHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('organizationGroupGrantHistories')
    instance = historyInstanceField(OrganizationGroupGrant)

    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='organizationGranteeHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    
    @property
    def dataString(self):
        return"%s\t%s\t%s\t%s" % \
              (
                self.id, str(self.instance.grantor), str(self.grantee), self.privilege or '-'
              )
         
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
        qs = Path.select_head_related(querySet)
        if 'user' in fields:
            qs = qs.prefetch_related(Prefetch('parent',
                queryset=User.select_related(User.objects.filter(deleteTransaction__isnull=True)),
                to_attr='currentUser'))
        if 'experiences' in fields:
            qs = qs.prefetch_related(Prefetch('experiences',
                queryset=Experience.select_related(Experience.objects.filter(deleteTransaction__isnull=True), _subFields(fields, 'experiences')),
                to_attr='currentExperiences'))
        return qs
        
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
        
        # Check to see if the context can read this to cover the case when 
        # getting the data of the asker of a comment.
        if context.canRead(self):
            data['birthday'] = self.birthday
            if self.name:
                data['name'] = self.name
            if self.specialAccess:
                data['special access'] = self.specialAccess
            if self.publicAccess:
                data['public access'] = self.publicAccess
            if self.canAnswerExperience:
                data['can answer experience'] = self.canAnswerExperience

            if 'parents' in fields:
                if context.canRead(self.parent):
                    if 'user' in fields:
                        data['user'] = self.currentUser.getData([], context)
                    else:
                        data['user'] = self.parent.headData(context)
        
            if 'experiences' in fields:
                subFields = _subFields(fields, 'experiences')
                data['experiences'] = [i.getData(subFields, context) for i in self.currentExperiences]

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

    def filterForHeadData(qs, user, accessType):
        return Path.findableQuerySet(qs, user, '')

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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s\t%s\t%s" % \
        (self.id, self.parent, self.birthday or '-', self.name or '-', 
         self.specialAccess or '-', 
         self.publicAccess or '-', 
         self.canAnswerExperience or '-',
        )
    
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s\t%s\t%s" % \
        (self.id, self.parent, self.birthday or '-', self.name or '-', 
         self.specialAccess or '-', 
         self.publicAccess or '-', 
         self.canAnswerExperience or '-',
        )
    
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent__parent')

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
        parent.checkCanWrite(context)
        
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s" % \
            (self.id,
            self.weekday or '-',
            self.startTime or '-',
            self.endTime or '-')
    
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s" % \
            (self.id,
            self.weekday or '-',
            self.startTime or '-',
            self.endTime or '-')

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

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.stage or '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property    
    def dataString(self):
        return "%s\t%s" % (self.id, self.stage or '-')
           
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
        parent.checkCanWrite(context)
            
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
        return "%s\t%s" % (self.id, str(self.impliedService) if self.impliedService else '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
        return "%s\t%s" % (self.id, str(self.impliedService) if self.impliedService else '-')
           
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent')

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
        parent.checkCanWrite(context)
        
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s" %\
            (self.id, self.registrationDeadline or '-',
             self.start or '-', self.end or '-', self.canRegister or '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s" %\
            (self.id, self.registrationDeadline or '-',
             self.start or '-', self.end or '-', self.canRegister or '-')
           
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent__parent')

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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent')

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
        parent.checkCanWrite(context)
           
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
        self.checkCanWrite(context)
        
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent')

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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent__parent__parent')

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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.text or '-')
           
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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

    @property
    def dataString(self):
        return "%s\t%s\t%s" % (self.id, self.position, self.text or '-')
           
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
                  'user grant': ('userGrants__', 'UserUserGrant', 'grantor'),
                  'group grant': ('groupGrants__', 'UserGroupGrant', 'grantor'),
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, '')

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
            raise ValueError('birthday can not be empty if specified')
        _validateDate(data, key)
    
    def create(data, context, newIDs={}):
        if 'emails' not in data:
            raise ValueError('user data contains no emails')
        elif len(data['emails']) == 0:
            raise ValueError('user email list is empty')
        elif 'text' not in data['emails'][0]:
            raise ValueError('first email for user contains no text')
        elif not _isEmail(data['emails'][0]['text']):
            raise ValueError('text of first email for user is not a valid email address')
        
        User.validateBirthday(data, 'birthday')
        
        email = data['emails'][0]['text']
        firstName = _orNone(data, 'first name')
        lastName = _orNone(data, 'last name')
        if not AuthUser.objects.filter(email=email).exists():
            if not context.is_administrator:
                raise ValueError('non-administrators cannot create users')
            
            manager = get_user_model().objects
            constituent = manager.create_user(email=email, password='', 
                                              firstName = firstName, lastName = lastName)    
            
        # Handle special case for primary administrator when creating a new SecureRootInstance subclass.
        if 'primary administrator' in data and data['primary administrator'] == 'user/%s' % id.hex:
            primaryAdministrator = User.objects.get(pk=id)
        else:
            primaryAdministrator = _orNoneForeignKey(data, 'primary administrator', context, User)
            
        newItem = User.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 firstName = firstName,
                                 lastName = lastName,
                                 birthday = _orNone(data, 'birthday'),
                                 publicAccess=_orNone(data, 'public access'),
                                 primaryAdministrator=primaryAdministrator,
                                )
        
        # If there was no administrator associated with this user, then set the
        # primaryAdministrator to the user itself.                        
        if not primaryAdministrator:
            newItem.primaryAdministrator = newItem
            newItem.save()
        
        newItem.createChildren(data, 'user grants', context, UserUserGrant, newIDs)
        newItem.createChildren(data, 'group grants', context, UserGroupGrant, newIDs)
        
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
    
    @property
    def dataString(self):
        return "%s\t%s\t%s\t%s\t%s\t%s" % \
            (self.id, 
             self.firstName or '-', 
             self.lastName or '-', 
             self.birthday or '-',
             self.publicAccess or '-',
             str(self.primaryAdministrator) if self.primaryAdministrator else '-',
            )
    
    def update(self, changes, context, newIDs={}):
        self.checkCanWrite(context)
        
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
            self.updateChildren(changes, 'user grants', context, UserUserGrant, self.userGrants, newIDs)
            self.updateChildren(changes, 'group grants', context, UserGroupGrant, self.groupGrants, newIDs)
            self.updateChildren(changes, 'notifications', context, Notification, self.notifications, newIDs)
        
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
    
    ### Grants the specified organization read access to this user.
    def grantOrganizationDefaultGroupRead(self, organization, context):
        if organization.inquiryAccessGroup and \
           not self.groupGrants.filter(deleteTransaction__isnull=True,
                                       grantee=organization.inquiryAccessGroup,
                                       privilege__in=['read', 'write', 'administer']).exists():
            newGrant = UserGroupGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 grantor_id=self.id,
                                 grantee=organization.inquiryAccessGroup,
                                 privilege='read')
            
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

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent')

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
        self.checkCanWrite(context)
        
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
class UserUserGrantRequest(IInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUserUserGrantRequests')
    lastTransaction = lastTransactionField('changedUserUserGrantRequests')
    deleteTransaction = deleteTransactionField('deletedUserUserGrantRequests')

    parent = parentField(User, 'userGrantRequests')
    grantee = dbmodels.ForeignKey(User, related_name='userUserGrantRequests', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {}
               
    elementMap = {'grantee': ('grantee__', 'User', 'userUserGrantRequests'),
                  'parent': ('parent__', "User", 'userGrantRequests'),
                 }

    def description(self, languageCode=None):
        return self.grantee.description(languageCode)
        
    def __str__(self):
        return self.description()
    
    def select_head_related(querySet):
        return querySet.select_related('grantee')

    def select_related(querySet, fields=[]):
        return UserUserGrantRequest.select_head_related(querySet)

    def headData(self, context):
        data = {'id': self.id.hex, 
                'description': self.description(context.languageCode), 
               }
        return data
        
    def getData(self, fields, context):
        data = self.headData(context)
        data['grantee'] = self.grantee.headData(context)
        
        if 'parents' in fields:
            if context.canRead(self.parent) and 'user' in fields:
                data['user'] = self.parent.getData([], context)
            else:
                data['user'] = self.parent.headData(context)
                
        return data
        
    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), User

    def filterForHeadData(qs, user, accessType):
        return SecureRootInstance.findableQuerySet(qs, user, 'parent')

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

    @property
    def dataString(self):
        return"%s\t%s\t%s" % \
          (
            self.id, str(self.parent), str(self.grantee)
          )
         
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
            
    @property    
    def privilegeSource(self):
        return self
        
    def fetchPrivilege(self, user):
        return "administer" if self.parent.fetchPrivilege(user) == "administer" else \
        "write" if self.grantee.id == user.id \
        else None

class UserUserGrantRequestHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userUserGrantRequestHistories')
    instance = historyInstanceField(UserUserGrantRequest)

    grantee = dbmodels.ForeignKey(User, related_name='userUserGrantRequestHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)

    @property
    def dataString(self):
        return"%s\t%s\t%s" % \
          (
            self.id, str(self.parent), str(self.grantee)
          )
         
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

resources = {
        Address: "address",
        Comment: "comment",
        CommentPrompt: "comment prompt",
        CommentPromptText: "comment prompt translation",
        DisqualifyingTag: "disqualifying tag",
        Engagement: "engagement",
        Enrollment: "enrollment",
        Experience: "experience",
        ExperienceCustomService: "experience custom service",
        ExperienceService: "experience service",
        ExperiencePrompt: "experience prompt",
        ExperiencePromptService: "experience prompt service",
        ExperiencePromptText: "experience prompt translation",
        Group: "group",
        GroupName: "group name",
        GroupMember: "group member",
        Inquiry: "inquiry",
        Notification: "notification",
        NotificationArgument: "notification argument",
        Offering: "offering",
        OfferingName: "offering name",
        OfferingService: "offering service",
        Organization: "organization",
        OrganizationGroupGrant: "organization group grant",
        OrganizationName: "organization name",
        OrganizationUserGrant: "organization user grant",
        Path: "path",
        Period: "period",
        Service: "service",
        ServiceName: "service name",
        ServiceOrganizationLabel: "service organization label",
        ServiceSiteLabel: "service site label",
        ServiceOfferingLabel: "service offering label",
        ServiceImplication: "service implication",
        Session: "session",
        SessionName: "session name",
        Site: "site",
        SiteName: "site name",
        Street: "street",
        User: "user",
        UserEmail: "user email",
        UserGroupGrant: "user group grant",
        UserUserGrant: "user user grant",
        UserUserGrantRequest: "user user grant request",
    }
