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
            
def _valueCheckDate(s):
    if int(s[0:4]) <= 0 or s[4] != '-' or \
       int(s[5:7]) <= 0 or int(s[5:7]) > 12:
        raise ValueError('the date is not in a valid format: %s' % s)
    elif len(s) == 7:
        return
    elif s[7] != '-' or int(s[8:10]) <= 0:
        raise ValueError('the date is not in a valid format: %s' % s)
    else:
        return
        
def _valueCheckEnumeration(data, key, validValues):
    if key not in data or data[key] in validValues:
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
    else:
        raise ValueError("unrecognized symbol: %s"%symbol)

def _subElementQuerySet(tokens, user, subType):
    c = _filterClause(tokens, user, subType.fieldMap, subType.elementMap, prefix='')
    return subType.objects.filter(c, deleteTransaction__isnull=True)

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
def _filterClause(tokens, user, fieldMap, elementMap, prefix=''):
    # print('_filterClause: %s, %s' % (tokens, prefix))
    fieldName = tokens[0]
    if fieldName in fieldMap:
        prefix += fieldMap[fieldName]
        if len(tokens) == 1:
            return Q((prefix + '__isnull', False))
        else:
            return getFieldQ(prefix, tokens[1], tokens[2])
    elif fieldName in elementMap:
        prefix = prefix + elementMap[fieldName][0]
        if len(tokens) == 1:
            return Q((prefix + 'isnull', False), (prefix + 'deleteTransaction__isnull', True))
        else:
            subType = eval(elementMap[fieldName][1])
            
            if tokens[1] == '>':
                return _filterClause(tokens[2:], user, subType.fieldMap, subType.elementMap, prefix=prefix)
            elif tokens[1] == '[':
                q = Q((prefix + 'in', _subElementQuerySet(tokens[2], user, subType)))
                i = 3
                while i < len(tokens) - 2 and tokens[i] == '|' and tokens[i+1] == '[':
                    q = q | Q((prefix + 'in', _subElementQuerySet(tokens[i+2], user, subType)))
                    i += 3
                return q
            else:
                raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in tokens]))
    else:
        raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in tokens]))

### Access type is the type, if any, that the qs has already been filtered.
def _subTypeParse(qs, tokens, user, qsType, accessType, elementMap):
    # print('_subTypeParse: %s, %s, %s, %s' % (qsType, tokens, accessType, elementMap))
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

def _parse(qs, tokens, user, qsType, accessType):
    # print('_parse: %s, %s' % (qsType, tokens))
    if len(tokens) == 0:
        return qs, tokens, qsType, accessType
    elif isUUID(tokens[0]):
        return _parse(qs.filter(pk=tokens[0]), tokens[1:], user, qsType, accessType)
    elif tokens[0] == '[':
        q = _filterClause(tokens[1], user, qsType.fieldMap, qsType.elementMap)
        i = 2
        while i < len(tokens) - 2 and tokens[i] == '|' and tokens[i+1] == '[':
            q = q | _filterClause(tokens[1+2], user, qsType.fieldMap, qsType.elementMap)
            i += 3
        return _parse(qs.filter(q), tokens[i:], user, qsType, accessType)
    elif tokens[0] == '/':
        return _subTypeParse(qs, tokens, user, qsType, accessType, qsType.elementMap)
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
            raise PermissionDenied
        self.deleteTransaction = context.transaction
        self.save()
    
    def createChildren(self, data, key, context, subClass, newIDs={}):
        if key in data:
            if not isinstance(data[key], list):
                raise ValueError('%s element of data is not a list: %s' % (key, data[key]))
            for subData in data[key]:
                subClass.create(self, subData, context, newIDs=newIDs)
    
    def updateChildren(self, changes, key, context, subClass, children, newIDs={}):
        if key in changes:
            if not isinstance(changes[key], list):
                raise ValueError('%s element of changes is not a list: %s' % (key, changes[key]))
            for subChanges in changes[key]:
                if 'id' in subChanges:
                    subItem = children.get(pk=subChanges['id'])
                    if 'delete' in subChanges and subChanges['delete'] == 'delete':
                        subItem.markDeleted(context)
                    else:
                        subItem.update(subChanges, context, newIDs)
                elif 'clientID' in subChanges:
                    subItem = subClass.create(self, subChanges, context, newIDs=newIDs)
    
    @property
    def currentNamesQuerySet(self):
        return self.currentNames if 'currentNames' in self.__dict__ else self.names.filter(_currentChildQ)

    def description(self, languageCode=None):
        return IInstance.getName(self.currentNamesQuerySet, languageCode)
        
    def getData(self, fields, context):
        data = self.headData(context)
        if 'names' in self.__dict__:
            data['names'] = [i.getData([], context) for i in self.currentNamesQuerySet]
        return data
        
# An instance that is a secure root: User and Organization
class SecureRootInstance(IInstance):
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousFindFilter(prefix=''):
        return Q(((prefix + '__id__in') if prefix else 'id__in',
                  GrantTarget.objects.filter(publicAccess__in=["find", "read"])))
        
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousReadFilter(prefix=''):
        return Q(((prefix + '__id__in') if prefix else 'id__in',
                  GrantTarget.objects.filter(publicAccess__id="read")))
        
    def findableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.filter(SecureRootInstance.anonymousFindFilter(prefix))
        elif user.is_administrator:
            return qs
        else:
            privilegeIDs = ["find", "read", "register", "write", "administer"]
            inClause = (prefix + '__id__in') if prefix else 'id__in'
            elementClause = GrantTarget.objects.filter(\
                                 Q(publicAccess__in=privilegeIDs) |\
                                 Q(primaryAdministrator=user) |\
                                 Q(userGrants__privilege__in=privilegeIDs,
                                   userGrants__deleteTransaction__isnull=True,
                                   userGrants__grantee=user) |\
                                 Q(groupGrants__privilege__in=privilegeIDs,
                                   groupGrants__deleteTransaction__isnull=True,
                                   groupGrants__grantee__members__user=user,
                                   groupGrants__grantee__members__deleteTransaction__isnull=True))
            qClause = Q((inClause, elementClause))
            return qs.filter(qClause)

    def administrableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.none()
        elif user.is_administrator:
            return qs
        else:
            inClause = (prefix + '__id__in') if prefix else 'id__in'
            elementClause = GrantTarget.objects.filter(\
                                 Q(primaryAdministrator=user) |\
                                 Q(userGrants__privilege="administer",
                                   userGrants__deleteTransaction__isnull=True,
                                   userGrants__grantee=user) |\
                                 Q(groupGrants__privilege="administer",
                                   groupGrants__deleteTransaction__isnull=True,
                                   groupGrants__grantee__members__user=user,
                                   groupGrants__grantee__members__deleteTransaction__isnull=True))
            qClause = Q((inClause, elementClause))
            return qs.filter(qClause)

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
             'grant target': GrantTarget,
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
             'user grant': UserGrant,
             'user email': UserEmail,
             'user user grant request': UserUserGrantRequest,
            }
        if tokens[0] in d:
            qsType = d[tokens[0]]
            return _parse(qsType.objects.filter(deleteTransaction__isnull=True), tokens[1:], user, qsType, None)
        else:
            raise ValueError("unrecognized root token: %s" % tokens[0])
    
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
        
    def select_related(querySet):
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
            raise 'the value "%s" is not a valid language. Valid langues are are: %s' % (value, validValues)
    
    def ValueCheckText(self, value):
        return
    
    def buildHistory(self, context):
        return self.historyType.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             text=self.text,
                                             languageCode=self.languageCode)
        
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
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        return newItem                         

### An instance that contains access information.
class AccessInstance(ChildInstance):
    def description(self, languageCode=None):
        return self.grantee.description(languageCode)
        
    def select_head_related(querySet):
        return querySet.select_related('grantee')

    def select_related(querySet):
        return AccessInstance.select_head_related(querySet)

    def getData(self, fieldNames, context):
        data = self.headData(context)
        data['grantee'] = self.grantee.headData(context)
        if 'privilege' in self.__dict__:
            data['privilege'] = self.privilege
        return data
        
    def fetchPrivilege(self, user):
        return "administer" if self.parent.fetchPrivilege(user) == "administer" else None
    
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

class GrantTarget(IInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGrantTargets')
    lastTransaction = lastTransactionField('changedGrantTargets')
    deleteTransaction = deleteTransactionField('deletedGrantTargets')

    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administered', db_index=True, null=True, on_delete=dbmodels.CASCADE)

    fieldMap = {'public access': 'publicAccess',
                'primary administrator': 'primaryAdministrator',
               }
               
    elementMap = {'user grant': ('userGrants__', 'UserGrant', 'parent'),
                  'group grant': ('groupGrants__', 'GroupGrant', 'parent'),
                 }
                 
    def select_head_related(querySet):
        return querySet
    
    def select_related(querySet):
        return querySet.select_related('primaryAdministrator')\
                       .prefetch_related(Prefetch('userGrants',
                                          queryset=UserGrant.select_related(UserGrant.objects.filter(deleteTransaction__isnull=True)),
                                          to_attr='currentUserGrant'))\
                       .prefetch_related(Prefetch('groupGrants',
                                          queryset=GroupGrant.select_related(GroupGrant.objects.filter(deleteTransaction__isnull=True)),
                                          to_attr='currentGroupGrant'))
                                          
                 
    def fetchPrivilege(self, user):
        if not user:
            return self.publicAccess
        elif self.primaryAdministrator_id == user.id:
            return "administer"
        else:
            f = self.userGrants.filter(grantee=user, deleteTransaction__isnull=True).values('privilege')\
                .union(self.groupGrants.filter(grantee__members__user=user, deleteTransaction__isnull=True,
                                                  grantee__deleteTransaction__isnull=True,
                                                  grantee__members__deleteTransaction__isnull=True).values('privilege'))
            
            return IInstance.reducePrivileges(f, self.publicAccess)

    def headData(self, context):
        data = {'id': self.id.hex
               }
        return data
               
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.publicAccess:
                data['public access'] = self.publicAccess
            if self.primaryAdministrator:
                data['primary administrator'] = self.primaryAdministrator.headData(context)
            data['user grants'] = [i.getData([], context) for i in self.currentUserGrant]
            data['group grants'] = [i.getData([], context) for i in self.currentGroupGrant]
        
        return data
    
    def getSubClause(qs, user, accessType):
        if accessType == GrantTarget:
            return qs, accessType
        else:
            return SecureRootInstance.administrableQuerySet(qs, user), GrantTarget
            
    def markDeleted(self, context):
        for i in self.userGrants.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.groupGrants.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(GrantTarget, self).markDeleted(context)
    
    def create(id, data, context, newIDs={}):
        newItem = GrantTarget.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 id=id,
                                 publicAccess=_orNone(data, 'public access'),
                                 primaryAdministrator=_orNone(data, 'primary administrator')
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'user grants', context, UserGrant, newIDs)
        newItem.createChildren(data, 'group grants', context, GroupGrant, newIDs)
        
        return newItem
    
    def valueCheckPublicAccess(self, data, key):
        validValues = ['find', 'read']
        _valueCheckEnumeration(data, key, validValues)
    
    def valueCheckPrimaryAdministrator(self, newValue):
        pass
        
    def buildHistory(self, context):
        return GrantTargetHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             publicAccess=self.publicAccess,
                                             primaryAdministrator=self.primaryAdministrator)
        
    def update(self, changes, context, newIDs={}):
        if not context.canAdminister(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'public access' in changes and changes['public access'] != self.publicAccess:
            self.valueCheckPublicAccess(changes, 'public access')
            history = history or self.buildHistory(context)
            self.publicAccess = changes['public access'] or None
        if 'primary administrator' in changes:
            newValue = _getForeignKey(changes['primary administrator'], context, User)
            if newValue != self.primaryAdministrator:
                 self.valueCheckPrimaryAdministrator(newValue)
                 history = history or self.buildHistory(context)
                 self.primaryAdministrator = newValue or None
        
        self.updateChildren(changes, 'user grants', context, UserGrant, self.userGrants, newIDs)
        self.updateChildren(changes, 'group grants', context, GroupGrant, self.groupGrants, newIDs)
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class GrantTargetHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('grantTargetHistories')
    instance = historyInstanceField(GrantTarget)

    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administeredHistories', db_index=True, null=True, on_delete=dbmodels.CASCADE)

### A Multiple Picked Value
class UserGrant(AccessInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUserGrants')
    lastTransaction = lastTransactionField('changedUserGrants')
    deleteTransaction = deleteTransactionField('deletedUserGrants')

    parent = parentField(GrantTarget, 'userGrants')
    grantee = dbmodels.ForeignKey('consentrecords.User', related_name='grantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantee': ('grantee__', 'User', 'grantees'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == GrantTarget:
            return qs, accessType
        else:
            return SecureRootInstance.administrableQuerySet(qs, user, 'parent'), GrantTarget

    def create(parent, data, context, newIDs={}):
        newItem = UserGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, User),
                                 privilege=_orNone(data, 'privilege'))
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
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

    parent = parentField(GrantTarget, 'groupGrants')
    grantee = dbmodels.ForeignKey('consentrecords.Group', related_name='grantees', db_index=True, on_delete=dbmodels.CASCADE)
    privilege = dbmodels.CharField(max_length=10, db_index=True, null=True)

    fieldMap = {'privilege': 'privilege'}
    
    elementMap = {'grantee': ('grantee__', 'Group', 'grantees'),
                 }
                 
    def __str__(self):
        return self.description()
    
    def getSubClause(qs, user, accessType):
        if accessType == GrantTarget:
            return qs, accessType
        else:
            return SecureRootInstance.administrableQuerySet(qs, user, 'parent'), GrantTarget

    def create(parent, data, context, newIDs={}):
        newItem = GroupGrant.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, Group),
                                 privilege=_orNone(data, 'privilege'))
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
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

    def select_related(querySet):
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
            if 'street' in fields:
                data['streets'] = [i.getData([], context) for i in self.currentStreets]
            else:
                data['streets'] = [i.headData(context) for i in self.currentStreets]
        
        return data
    
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent'), Organization

    def markDeleted(self, context):
        for i in self.streets.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Address, self).markDeleted(context)
    
    def create(parent, data, context, newIDs={}):
        newItem = Address.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 city=_orNone(data, 'city'),
                                 state=_orNone(data, 'state'),
                                 zipCode=_orNone(data, 'zip code'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'streets', context, Street, newIDs)
        
        return newItem                          
        
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
        
    def select_related(querySet):
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

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
        
        newItem = Comment.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 text = _orNone(data, 'text'),
                                 question = _orNone(data, 'question'),
                                 asker = _orNoneForeignKey(data, 'asker', context, Path),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem

class CommentHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentHistories')
    instance = historyInstanceField(Comment)
    
    text = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    question = dbmodels.CharField(max_length=1023, db_index=True, null=True, editable=False)
    asker = dbmodels.ForeignKey('consentrecords.Path', related_name='askedCommentHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

class CommentPrompt(RootInstance, dbmodels.Model):    
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
        
    def select_related(querySet):
        return CommentPrompt.select_head_related(querySet)
    
    def getData(self, fields, context):
        data = self.headData(context)
        data['translations'] = [i.getData([], context) for i in self.currentNames]
        return data
        
    def getSubClause(qs, user, accessType):
        return qs, accessType
        
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
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'translations', context, CommentPromptText, newIDs)
        
        return newItem                          
        
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        print(changes)
        self.updateChildren(changes, 'translations', context, CommentPromptText, self.texts, newIDs)
                                                         
class CommentPromptHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('commentPromptHistories')
    instance = historyInstanceField(CommentPrompt)
    
class CommentPromptText(TranslationInstance, dbmodels.Model):
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

    def getSubClause(qs, user, accessType):
        return qs, accessType

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

class DisqualifyingTag(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdDisqualifyingTags')
    lastTransaction = lastTransactionField('changedDisqualifyingTags')
    deleteTransaction = deleteTransactionField('deletedDisqualifyingTags')
    
    parent = parentField('consentrecords.ExperiencePrompt', 'disqualifyingTags')
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='disqualifyingTags', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {}
    
    elementMap = {'service': ('service__', 'Service', 'disqualifyingTags'),
                 }
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
    
    def select_related(querySet):
        return ExperienceService.select_head_related(querySet)
                 
    def __str__(self):
        return str(self.service)

    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.service:
                data['service'] = self.service.headData(context)
            
        return data

    def getSubClause(qs, user, accessType):
        return qs, accessType

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = DisqualifyingTag.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class DisqualifyingTagHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('disqualifyingTagHistories')
    instance = historyInstanceField(DisqualifyingTag)

    service = dbmodels.ForeignKey('consentrecords.Service', related_name='disqualifyingTagHistories', db_index=True, editable=True, on_delete=dbmodels.CASCADE)

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
                 }

    def description(self, languageCode=None):
        return self.user.description(languageCode)
        
    def __str__(self):
        return str(self.user)

    def select_head_related(querySet):
        return querySet.select_related('user')
        
    def select_related(querySet):
        return querySet.select_related('user')
        
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.user:
                data['user'] = self.user.headData(context)
            if self.start:
                data['start'] = self.start
            if self.end:
                data['end'] = self.end
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent_parent__parent__parent'), Organization

    def create(parent, data, context, newIDs={}):
        newItem = Engagement.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                 start=_orNone(data, 'start'),
                                 end=_orNone(data, 'end'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
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
        
    def select_related(querySet):
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
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent_parent__parent__parent'), Organization

    def create(parent, data, context, newIDs={}):
        newItem = Enrollment.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
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
        return querySet.select_related('offering')\
                       .prefetch_related(Prefetch('offering__names',
                                                  queryset=OfferingName.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
    
    def select_related(querySet):
        return Experience.select_head_related(querySet).select_related('organization')\
                       .select_related('site')\
                       .prefetch_related(Prefetch('customServices', 
                           queryset=ExperienceCustomService.objects.filter(deleteTransaction__isnull=True)))\
                       .prefetch_related(Prefetch('services', 
                           queryset=ExperienceService.objects.filter(deleteTransaction__isnull=True)))
    
    def getData(self, fieldNames, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.customOrganization:
                data['customOrganization'] = self.customOrganization
            if self.customSite:
                data['customSite'] = self.customSite
            if self.customOffering:
                data['customOffering'] = self.customOffering
            if self.organization_id:
                if 'organization' in fieldNames:
                    data['organization'] = self.organization.getData([], context)
                else:
                    data['organization'] = self.organization.headData(context)
            if self.site_id:
                if 'site' in fieldNames:
                    data['site'] = self.site.getData([], context)
                else:
                    data['site'] = self.site.headData(context)
            if self.offering_id:
                if 'offering' in fieldNames:
                    data['offering'] = self.offering.getData([], context)
                else:
                    data['offering'] = self.offering.headData(context)
            qs = self.services.filter(deleteTransaction__isnull=True).order_by('position')
            if 'service' in fieldNames:
                data['services'] = [i.getData([], context) for i in qs]
            else:
                data['services'] = [i.headData(context) for i in qs]
            qs = self.customServices.filter(deleteTransaction__isnull=True).order_by('position')
            if 'custom service' in fieldNames:
                data['custom services'] = [i.getData([], context) for i in qs]
            else:
                data['custom services'] = [i.headData(context) for i in qs]
            if self.start:
                data['start'] = self.start
            if self.end:
                data['end'] = self.end
            if self.timeframe:
                data['timeframe'] = self.timeframe
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent'), Path

    def markDeleted(self, context):
        for i in self.customServices.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.services.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.comments.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Experience, self).markDeleted(context)
    
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
        
        ExperiencePrompt.valueCheckTimeframe(data, 'timeframe')
        if 'start' in data: _valueCheckDate(data['start'])
        if 'end' in data: _valueCheckDate(data['end'])
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
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'services', context, ExperienceService, newIDs)
        newItem.createChildren(data, 'custom services', context, ExperienceCustomService, newIDs)
        newItem.createChildren(data, 'comments', context, Comment, newIDs)
        
        return newItem

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
        
    def select_related(querySet):
        return querySet
        
    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent__parent'), Path

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
        
        if 'name' not in data:
            raise ValueError('the name of a custom service is required.')
             
        newItem = ExperienceCustomService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=_newPosition(parent.services, data, 'position'),
                                 name=data['name'],
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class ExperienceCustomServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experienceCustomServiceHistories')
    instance = historyInstanceField(ExperienceCustomService)
    position = dbmodels.IntegerField()
    name = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

class ExperienceService(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdExperienceServices')
    lastTransaction = lastTransactionField('changedExperienceServices')
    deleteTransaction = deleteTransactionField('deletedExperienceServices')

    parent = parentField(Experience, 'services')
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experienceServices', db_index=True, null=True, on_delete=dbmodels.CASCADE)

    @property
    def currentNamesQuerySet(self):
        return self.currentNames if 'currentNames' in self.__dict__ else self.service.names.filter(deleteTransaction__isnull=True)

    def description(self, languageCode=None):
        return IInstance.getName(self.currentNamesQuerySet, languageCode)
        
    def __str__(self):
        return str(self.service)
    
    def getData(self, fields, context):
        data = self.headData(context)
        data['position'] = self.position
        if self.service:
            if 'service' in fields:
                data['service'] = self.service.getData([], context)
            else:
                data['service'] = self.service.headData(context)
        return data
    
    fieldMap = {'position': 'position',
               }
               
    elementMap = {'service': ('service__', "Service", 'experienceServices'),
                 }
                 
    def select_head_related(querySet):
        return querySet.select_related('service')\
                       .prefetch_related(Prefetch('service__names',
                                                  queryset=ServiceName.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
    
    def select_related(querySet):
        return ExperienceService.select_head_related(querySet)
                 
    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, accessType
        else:
            return Path.findableQuerySet(qs, user, prefix='parent__parent'), Path

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = ExperienceService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=_newPosition(parent.services, data, 'position'),
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class ExperienceServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experienceServiceHistories')
    instance = historyInstanceField(ExperienceService)
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experienceServiceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

class ExperiencePrompt(RootInstance, dbmodels.Model):    
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
        
    def select_related(querySet):
        return ExperiencePrompt.select_head_related(querySet)\
                    .select_related('organization')\
                    .select_related('site')\
                    .select_related('offering')\
                    .select_related('domain')\
                    .prefetch_related(Prefetch('services',
                                               ExperiencePromptService.select_related(ExperiencePromptService.objects.all()),
                                               to_attr='fetchedServices'))\
                    .prefetch_related(Prefetch('texts',
                                               ExperiencePromptText.objects.all(),
                                               to_attr='fetchedTexts'))\
                    .prefetch_related(Prefetch('disqualifyingTags',
                                               DisqualifyingTag.select_related(DisqualifyingTag.objects.all()),
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
        data['services'] = [i.headData(context) for i in self.fetchedServices]
        data['translations'] = [i.getData([], context) for i in self.fetchedTexts]
        data['disqualifying tags'] = [i.headData(context) for i in self.fetchedDisqualifyingTags]
        return data
        
    def getSubClause(qs, user, accessType):
        return qs, accessType

    def markDeleted(self, context):
        for i in self.texts.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.services.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.disqualifyingTags.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(ExperiencePrompt, self).markDeleted(context)

    def valueCheckTimeframe(data, key):
        validValues = ['Previous', 'Current', 'Goal']
        _valueCheckEnumeration(data, key, validValues)
    
    def create(data, context, newIDs={}):
        if not context.is_administrator:
           raise PermissionDenied
        
        if 'name' not in data or not data['name']:
            raise ValueError('name of experience prompt is not specified')
        if 'stage' in data:
            Service.ValueCheckStage(data['stage'])
        ExperiencePrompt.valueCheckTimeframe(data, 'timeframe')
             
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
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'translations', context, ExperiencePromptText, newIDs)
        newItem.createChildren(data, 'services', context, ExperiencePromptService, newIDs)
        newItem.createChildren(data, 'disqualifying tags', context, DisqualifyingTag, newIDs)
        
        return newItem

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

class ExperiencePromptService(ChildInstance, dbmodels.Model):
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
    
    def select_related(querySet):
        return ExperiencePromptService.select_head_related(querySet)
        
    def __str__(self):
        return str(self.service)

    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            data['position'] = self.position
            if self.service:
                data['service'] = self.service.headData(context)
            
        return data

    def getSubClause(qs, user, accessType):
        return qs, accessType
                 
    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = ExperiencePromptService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=_newPosition(parent.services, data, 'position'),
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class ExperiencePromptServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('experiencePromptServiceHistories')
    instance = historyInstanceField(ExperiencePromptService)

    service = dbmodels.ForeignKey('consentrecords.Service', related_name='experiencePromptServiceHistories', db_index=True, editable=True, on_delete=dbmodels.CASCADE)

class ExperiencePromptText(TranslationInstance, dbmodels.Model):    
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

    def getSubClause(qs, user, accessType):
        return qs, accessType

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

class Group(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroups')
    deleteTransaction = deleteTransactionField('deletedGroups')
    parent = parentField('consentrecords.Organization', 'groups')

    fieldMap = {}
               
    elementMap = {'name': ('names__', "GroupName", 'parent'),
                  'member': ('members__', "GroupMember", 'parent'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=GroupName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet):
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

    def markDeleted(self, context):
        for i in self.names.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.members.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Group, self).markDeleted(context)

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = Group.objects.create(transaction=context.transaction,
                                 parent=parent,
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'names', context, GroupName, newIDs)
        newItem.createChildren(data, 'members', context, GroupMember, newIDs)
        
        return newItem                          
        
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

class GroupMember(ChildInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdGroupMembers')
    lastTransaction = lastTransactionField('changedGroupMembers')
    deleteTransaction = deleteTransactionField('deletedGroupMembers')

    parent = parentField(Group, 'members')
    user = dbmodels.ForeignKey('consentrecords.User', related_name='groupMembers', db_index=True, on_delete=dbmodels.CASCADE)

    fieldMap = {}
               
    elementMap = {'user': ('user__', 'User', 'groupMembers'),
                 }
                 
    def description(self, languageCode=None):
        return self.user.description(languageCode) if self.user else ''
        
    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.select_related('user')
    
    def select_related(querySet):
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

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = GroupMember.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
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
    
    def select_related(querySet):
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
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent_parent__parent__parent'), Organization

    def create(parent, data, context, newIDs={}):
        newItem = Inquiry.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 user=_orNoneForeignKey(data, 'user', context, User),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
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
    
    def select_related(querySet):
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

    def markDeleted(self, context):
        for i in self.notificationArguments.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Notification, self).markDeleted(context)

    def create(parent, data, context, newIDs={}):
        newItem = Notification.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 name = data['name'],
                                 isFresh = _orNone(data, 'is fresh'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
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
    
    def select_related(querySet):
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
    
    fieldMap = {'web site': 'webSite',
                'minimum age': 'minimumAge',
                'maximum age': 'maximumAge',
                'minimum grade': 'minimumGrade',
                'maximum grade': 'maximumGrade',
               }
               
    elementMap = {'name': ('names__', "OfferingName", 'parent'),
                  'service': ('services__', "OfferingService", 'parent'),
                  'session': ('sessions__', "Session", 'parent'),
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=OfferingName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet):
        return Offering.select_head_related(querySet)\
                       .prefetch_related(Prefetch('services',
                                         queryset=OfferingService.select_head_related(OfferingService.objects.filter(deleteTransaction__isnull=True)),
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
        
            if 'service' in fields:
                data['services'] = [i.getData([], context) for i in self.currentServices]
            else:
                data['services'] = [i.headData(context) for i in self.currentServices]
            data['services'].sort(key=lambda i: i['description'])
            
            if 'session' in fields:
                data['sessions'] = [i.getData([], context) for i in self.currentSessions]
            else:
                data['sessions'] = [i.headData(context) for i in self.currentSessions]
            data['sessions'].sort(key=lambda i: i['description'])
            
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent'), Organization

    def markDeleted(self, context):
        for name in self.currentNamesQuerySet:
            name.markDeleted(context)
        for i in self.services.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.sessions.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(Offering, self).markDeleted(context)

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = Offering.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 webSite=_orNone(data, 'web site'),
                                 minimumAge=_orNone(data, 'minimum age'),
                                 maximumAge=_orNone(data, 'maximum age'),
                                 minimumGrade=_orNone(data, 'minimum grade'),
                                 maximumGrade=_orNone(data, 'maximum grade'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'names', context, OfferingName, newIDs)
        newItem.createChildren(data, 'services', context, OfferingService, newIDs)
        newItem.createChildren(data, 'sessions', context, Session, newIDs)
        
        return newItem                          
        
class OfferingHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('offeringHistories')
    instance = historyInstanceField(Offering)
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    minimumAge = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    maximumAge = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    minimumGrade = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    maximumGrade = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

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

class OfferingService(ChildInstance, dbmodels.Model):
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
    def currentNamesQuerySet(self):
        return self.currentNames if 'currentNames' in self.__dict__ else self.service.names.filter(deleteTransaction__isnull=True)

    def description(self, languageCode=None):
        return IInstance.getName(self.currentNamesQuerySet, languageCode)
        
    def __str__(self):
        return str(self.service)

    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.service:
                data['service'] = self.service.headData(context)
            
        return data
        
    def select_head_related(querySet):
        return querySet.select_related('service')\
                       .prefetch_related(Prefetch('service__names',
                                                  queryset=ServiceName.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentNames'))
    
    def select_related(querySet):
        return ExperienceService.select_head_related(querySet)
                 
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = OfferingService.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=_newPosition(parent.services, data, 'position'),
                                 service=_orNoneForeignKey(data, 'service', context, Service),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class OfferingServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('offeringServiceHistories')
    instance = historyInstanceField(OfferingService)
    position = dbmodels.IntegerField()
    service = dbmodels.ForeignKey('consentrecords.Service', related_name='offeringServiceHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

class Organization(RootInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdOrganizations')
    lastTransaction = lastTransactionField('changedOrganizations')
    deleteTransaction = deleteTransactionField('deletedOrganizations')
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True)
    inquiryAccessGroup = dbmodels.ForeignKey('consentrecords.Group', related_name='inquiryAccessGroupOrganizations', db_index=True, null=True, on_delete=dbmodels.CASCADE)

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
        
    def select_related(querySet):
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
        
    def fetchPrivilege(self, user):
        return GrantTarget.objects.get(pk=self.id).fetchPrivilege(user)
    
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user), Organization

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
           raise PermissionDenied
           
        newItem = Organization.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 webSite = _orNone(data, 'web site'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'names', context, OrganizationName, newIDs)
        newItem.createChildren(data, 'groups', context, Group, newIDs)
        newItem.createChildren(data, 'sites', context, Site, newIDs)
        
        if 'grant target' in data:
            GrantTarget.create(newItem.id, data['grant target'], context, newIDs)
        else:
            GrantTarget.create(newItem.id, {}, context, newIDs)
        
        if 'inquiry access group' in data:
            newItem.inquiryAccessGroup = _orNoneForeignKey(data, 'inquiry access group', context, Group, Organization.objects.filter(pk=newItem.id),
                                                          Organization)
            newItem.save()
        
        return newItem                          
        
    def buildHistory(self, context):
        return OrganizationHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             webSite=self.webSite,
                                             inquiryAccessGroup=self.inquiryAccessGroup)
        
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
            if newInquiryAccessGroup.id != self.inquiryAccessGroup_id:
                history = history or self.buildHistory(context)
                self.inquiryAccessGroup = newInquiryAccessGroup
        
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
class OrganizationHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('organizationHistories')
    instance = historyInstanceField(Organization)
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    inquiryAccessGroup = dbmodels.ForeignKey('consentrecords.Group', related_name='InquiryAccessGroupOrganizationHistories', db_index=True, null=True, editable=False, on_delete=dbmodels.CASCADE)

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

class Path(IInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdPaths')
    lastTransaction = lastTransactionField('changedPaths')
    deleteTransaction = deleteTransactionField('deletedPaths')

    parent = parentField('consentrecords.User', 'paths')
    birthday = dbmodels.CharField(max_length=10, db_index=True, null=True)
    name = dbmodels.CharField(max_length=255, db_index=True, null=True)
    specialAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    grantTarget = dbmodels.ForeignKey('consentrecords.GrantTarget', related_name='paths', db_index=True, null=True, on_delete=dbmodels.CASCADE)
    canAnswerExperience = dbmodels.CharField(max_length=10, null=True)

    def __str__(self):
        return self.name or ("%s %s" % (str(self.parent), "Path"))

    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet):
        return querySet
        
    @property    
    def privilegeSource(self):
        return self.grantTarget
        
    def fetchPrivilege(self, user):
        return self.grantTarget.fetchPrivilege(user)

    def headData(self, context):
        return {'id': self.id.hex, 
                'description': self.name, 
                'parentID': self.parent_id.hex, 
                'privilege': context.getPrivilege(self),
               }
    
    def getData(self, fields, context):
        data = self.headData(context)
        
        data['birthday'] = self.birthday
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
        
        if 'experience' in fields: 
            data['experiences'] = [i.getData([], context) for i in \
                Experience.select_related(self.experiences.filter(deleteTransaction__isnull=True))]

        return data
    
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousFindFilter(prefix=''):
        inClause = (prefix + '__grantTarget__in') if prefix else 'grantTarget__in'
        return Q((inClause, GrantTarget.objects.filter(publicAccess__in=["find", "read"])))
        
    ### Returns a query clause that limits a set of users to users that can be found 
    ### without signing in.
    def anonymousReadFilter(prefix=''):
        inClause = (prefix + '__grantTarget__in') if prefix else 'grantTarget__in'
        return Q((inClause, GrantTarget.objects.filter(publicAccess__id="read")))
        
    def findableQuerySet(qs, user, prefix=''):
        if not user:
            return qs.filter(Path.anonymousFindFilter(prefix))
        elif user.is_administrator:
            return qs
        else:
            privilegeIDs = ["find", "read", "register", "write", "administer"]
            inClause = (prefix + '__grantTarget__in') if prefix else 'grantTarget__in'
            return qs.filter(Q((inClause,
                                GrantTarget.objects.filter(\
                             Q(publicAccess__in=privilegeIDs) |\
                             Q(primaryAdministrator=user) |\
                             Q(userGrants__privilege__in=privilegeIDs,
                               userGrants__deleteTransaction__isnull=True,
                               userGrants__grantee=user) |\
                             Q(groupGrants__privilege__in=privilegeIDs,
                               groupGrants__deleteTransaction__isnull=True,
                               groupGrants__grantee__members__user=user,
                               groupGrants__grantee__members__deleteTransaction__isnull=True)))))

    fieldMap = {'screen name': 'name',
                'birthday': 'birthday',
                'special access': 'specialAccess',
                'can answer experience': 'canAnswerExperience',
               }
               
    elementMap = {'experience': ('experiences__', "Experience", 'parent'),
                 }

    def getSubClause(qs, user, accessType):
        if accessType == Path:
            return qs, Path
        else:
            return Path.findableQuerySet(qs, user), Path

    def markDeleted(self, context):
        for i in self.experiences.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in GrantTarget.objects.filter(pk=self.id):
            i.markDeleted(context)
        super(Path, self).markDeleted(context)

    def valueCheckBirthday(data, key):
        if key not in data:
            return
        return User.valueCheckBirthday(data, key)
    
    def valueCheckSpecialAccess(data, key):
        validValues = ['custom']
        _valueCheckEnumeration(data, key, validValues)
    
    def valueCheckCanAnswerExperience(data, key):
        validValues = ['yes', 'no']
        _valueCheckEnumeration(data, key, validValues)
    
    def create(parent, data, context, newIDs={}):
        Path.valueCheckBirthday(data, 'birthday')
        Path.valueCheckSpecialAccess(data, 'special access')
        Path.valueCheckCanAnswerExperience(data, 'can answer experience')
        
        birthday = data['birthday'] if 'birthday' in data else parent.birthday
        
        newItem = Path.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent = parent,
                                 name = _orNone(data, 'screen name'),
                                 birthday = birthday,
                                 specialAccess = _orNone(data, 'special access'),
                                 canAnswerExperience = _orNone(data, 'can answer experience'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        if 'grant target' in data:
            newGrantTarget = GrantTarget.create(newItem.id, data['grant target'], context, newIDs)
        else:
            newGrantTarget = GrantTarget.create(newItem.id, {}, context, newIDs)
        
        if newItem.specialAccess == 'custom':
            newItem.grantTarget = newGrantTarget
        else:
            newItem.grantTarget = GrantTarget.objects.get(pk=parent.id)
        newItem.save()
        
        newItem.createChildren(data, 'experiences', context, Experience, newIDs)
        
        return newItem                          
        
    def buildHistory(self, context):
        return PathHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             birthday=self.birthday,
                                             name=self.name,
                                             specialAccess=self.specialAccess,
                                             canAnswerExperience=self.canAnswerExperience)
        
class PathHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('pathHistories')
    instance = historyInstanceField(Path)
    
    birthday = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    name = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    specialAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
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
    
    def description(self, languageCode=None):
        return self.user.description('%s: %s-%s' % (weekday or 'any day', startTime or '', endTime or ''))
        
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet):
        return querySet
    
    def getData(self, fields, context):
        data = self.headData(context)
        if context.canRead(self):
            if self.weekday:
                data['weekday'] = self.weekday
            if self.start:
                data['start time'] = self.startTime
            if self.end:
                data['end time'] = self.endTime
        
        return data

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent_parent__parent__parent'), Organization

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = Period.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 weekday=_orNone(data, 'weekday'),
                                 startTime=_orNone(data, 'start time'),
                                 endTime=_orNone(data, 'end time'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class PeriodHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('periodHistories')
    instance = historyInstanceField(Period)

    weekday = dbmodels.IntegerField(db_index=True, null=True, editable=False)
    startTime = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)
    endTime = dbmodels.CharField(max_length=10, db_index=True, null=True, editable=False)

class Service(RootInstance, dbmodels.Model):    
    id = idField()
    transaction = createTransactionField('createdServices')
    lastTransaction = lastTransactionField('changedServices')
    deleteTransaction = deleteTransactionField('deletedServices')
    stage = dbmodels.CharField(max_length=20, db_index=True, null=True)

    fieldMap = {'stage': 'stage',
               }
               
    elementMap = {'name': ('names__', "ServiceName", 'parent'),
                  'organization label': ('organizationLabels__', "ServiceOrganizationLabel", 'parent'),
                  'site label': ('siteLabels__', "ServiceSiteLabel", 'parent'),
                  'offering label': ('offeringLabels__', "ServiceOfferingLabel", 'parent'),
                  'implies': ('serviceImplications__', 'ServiceImplication', 'parent'),
                  'implied by': ('impliedServiceImplications__', 'ServiceImplication', 'impliedService'),
                 }
                 
    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=ServiceName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet):
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
                                                 queryset=ServiceImplication.select_head_related(ServiceImplication.objects.filter(deleteTransaction__isnull=True)),
                                                 to_attr='currentServiceImplications'))
                        
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
            data['services'] = [i.headData(context) for i in self.currentServiceImplications]
            data['services'].sort(key=lambda i: i['description'])
        return data
    
    def ValueCheckStage(value):
        validValues = ['Certificate', 'Coaching', 'Expert', 'Housing', 'Mentoring', 
                       'Skills', 'Studying', 'Teaching', 'Training', 'Tutoring', 
                       'Volunteering', 'Wellness', 'Whatever', 'Working']
        if not value or value in validValues:
            return
        else:
            raise ValueError('the value "%s" is not a valid stage. Valid stages are: %s' % (value, validValues))
    
    def buildHistory(self, context):
        return ServiceHistory.objects.create(transaction=self.lastTransaction,
                                             instance=self,
                                             stage=self.stage)
        
    def update(self, changes, context, newIDs={}):
        if not context.canWrite(self):
            raise RuntimeError('you do not have permission to complete this update')
        
        history = None
        if 'stage' in changes and changes['stage'] != self.stage:
            Service.ValueCheckStage(changes['stage'])
            history = history or self.buildHistory(context)
            self.stage = changes['stage'] or None
        
        self.updateChildren(changes, 'names', context, ServiceName, self.names, newIDs)
                                                         
        if history:
            self.lastTransaction = context.transaction
            self.save()
            
    def getSubClause(qs, user, accessType):
        return qs, accessType

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
           raise PermissionDenied
        
        if 'stage' in data:
            Service.ValueCheckStage(data['stage'])
             
        newItem = Service.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 stage = _orNone(data, 'stage'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'names', context, ServiceName, newIDs)
        newItem.createChildren(data, 'organization labels', context, ServiceOrganizationLabel, newIDs)
        newItem.createChildren(data, 'site labels', context, ServiceSiteLabel, newIDs)
        newItem.createChildren(data, 'offering labels', context, ServiceOfferingLabel, newIDs)
        newItem.createChildren(data, 'services', context, ServiceImplication, newIDs)
        
        return newItem                          
        
class ServiceHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceHistories')
    instance = historyInstanceField(Service)
    stage = dbmodels.CharField(max_length=20, db_index=True, null=True, editable=False)

class ServiceName(TranslationInstance, dbmodels.Model):
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
                 
    def getSubClause(qs, user, accessType):
        return qs, accessType
    
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

class ServiceOrganizationLabel(TranslationInstance, dbmodels.Model):
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
                 
    def getSubClause(qs, user, accessType):
        return qs, accessType

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

class ServiceSiteLabel(TranslationInstance, dbmodels.Model):
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
                 
    def getSubClause(qs, user, accessType):
        return qs, accessType

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

class ServiceOfferingLabel(TranslationInstance, dbmodels.Model):
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
                 
    def getSubClause(qs, user, accessType):
        return qs, accessType

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

class ServiceImplication(ChildInstance, dbmodels.Model):
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
    def select_related(querySet):
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
                 
    def getSubClause(qs, user, accessType):
        return qs, accessType

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
            raise PermissionError
            
        newItem = ServiceImplication.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 impliedService=_orNoneForeignKey(data, 'service', context, Service),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class ServiceImplicationHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('serviceImplicationHistories')
    instance = historyInstanceField(ServiceImplication)

    impliedService = dbmodels.ForeignKey('consentrecords.Service', related_name='impliedServiceHistories', db_index=True, editable=True, on_delete=dbmodels.CASCADE)

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
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=SessionName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet):
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
                
            data['engagements'] = [i.headData(context) for i in self.currentEngagements]
            data['engagements'].sort(key=lambda s: s['description'])
            
            data['enrollments'] = [i.headData(context) for i in self.currentEnrollments]
            data['enrollments'].sort(key=lambda s: s['description'])
            
            data['inquiries'] = [i.headData(context) for i in self.currentInquiries]
            data['inquiries'].sort(key=lambda s: s['description'])
            
            data['periods'] = [i.getData(context) for i in self.currentPeriods]
            data['periods'].sort(key=lambda s: s['description'])
                
        return data
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

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

    def create(parent, data, context, newIDs={}):
        if not context.canWrite(parent):
           raise PermissionDenied
           
        newItem = Session.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 registrationDeadline=_orNone(data, 'registration deadline'),
                                 start=_orNone(data, 'start'),
                                 end=_orNone(data, 'end'),
                                 canRegister=_orNone(data, 'can register'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'names', context, SessionName, newIDs)
        newItem.createChildren(data, 'engagements', context, Engagement, newIDs)
        newItem.createChildren(data, 'enrollments', context, Enrollment, newIDs)
        newItem.createChildren(data, 'inquiries', context, Inquiry, newIDs)
        newItem.createChildren(data, 'periods', context, Period, newIDs)
        
        return newItem                          
        
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
               
    elementMap = {}
                 
    def __str__(self):
        return '%s - %s' % (self.languageCode, self.text) if self.languageCode else (self.text or '')

    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent_parent__parent__parent'), Organization

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
                 }

    def __str__(self):
        return self.description()

    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('names',
                                                  queryset=SiteName.objects.filter(_currentChildQ),
                                                  to_attr='currentNames'))
        
    def select_related(querySet):
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
                
        return data
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), Organization

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
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        newItem.createChildren(data, 'names', context, SiteName, newIDs)
        newItem.createChildren(data, 'offerings', context, Offering, newIDs)
        
        if 'address' in data:
            Address.create(newItem, data['address'], context, newIDs)
        
        return newItem                          
        
class SiteHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('siteHistories')
    instance = historyInstanceField(Site)
    webSite = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)

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

    def select_related(querySet):
        return querySet

    def headData(self, context):
        data = super(Street, self).headData(context)
        data['position'] = self.position
        data['text'] = self.text
        return data
               
    def getData(self, fieldNames, context):
        return self.headData(context)
        
    def getSubClause(qs, user, accessType):
        if accessType == Organization:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, prefix='parent__parent__parent'), Organization

    def create(parent, data, context, newIDs={}):
        newItem = Street.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=_newPosition(parent.streets, data, 'position'),
                                 text=_orNone(data, 'text'),
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class StreetHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('streetHistories')
    instance = historyInstanceField(Street)
    position = dbmodels.IntegerField(editable=False)
    text = dbmodels.CharField(max_length=255, null=True, editable=False)

class User(RootInstance, dbmodels.Model):
    id = idField()
    transaction = createTransactionField('createdUsers')
    lastTransaction = lastTransactionField('changedUsers')
    deleteTransaction = deleteTransactionField('deletedUsers')

    firstName = dbmodels.CharField(max_length=255, db_index=True, null=True)
    lastName = dbmodels.CharField(max_length=255, db_index=True, null=True)
    birthday = dbmodels.CharField(max_length=10, db_index=True, null=True)

    def description(self, language=None):
        qs = self.emails.order_by('position')
        if len(qs):
            return qs[0].text
        else:
            return 'Unbound user: %s %s' % (self.firstName, self.lastName)
        
    def __str__(self):
        return self.description()
        
    def select_head_related(querySet):
        return querySet.prefetch_related(Prefetch('emails',
                                                  queryset=UserEmail.objects.filter(deleteTransaction__isnull=True),
                                                  to_attr='currentEMails'))

    def select_related(querySet):
        return User.select_head_related(querySet)\
                   .prefetch_related(Prefetch('paths',
                                         queryset=Path.objects.filter(deleteTransaction__isnull=True)))\
                   .prefetch_related(Prefetch('notifications',
                                         queryset=Notification.objects.filter(deleteTransaction__isnull=True)))
        
    def fetchPrivilege(self, user):
        return GrantTarget.objects.get(pk=self.id).fetchPrivilege(user)
    
    def getData(self, fields, context):
        data = self.headData(context)
        
        if self.birthday: data['birthday'] = self.birthday
        if self.firstName: data['first name'] = self.firstName
        if self.lastName: data['last name'] = self.lastName
        if 'system access' in fields:
            if context.is_administrator:
                data['system access'] = 'administer'
            elif context.is_staff:
                data['system access'] = 'write'

        emails = self.emails.filter(deleteTransaction__isnull=True).order_by('position')
        if 'email' in fields: 
            data['emails'] = [i.getData([], context) for i in emails]
        else:
            data['emails'] = [i.headData(context) for i in emails]

        if 'path' in fields: 
            qs = self.paths.filter(deleteTransaction__isnull=True)
            if qs.exists():
                data['path'] = Path.select_related(qs)[0].getData([], context)

        if 'notification' in fields: 
            data['notifications'] = [i.getData([], context) for i in \
                Notification.select_related(self.notifications.filter(deleteTransaction__isnull=True).order_by('transaction__creation_time'))]

        if context.getPrivilege(self) == 'administer':
            if 'user grant request' in fields: 
                data['user grant requests'] = [i.getData([], context) for i in \
                    UserUserGrantRequest.select_related(self.userGrantRequests.filter(deleteTransaction__isnull=True))]

        return data
    
    def __getattr__(self, name):
        if name == 'authUser':
            qs = AuthUser.objects.filter(email=self.emails.all()[0].text)
            x = qs[0] if len(qs) else AnonymousUser()
            self.__setattr__(name, x)
        else:
            return super(User, self).__getattr__(name)
        return x
        
    @property
    def is_administrator(self):
        return self.authUser and self.authUser.is_superuser
            
    fieldMap = {'first name': 'firstName',
                'last name': 'lastName',
                'birthday': 'birthday',
               }
               
    elementMap = {'email': ('emails__', 'UserEmail', 'parent'),
                  'notification': ('notifications__', "Notification", 'parent'),
                  'path': ('paths__', "Path", 'parent'),
                  'user grant request': ('userGrantRequests__', "UserUserGrantRequest", 'parent'),
                 }

    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user), User

    def markDeleted(self, context):
        for i in self.emails.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.notifications.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.paths.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in self.userGrantRequests.filter(deleteTransaction__isnull=True):
            i.markDeleted(context)
        for i in GrantTarget.objects.filter(pk=self.id, deleteTransaction__isnull=True):
            i.markDeleted(context)
        super(User, self).markDeleted(context)

    def valueCheckBirthday(data, key):
        if key not in data:
            raise ValueError('a user can not be created without specifying a birthday')
        _valueCheckDate(data[key])
    
    def create(data, context, newIDs={}):
        User.valueCheckBirthday(data, 'birthday')
        
        newItem = User.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 firstName = _orNone(data, 'first name'),
                                 lastName = _orNone(data, 'last name'),
                                 birthday = data['birthday'],
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        if 'grant target' in data:
            GrantTarget.create(newItem.id, data['grant target'], context, newIDs)
        else:
            GrantTarget.create(newItem.id, {}, context, newIDs)
        
        newItem.createChildren(data, 'emails', context, UserEmail, newIDs)
        if not context.user:
            context.user = newItem
            
        if 'path' in data:
            Path.create(newItem, data['path'], context, newIDs=newIDs)
        else:
            Path.create(newItem, {}, context, newIDs=newIDs)
        
        newItem.createChildren(data, 'user grant requests', context, UserUserGrantRequest, newIDs)
        
        return newItem                          
        
class UserHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userHistories')
    instance = historyInstanceField(User)

    firstName = dbmodels.CharField(max_length=255, null=True, editable=False)
    lastName = dbmodels.CharField(max_length=255, null=True, editable=False)
    birthday = dbmodels.CharField(max_length=10, null=True, editable=False)

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
    
    def select_head_related(querySet):
        return querySet
        
    def select_related(querySet):
        return querySet
        
    def headData(self, context):
        data = super(UserEmail, self).headData(context)
        data['position'] = self.position
        data['text'] = self.text
        return data
               
    def getData(self, fieldNames, context):
        return self.headData(context)
        
    fieldMap = {'text': 'text',
                'position': 'position',
               }
               
    elementMap = {}

    def getSubClause(qs, user, accessType):
        if accessType == User:
            return qs, accessType
        else:
            return SecureRootInstance.findableQuerySet(qs, user, 'parent'), User

    def ValueCheckText(data, key):
        if key in data and data[key]:
            if _isEmail(data[key]):
                return
            else:
                raise ValueError('the email address "%s" is not a valid email address' % data[key])
        else:
            raise ValueError('an email address is required in the "%s" field' % key)
            
    def create(parent, data, context, newIDs={}):
        UserEmail.ValueCheckText(data, 'text')
        
        newItem = UserEmail.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 position=_newPosition(parent.emails, data, 'position'),
                                 text=data['text'],
                                )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class UserEmailHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userEmailHistories')
    instance = historyInstanceField(UserEmail)

    text = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)

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

    def create(parent, data, context, newIDs={}):
        newItem = UserUserGrantRequest.objects.create(transaction=context.transaction,
                                 lastTransaction=context.transaction,
                                 parent=parent,
                                 grantee=_orNoneForeignKey(data, 'grantee', context, User),
                                 )
        if 'clientID' in data:
            newIDs[data['clientID']] = newItem.id.hex
        
        return newItem                          
        
class UserUserGrantRequestHistory(dbmodels.Model):
    id = idField()
    transaction = createTransactionField('userUserGrantRequestHistories')
    instance = historyInstanceField(UserUserGrantRequest)

    grantee = dbmodels.ForeignKey(User, related_name='userUserGrantRequestHistories', db_index=True, editable=False, on_delete=dbmodels.CASCADE)

class Context:
    def __init__(self, languageCode, user):
        self.languageCode = languageCode
        self.user = user
        self._transaction = None
        if user:
            qs = AuthUser.objects.filter(email=user.emails.all()[0].text)
            self.authUser = qs[0] if len(qs) else AnonymousUser()
        else:
            self.authUser = AnonymousUser()
        self._privileges = {}
        
    def __str__(self):
        return "context: %s/%s" % (str(self.user), self.languageCode)
        
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
            
    def canRead(self, i):
        privilege = self.getPrivilege(i)
        return privilege in ["read", "write", "administer"]
    
    def canWrite(self, i):
        privilege = self.getPrivilege(i)
        return privilege in ["write", "administer"]

    def canAdminister(self, i):
        privilege = self.getPrivilege(i)
        return privilege == "administer"
