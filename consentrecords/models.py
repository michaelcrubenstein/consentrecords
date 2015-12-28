from django.db import connection
from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch
from django.conf import settings
from django.utils import timezone


import datetime
import numbers
import uuid
import logging
import re
import string
from multiprocessing import Lock
from functools import reduce

class Transaction(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = dbmodels.ForeignKey('custom_user.AuthUser', db_index=True, editable=False)
    creation_time = dbmodels.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)
    time_zone_offset = dbmodels.SmallIntegerField(editable=False)
    
    def __str__(self):
        return str(self.creation_time)
    
    def createTransaction(user, timeZoneOffset):
        if not user.is_authenticated:
            raise ValueError('current user is not authenticated')
        if not user.is_active:
            raise ValueError('current user is not active')
        return Transaction.objects.create(user=user, time_zone_offset=timeZoneOffset)
        
class TransactionState:
    mutex = Lock()
    
    def __init__(self, user, timeZoneOffset):
        self.currentTransaction = None
        self.user = user
        self.timeZoneOffset = timeZoneOffset
            
    @property    
    def transaction(self):
        if self.currentTransaction == None:
            self.currentTransaction = Transaction.createTransaction(self.user, self.timeZoneOffset)

        return self.currentTransaction
        
class Instance(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    typeID = dbmodels.ForeignKey('consentrecords.Instance', related_name='typeInstances', db_column='typeid', db_index=True, editable=False)
    parent = dbmodels.ForeignKey('consentrecords.Instance', related_name='children', db_column='parentid', db_index=True, null=True, editable=False)
    parentValue = dbmodels.OneToOneField('consentrecords.Value', related_name='valueChild', db_index=True, null=True)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
        
    def __str__(self):
        try:
            d = self.description_set.get(language_id__isnull=True)
            if d:
                return d.text
            else:
                return "Deleted"
        except Description.DoesNotExist:
            return "Deleted"
    
    @property    
    def _parentDescription(self):
        return self.parent and str(self.parent)
        
    def _fieldName(fieldID):            #Previously verbString
        return fieldID.getSubValue(Terms.uuName).stringValue or str(fieldID)
    
    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, parent, transactionState):
        id = uuid.uuid4().hex
        i = Instance.objects.create(id=id, typeID=self, parent=parent,
                                    transaction=transactionState.transaction)
        return i
    
    def getDataType(self, fieldID):
        configuration = self.typeID.children.filter(typeID=Terms.configuration,deletedinstance__isnull=True)[0]
        fields = configuration.children.filter(typeID=Terms.field,deletedinstance__isnull=True)
        f = fields.get(value__fieldID=Terms.name,
                          value__referenceValue=fieldID,
                          value__deletedvalue__isnull=True)
        v = f.value_set.filter(fieldID=Terms.dataType,deletedvalue__isnull=True)[0]
        return v.referenceValue
               
    def addValue(self, fieldID, value, position, transactionState):
        if self.getDataType(fieldID)==Terms.objectEnum:
            if not isinstance(value, Instance):
                value = Instance.objects.get(pk=value)
            return self.addReferenceValue(fieldID, value, position, transactionState)
        else:
            return self.addStringValue(fieldID, value, position, transactionState)

    def addStringValue(self, fieldID, value, position, transactionState):
        return Value.objects.create(instance=self, fieldID=fieldID, stringValue = value, position=position, transaction=transactionState.transaction)

    def addReferenceValue(self, fieldID, value, position, transactionState):
        return Value.objects.create(instance=self, fieldID=fieldID, referenceValue = value, position=position, transaction=transactionState.transaction)

    def createMissingSubValue(self, fieldID, value, position, transactionState):
        if self.getDataType(fieldID)==Terms.objectEnum:
            if Value.objects.filter(instance=self,fieldID=fieldID,referenceValue=value,
                                    deletedvalue__isnull=True).count() == 0:
                self.addReferenceValue(fieldID, value, position, transactionState)
        else:
            if Value.objects.filter(instance=self,fieldID=fieldID,stringValue=value,
                                    deletedvalue__isnull=True).count() == 0:
                self.addStringValue(fieldID, value, position, transactionState)
        
    def _getSubValues(self, fieldID):
        vs = self.value_set.filter(fieldID=fieldID, deletedvalue__isnull=True).order_by('position');
        return list(vs)
    
    # Returns a list of all of the values of self, aggregated by fieldID.id
    def _getValues(self):
        vs = self.value_set.filter(deletedvalue__isnull=True).order_by('fieldID', 'position');
        values = {}
        for v in vs:
            if v.fieldID.id not in values:
                    values[v.fieldID.id] = []
            values[v.fieldID.id].append(v)
        return values
    
    def _getSubInstances(self, field): # Previously _getSubValueObjects
        return [v.referenceValue for v in self._getSubValues(field)]
        
    # Returns a unique value of the specified id.
    def getSubValue(self, field):
        if not field:
            raise ValueError("field is not specified")
        
        try:
            return self.value_set.get(deletedvalue__isnull=True, fieldID=field)
        except Value.DoesNotExist:
            return None
            
    def getSubInstance(self, field):
        if not field:
            raise ValueError("field is not specified")
            
        v = self.getSubValue(field)
        return v and v.referenceValue
            
    # Returns a list of pairs of text that are used to generate the description of objects 
    # of this kind.
    # The first of the pair is the hex UUID of the name, the second is the hex UUID of the dataType
    @property
    def _descriptors(self):
        configuration = self.getSubInstance(Terms.configuration)
        results = []
        if configuration:
            elementIDs = [Terms.name, Terms.dataType]
            for fieldObject in configuration._getSubInstances(Terms.field):
                r = fieldObject.getSubInstance(Terms.descriptorType)
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
    def _getDescription(self, verbs):
        r = []
        for name, dataType, descriptorType in verbs:
            if descriptorType == Terms.textEnum:
                vs = self.value_set.filter(fieldID=name, deletedvalue__isnull=True).order_by('position')
                if dataType == Terms.objectEnum:
                    for v in vs:
                        try:
                            if not v.referenceValue:
                                raise ValueError("no reference value for %s in %s: %s(%s)" % (str(v.instance), str(self), str(v.fieldID), v.stringValue))
                            r.append(v.referenceValue.description_set.get(language__isnull=True).text)
                        except Description.DoesNotExist:
                            r.append(v.referenceValue._description)
                else:
                    r.extend([v.stringValue for v in vs])
            elif descriptorType == Terms.countEnum:
                vs = self.value_set.filter(fieldID=name, deletedvalue__isnull=True)
                r.append(str(vs.count()))
            else:
                raise ValueError("unrecognized descriptorType %s" % descriptorType.getSubValue(Terms.uuName).stringValue);
                    
        return " ".join(r)
        
    def cacheDescription(self, nameLists):
        s = self._getDescription(nameLists.getNameUUIDs(self.typeID))
        Description.objects.update_or_create(instance = self, 
                                             language = None, 
                                             defaults={'text': s})
        return s
    
    # Return a list of the instances for which this instance contributes
    # to the description.
    @property
    def _descriptionReferences(self):
        values = Value.objects.filter(referenceValue=self)\
            .filter(deletedvalue__isnull=True)
        return [v.instance for v in filter(lambda v: v.isDescriptor, values)]

    def updateDescriptions(queue, nameLists):
        queue = list(queue) # Make a local copy of the list.
        calculated = []
        while len(queue) > 0:
            i = queue[0]
            queue = queue[1:]
            if i not in calculated:
                i.cacheDescription(nameLists)
                queue.extend(i._descriptionReferences)
                calculated.append(i)
    
    @property
    def _description(self):
        d = Description.objects.filter(instance=self, language_id__isnull=True)
        if d.exists(): 
            return d[0].text
        else:
            return "Deleted"

    # Get the cached description of this Instance.        
    def description(self, language=None):
        if language:
            return Description.objects.get(instance=self, language=language).text
        else:
            return Description.objects.get(instance=self, language__isnull=True).text
    
    @property    
    def _allInstances(self):    # was _getAllInstances()
        return self.typeInstances.filter(deletedinstance__isnull=True);
            
    # returns a dictionary of info describing self.
    def clientObject(self, language=None):
        return {'id': None, 'value': {'id': self.id, 'description': self.description(language)}}
    
    def rootDescriptors(self, language=None):
        return [e.clientObject(language) for e in self._allInstances]

    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, language=None):
        return self.clientObject(language)        
        
    # Returns a dictionary by field where each value is
    # a duple containing the value containing the name and 
    # the instance referenced by self from the key field.
    def _getSubValueReferences(self):
        vs2 = Value.objects.filter(fieldID__in=[Terms.name, Terms.uuName],
                                   deletedvalue__isnull=True)
        vs1 = self.value_set.filter(deletedvalue__isnull=True)\
                            .prefetch_related(Prefetch('referenceValue__value_set',
                                                       queryset=vs2,
                                                       to_attr='name_values'));
        d = {}
        for v1 in vs1:
            # Ensure there is a referenceValue, because some properties of a field may
            # not be an object (such as pickValuePath).
            if v1.referenceValue:
                d[v1.fieldID] = (v1.referenceValue.name_values[0], v1.referenceValue)
        return d
    
    # For a parent field when getting data, construct this special field record
    # that can be used to display this field data.
    def getParentReferenceFieldData(self):
        name = self.getSubValue(Terms.uuName).stringValue
        fieldData = {"name" : name,
                     "nameID" : self.id,
                     "dataType" : TermNames.object,
                     "dataTypeID" : Terms.objectEnum.id,
                     "capacity" : TermNames.uniqueValue,
                     "ofKind" : name,
                     "ofKindID" : self.id}
        return fieldData
                     
    def getFieldData(self, language=None):
        d = self._getSubValueReferences()
        fieldData = None
        if Terms.name in d and Terms.dataType in d:
            nameReference = d[Terms.name]
            dataTypeReference = d[Terms.dataType]
            fieldData = {"id" : self.id, 
                         "name" : nameReference[0].stringValue,
                         "nameID" : nameReference[1].id,
                         "dataType" : dataTypeReference[0].stringValue,
                         "dataTypeID" : dataTypeReference[1].id}
            if Terms.maxCapacity in d:
                fieldData["capacity"] = d[Terms.maxCapacity][0].stringValue
            else:
                fieldData["capacity"] = TermNames.multipleValues
                
            if Terms.descriptorType in d:
                fieldData["descriptorType"] = d[Terms.descriptorType][0].stringValue
            
            if Terms.addObjectRule in d:
                fieldData["objectAddRule"] = d[Terms.addObjectRule][0].stringValue
            
            if fieldData["dataTypeID"] == Terms.objectEnum.id:
                if Terms.ofKind in d:
                    ofKindReference = d[Terms.ofKind]
                    fieldData["ofKind"] = ofKindReference[0].stringValue
                    fieldData["ofKindID"] = ofKindReference[1].id
                v = self.getSubValue(Terms.pickObjectPath)
                if v:
                    fieldData["pickObjectPath"] = v.stringValue;
        
        return fieldData
    
    # Return an array where each element contains the id and description for an object that
    # is contained by self.
    def _getSubReferences(self, field, language=None):
        return [v.clientObject(language) for v in self._getSubValues(field)]
    
    def _getCellData(self, fieldData, values, language=None):
        cell = {"field": fieldData}                        
        fieldID = fieldData["nameID"]
        if fieldID not in values:
            cell["data"] = []
        elif fieldData["dataTypeID"] == Terms.objectEnum.id:
            cell["data"] = [v.clientObject(language) for v in values[fieldID]]
        else:
            # Default case is that each datum in this cell contains a unique value.
            cell["data"] = [{"id": v.id, "value": v.stringValue} for v in values[fieldID]]
        return cell
                
    # Returns an array of arrays.
    def getData(self, fieldsData, language=None):
        values = self._getValues()
        return [self._getCellData(fieldData, values, language) for fieldData in fieldsData]

    # self should be a configuration object with fields.
    def getConfiguration(self):
        return [{"field": fieldObject.getFieldData()} for fieldObject in self._getSubInstances(Terms.field)]

    def getMaxElementIndex(self, field):
        maxElementIndex = reduce(lambda x,y: max(x, y), 
                                 [e.position for e in self._getSubValues(field)],
                                 -1)
        if maxElementIndex < 0:
            return None
        else:
            return maxElementIndex

    def updateElementIndexes(self, field, newIndex, transactionState):
        ids = {}
        
        for e in self._getSubValues(field):
            ids[e.position] = e
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
        
    def markAsDeleted(self, transactonState):
        DeletedInstance.objects.create(id=self, transaction=transactionState.transaction)

    def deepDelete(self, transactionState):
        queue = [self]
        DeletedInstance.objects.create(id=self, transaction=transactionState.transaction)
        while len(queue) > 0:
            next = queue[0]
            queue = queue[1:]
            instances = next.children.filter(deletedinstance__isnull=True)
            values = next.value_set.filter(deletedvalue__isnull=True)
            queue.extend(instances)
            DeletedInstance.objects.bulk_create(
                [DeletedInstance(id=n,transaction=transactionState.transaction) for n in instances]);
            DeletedValue.objects.bulk_create(
                [DeletedValue(id=v,transaction=transactionState.transaction) for v in values]);

    def deleteOriginalReference(self, transactionState):
        if self.parent:
            for v in self.referenceValues.filter(instance=self.parent):
                v.markAsDeleted(transactionState) 
                
    # Return the Value for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    # Self is of type configuration.
    def getFieldByName(self, name):
        vs = self.value_set.filter(deletedvalue__isnull=True,
                              fieldID=Terms.field)\
                              .select_related('referenceValue')
        for v in vs:
            vs2 = v.referenceValue.value_set.filter(deletedvalue__isnull=True,
                              fieldID=Terms.name)\
                              .select_related('referenceValue')
            for v2 in vs2:
                vs3 = v2.referenceValue.value_set.filter(deletedvalue__isnull=True,
                              fieldID=Terms.uuName,
                              stringValue=name)
                for v3 in vs3:
                    return v.referenceValue
        raise Value.DoesNotExist('field "%s" does not exist' % name)

    @property
    def inheritsSecurity(self):
        return True
        
    # returns the privilege level that the specified user instance has for this instance. 
    def getPrivilege(self, user):
        instances = [self]
        while instances[-1].parent and instances[-1].inheritsSecurity:
            instances.append(instances[-1].parent)
        
        accessRecords = Instance.objects.filter(typeID=Terms.accessRecord, parent__in=instances,
            deletedinstance__isnull=True)
            
        # Access records that for which the user has access.
        userRecords = accessRecords.filter( \
                             Q(value__fieldID=Terms.user,value__referenceValue=user) | \
                             Q(value__fieldID=Terms.group, \
                               value__referenceValue__value__referenceValue=user, \
                               value__referenceValue__deletedinstance__isnull=True, \
                               value__referenceValue__value__deletedvalue__isnull=True), \
                             value__deletedvalue__isnull=True) \
                             .distinct()

        return None
                    
class PrivilegeLevel:
    find = 1,
    read = 2,
    write = 4,
    administer = 8      
    
class DeletedInstance(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Instance', primary_key=True, db_column='id', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(self.id)
        
class LazyObject():
    # id can be a UUID or a string representation of a UUID
    def __init__(self, id=None):
        if not id:
            self.id = uuid.uuid4()
        elif isinstance(id, uuid.UUID):
            self.id = id
        else:
            try:
                self.id = uuid.UUID(id)
            except ValueError as e:
                raise ValueError("%s: %s" % (str(e), id))
            
    def __str__(self):
        return "uo{%s}" % self.id.hex
        
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
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    fieldID = dbmodels.ForeignKey('consentrecords.Instance', related_name='fieldValues', db_column='fieldid', db_index=True, editable=False)
    stringValue = dbmodels.CharField(max_length=255, db_index=True, null=True, editable=False)
    referenceValue = dbmodels.ForeignKey('consentrecords.Instance', related_name='referenceValues', db_index=True, null=True, editable=False)
    position = dbmodels.IntegerField(editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        if self.referenceValue:
            d = str(self.referenceValue)
        else:
            d = self.stringValue
        return "%s[%s:%s]@%s" % (str(self.instance), 
                                 str(self.fieldID), 
                                 d, 
                                 str(self.position))
    
    @property
    def field(self):
        return self.fieldID
        
    @property
    def objectValue(self):
        if self.referenceValue:
            return str(self.referenceValue)
        else:
            return self.stringValue
    
    @property
    def isDescriptor(self):
        container = self.instance
        configurationInstance = Instance.objects.filter(parent=container.typeID, typeID=Terms.configuration) \
            .get(deletedinstance__isnull=True)
        fields = Instance.objects.filter(parent=configurationInstance, typeID=Terms.field) \
            .filter(deletedinstance__isnull=True)\
            .filter(value__fieldID=Terms.name,\
                    value__referenceValue=self.fieldID,
                    value__deletedvalue__isnull=True)\
            .filter(value__fieldID=Terms.descriptorType,
                    value__deletedvalue__isnull=True)
        return fields.count() > 0

    @property
    def isOriginalReference(self):
        # If it is not an id, then return false.
        if not self.referenceValue:
            return False
        return self.referenceValue.parent == self.instance
        
    # returns a dictionary of info describing self.
    def clientObject(self, language=None):
        description = Description.objects.get(instance=self.referenceValue, language__isnull=True) 
        return {'id': self.id, 
                'value': {'id': self.referenceValue.id, 'description': description.text},
                'position': self.position}
    
    def getReferenceData(self, languageID=None):
        description = Description.objects.get(instance=self.referenceValue, language_id__isnull=True)
        return { "id": self.id,
              "value": {"id" : self.referenceValue.id, "description": description.text },
              "position": self.position }
            
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, newStringValue, transactionState):
        self.markAsDeleted(transactionState)
        return self.instance.addValue(self.fieldID, newStringValue, self.position, transactionState);
    
    # Updates the position of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateIndex(self, newIndex, transactionState):
        self.markAsDeleted(transactionState)
        return Value.objects.create(instance=self.instance, 
            fieldID=self.fieldID, 
            stringValue = self.stringValue, 
            referenceValue = self.referenceValue, 
            position=newIndex, 
            transaction=transactionState.transaction)
    
    def markAsDeleted(self, transactionState):
        DeletedValue.objects.create(id=self, transaction=transactionState.transaction)
        
class DeletedValue(dbmodels.Model):
    id = dbmodels.OneToOneField('consentrecords.Value', primary_key=True, db_column='id', db_index=True, editable=False)
    transaction = dbmodels.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return str(self.id)
        
class Description(dbmodels.Model):
    id = dbmodels.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    instance = dbmodels.ForeignKey('consentrecords.Instance', db_index=True, editable=False)
    language = dbmodels.ForeignKey('consentrecords.Instance', related_name='language', db_index=True, null=True, editable=False)
    text = dbmodels.CharField(max_length=255, db_index=True, editable=True)
    
class TermNames():
    # These verbs are associated with field IDs of values.
    uuName = '_uuname'
    configuration = '_configuration'
    field = '_field'
    boolean = '_boolean'
    name = '_name'
    dataType = '_data type'
    string = '_string'
    number = '_number'
    datestamp = '_datestamp'
    object = '_object'
    ofKind = '_of kind'
    pickObjectPath = '_pick object path'
    enumerator = 'enumerator'
    maxCapacity = '_max capacity'
    uniqueValue = '_unique value'
    multipleValues = '_multiple values'
    addObjectRule = '_object add rule'
    pickObjectRule = '_pick one'
    createObjectRule = '_create one'
    descriptorType = '_descriptor type'
    yes = '_yes'
    no = '_no'
    user = '_user'
    userID = '_userID'
    email = '_email'
    firstName = '_first name'
    lastName = '_last name'
    language = '_language'
    english = 'English'
    translation = '_translation'
    text = '_text'
    textEnum = '_by text'
    countEnum = '_by count'
    accessRecord = '_access record'
    privilege = '_privilege'
    findPrivilege = '_find'
    readPrivilege = '_read'
    writePrivilege = '_write'
    administerPrivilege = '_administer'
    group = '_group'

    initialKinds = [
        configuration,      # identifies a configuration instance (contained by a kind)
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
        language,           # identifies an instance of a language
        translation,        # identifies an instance of translated text
        text,               # identifies the text of a translation.
        accessRecord,       # identifies an access record for an instance
        privilege,          # identifies a privilege associated with an access record
        group,              # identifies a group associated with an access record
        ]

class Terms():
    uuName = None
    configuration = None
    field = None
    boolean = None
    name = None
    ofKind = None
    pickObjectPath = None
    enumerator = None
    dataType = None
    maxCapacity = None
    addObjectRule = None
    descriptorType = None
    user = None
    userID = None
    email = None
    firstName = None
    lastName = None
    language = None
    translation = None
    text = None
    accessRecord = None
    privilege = None
    group = None
    
    textEnum = None
    countEnum = None
    
    objectEnum = None
    stringEnum = None
    
    uniqueValueEnum = None
    multipleValuesEnum = None
    
    pickObjectRuleEnum = None
    createObjectRuleEnum = None
    
    def initialize(transactionState=None):
        try:
            Terms.uuName = Terms.getUUName()
            Terms.configuration = Terms.getOrCreateNamedInstance(TermNames.configuration, transactionState)
            Terms.field = Terms.getOrCreateNamedInstance(TermNames.field, transactionState)
            Terms.boolean = Terms.getOrCreateNamedInstance(TermNames.boolean, transactionState)
            Terms.name = Terms.getOrCreateNamedInstance(TermNames.name, transactionState)
            Terms.ofKind = Terms.getOrCreateNamedInstance(TermNames.ofKind, transactionState)
            Terms.pickObjectPath = Terms.getOrCreateNamedInstance(TermNames.pickObjectPath, transactionState)
            Terms.enumerator = Terms.getOrCreateNamedInstance(TermNames.enumerator, transactionState)
            Terms.dataType = Terms.getOrCreateNamedInstance(TermNames.dataType, transactionState)
            Terms.maxCapacity = Terms.getOrCreateNamedInstance(TermNames.maxCapacity, transactionState)
            Terms.addObjectRule = Terms.getOrCreateNamedInstance(TermNames.addObjectRule, transactionState)
            Terms.descriptorType = Terms.getOrCreateNamedInstance(TermNames.descriptorType, transactionState)
            Terms.user = Terms.getOrCreateNamedInstance(TermNames.user, transactionState)
            Terms.userID = Terms.getOrCreateNamedInstance(TermNames.userID, transactionState)
            Terms.email = Terms.getOrCreateNamedInstance(TermNames.email, transactionState)
            Terms.firstName = Terms.getOrCreateNamedInstance(TermNames.firstName, transactionState)
            Terms.lastName = Terms.getOrCreateNamedInstance(TermNames.lastName, transactionState)
            Terms.language = Terms.getOrCreateNamedInstance(TermNames.language, transactionState)
            Terms.translation = Terms.getOrCreateNamedInstance(TermNames.translation, transactionState)
            Terms.text = Terms.getOrCreateNamedInstance(TermNames.text, transactionState)
            Terms.accessRecord = Terms.getOrCreateNamedInstance(TermNames.accessRecord, transactionState)
            Terms.privilege = Terms.getOrCreateNamedInstance(TermNames.privilege, transactionState)
            Terms.group = Terms.getOrCreateNamedInstance(TermNames.group, transactionState)
            Terms.accessRecord = Terms.getOrCreateNamedInstance(TermNames.accessRecord, transactionState)
        
            Terms.textEnum = Terms.getNamedEnumerator(Terms.descriptorType, TermNames.textEnum);
            Terms.countEnum = Terms.getNamedEnumerator(Terms.descriptorType, TermNames.countEnum);
        
            Terms.objectEnum = Terms.getNamedEnumerator(Terms.dataType, TermNames.object);
            Terms.stringEnum = Terms.getNamedEnumerator(Terms.dataType, TermNames.string);
        
            Terms.uniqueValueEnum = Terms.getNamedEnumerator(Terms.maxCapacity, TermNames.uniqueValue);
            Terms.multipleValuesEnum = Terms.getNamedEnumerator(Terms.maxCapacity, TermNames.multipleValues);

            Terms.pickObjectRuleEnum = Terms.getNamedEnumerator(Terms.addObjectRule, TermNames.pickObjectRule);
            Terms.createObjectRuleEnum = Terms.getNamedEnumerator(Terms.addObjectRule, TermNames.createObjectRule);
            
        except Instance.DoesNotExist: pass
        except Value.DoesNotExist: pass
    
    def getUUName():
        try:
            return Instance.objects.get(value__deletedvalue__isnull=True,
                value__stringValue=TermNames.uuName,\
                value__fieldID=F("id"))
        except Instance.DoesNotExist:
            return Terms.createUUName()

    def getNamedInstance(uuname):
        try:
            return Instance.objects.get(deletedinstance__isnull=True,
                value__deletedvalue__isnull=True,
                value__fieldID = Terms.uuName,
                value__stringValue=uuname)
        except Instance.DoesNotExist:
            raise Instance.DoesNotExist('the term "%s" is not recognized' % uuname)
    
    def getOrCreateNamedInstance(uuname, transactionState):
        try:
            return Terms.getNamedInstance(uuname)
        except Instance.DoesNotExist:
            i = Instance.objects.create(typeID=Terms.uuName, parent=None, transaction=transactionState.transaction)
            i.addStringValue(Terms.uuName, uuname, 0, transactionState)
            return i
            
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getNamedEnumerator(uuname, stringValue):
        v = Value.objects.get(instance=uuname, fieldID=Terms.enumerator,
                          deletedvalue__isnull=True,
                          referenceValue__value__fieldID=Terms.name,
                          referenceValue__value__deletedvalue__isnull=True,
                          referenceValue__value__stringValue=stringValue)
        return v.referenceValue
    
    # Return the UUID for the specified Ontology object. If it doesn't exist, raise a Value.DoesNotExist.   
    def getTranslationNamedEnumerator(uuname, stringValue):
        v = Value.objects.get(instance=uuname, fieldID = Terms.enumerator,
                              deletedvalue__isnull=True,
                              referenceValue__value__fieldID=Terms.translation,
                              referenceValue__value__deletedvalue__isnull=True,
                              referenceValue__value__referenceValue__value__fieldID = Terms.text,
                              referenceValue__value__referenceValue__value__stringValue = stringValue,
                              referenceValue__value__referenceValue__value__deletedvalue__isnull=True)
        return v.referenceValue
        
    def isUUID(s):
        return re.search('^[a-fA-F0-9]{32}$', s)
    
    # Return a 32 character hex string which represents the ID of the specified universal name.
    # If the argument is a 32 character hex string, then it is considered that ID. Otherwise,
    # it is looked up by name.
    def getInstance(uuname):
        if Terms.isUUID(uuname):
            return Instance.objects.get(pk=uuname);
        else:
            return Terms.getNamedInstance(uuname)
            
