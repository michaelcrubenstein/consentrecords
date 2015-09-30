from django.db import connection, models
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
import string
from multiprocessing import Lock

class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('custom_user.AuthUser', db_index=True, editable=False)
    creation_time = models.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)
    time_zone_offset = models.SmallIntegerField(editable=False)
    
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
        with TransactionState.mutex:
            if self.currentTransaction == None:
                self.currentTransaction = Transaction.createTransaction(self.user, self.timeZoneOffset)

        return self.currentTransaction

class Fact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject = models.UUIDField(db_index=True, editable=False)
    verb = models.UUIDField(db_index=True, editable=False)
    directObject = models.CharField(max_length=255, db_index=True, null=True, editable=False)
    transaction = models.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    # These verbs are directly associated with objects.
    uuNameName = '_uuname'
    instanceOfName = '_is an instance of'
    indexName = '_index'
    
    # This verb identifies a value.
    valueName = '_value'

    # These verbs are associated with valued objects.
    configurationName = '_configuration'
    fieldName = '_field'
    nameName = '_name'
    dataTypeName = '_data type'
    stringName = '_string'
    numberName = '_number'
    datestampName = '_datestamp'
    objectName = '_object'
    enumeratedValueName = '_enumerated value from a list'
    ofKindName = '_of kind'
    maxCapacityName = '_max capacity'
    uniqueValueName = '_unique value'
    multipleValuesName = '_multiple values'
    addObjectRuleFieldName = '_object add rule'
    pickObjectRuleName = '_pick object'
    createObjectRuleName = '_create object'
    isDescriptorName = '_is descriptor'
    yesName = '_yes'
    noName = '_no'
    
    _initialKinds = [instanceOfName, # identifies the kind of an object.
        valueName,
        indexName,              # identifies the index of an object within its container
        configurationName,      # identifies a configuration instance  (contained by a kind)
        fieldName,              # identifies a field instance (contained by a configuration)
        nameName,               # Defines the proper name of an object.
        ofKindName,             # identifies the type of object for a property of "object" data type.
        dataTypeName,           # defines the data type of a property
        stringName,             # identifies a string data type
        numberName,             # identifies a string data type
        datestampName,          # identifies a string data type
        objectName,             # identifies an object data type
        enumeratedValueName,    # identifies and enumerated value data type
        maxCapacityName,        # defines the quantity relationship of a field within its container.
        uniqueValueName,        # identifies fields that have only one value.
        multipleValuesName,     # identifies fields that have multiple values.
        addObjectRuleFieldName,         # defines the rule for adding objects to a field that supports multiple objects
        pickObjectRuleName,         # identifies fields where you add an object by picking it
        createObjectRuleName,       # identifies fields where you add an object by instantiating a new instance.
        isDescriptorName,       # defines whether a field is a descriptor of its instance.
        yesName,                # identifies the value yes.
        noName,                 # identifies the value no.
        ]
    
    _initialUUNames = {}  
        
    _bootstrapName = 'Bootstrap'
    
    # An exception that gets raised when trying to do an operation that needs to create 
    # a fact in a context in which facts should not be created (such as getting an enumeration list)
    class NoEditsAllowedError(ValueError):
        def __str__(self):
            return "No edits are allowed for this operation."

    class UnrecognizedNameError(ValueError):
        def __init__(self, uuname):
            self.uuname = uuname
            
        def __str__(self):
            return "The term \"%s\" is not recognized" % self.uuname
            
    @property
    def verbString(self):
        return UniqueObject(self.verb).getSubData(Fact.uuNameUUID()) or str(self.verb)
            
    @property
    def directObjectString(self):
        try:
            return UniqueObject(self.directObject).objectString
        except Exception:
            return self.directObject
    
    def __str__(self):
        return UniqueObject(self.subject).objectString + ":" + str(self.verbString) + ": " \
            + self.directObjectString
    
    # Create the configuration for the uuname uuname.
    def createUUNameConfiguration(transactionState):
        uunameUUID = Fact.uuNameUUID()
        container = UniqueObject(uunameUUID)
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configurationUUID = Fact.configurationUUID()
            
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

        fieldValues = [uunameUUID.hex, configurationUUID.hex]

        fields = configObject.createFields(fieldValues, transactionState)
        
        p = fields[uunameUUID.hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
        
        p = fields[configurationUUID.hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), configurationUUID.hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
            
    # Create the configuration for the configuration uuname.    
    def createConfigurationConfiguration(transactionState):
        configurationUUID = Fact.configurationUUID()
        container = UniqueObject(configurationUUID)
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
                
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)
        
        fieldValues = [Fact.nameUUID().hex, Fact.fieldUUID().hex]

        fields = configObject.createFields(fieldValues, transactionState)
        
        p = fields[Fact.nameUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
        
        p = fields[Fact.fieldUUID().hex]
        p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.ofKindUUID(), Fact.fieldUUID().hex, 0, transactionState)
        p.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
        
    # Create the configuration for the configuration uuname.    
    def createFieldConfiguration(transactionState):
        containerUUID = Fact.fieldUUID()
        container = UniqueObject(containerUUID)
        configurationUUID = Fact.configurationUUID()
        
        configurationValues = [Fact._bootstrapName];
        configurations = container.createConfigurations(configurationValues, transactionState)
        configObject = configurations[Fact._bootstrapName]
        
        configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)
        
        fieldValues = [Fact.nameUUID().hex, 
                       Fact.dataTypeUUID().hex,
                       Fact.maxCapacityUUID().hex,
                       Fact.isDescriptorUUID().hex,
                       Fact.ofKindUUID().hex,
                       Fact.enumeratedValueUUID().hex,
                       Fact.addObjectRuleFieldUUID().hex,
                      ]

        fields = configObject.createFields(fieldValues, transactionState)
        
        f = fields[Fact.nameUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.isDescriptorUUID(), Fact.yesUUID().hex, 0, transactionState)
        
        f = fields[Fact.dataTypeUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.enumeratedValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        
        enums = [ Fact.stringUUID().hex,
                 Fact.numberUUID().hex,
                 Fact.datestampUUID().hex,
                 Fact.enumeratedValueUUID().hex,
                 Fact.objectUUID().hex,
                ]
        
        f.createEnumerations(enums, transactionState)
        
        f = fields[Fact.maxCapacityUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.enumeratedValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        
        enums = [ Fact.uniqueValueUUID().hex,
                 Fact.multipleValuesUUID().hex,
                ]
        
        f.createEnumerations(enums, transactionState)
        
        f = fields[Fact.isDescriptorUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.enumeratedValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        
        enums = [ Fact.yesUUID().hex,
                 Fact.noUUID().hex,
                ]
        
        f.createEnumerations(enums, transactionState)
        
        f = fields[Fact.ofKindUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)        
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)

        f = fields[Fact.enumeratedValueUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)

        f = fields[Fact.addObjectRuleFieldUUID().hex]
        f.createMissingSubValue(Fact.dataTypeUUID(), Fact.enumeratedValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
        f.createMissingSubValue(Fact.addObjectRuleFieldUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
        
        enums = {Fact.pickObjectRuleUUID().hex : None,
                 Fact.createObjectRuleUUID().hex : None }
        
        f.createEnumerations(enums, transactionState)
        
    def initializeFacts(transactionState):
        
        # Initialize global variables.
        Fact._initialUUNames = {}  
        
        #Instantiate the uuName uuName.
        with connection.cursor() as c:
            sql = "SELECT f1.subject" + \
                  " FROM consentrecords_fact f1" + \
                  " WHERE f1.verb = f1.subject AND f1.directObject = %s"
            c.execute(sql, [Fact.uuNameName])
            i = c.fetchone()
            if i:
                uunameID = uuid.UUID(i[0])
            else:
                uunameID = uuid.uuid4()
                Fact.objects.create(subject=uunameID.hex, verb=uunameID.hex, directObject=Fact.uuNameName, transaction=transactionState.transaction)
        
        # Instantiate all of the other core uuNames.
        for s in Fact._initialKinds:
            try: 
                id = Fact.getNamedUUID(s, transactionState)
            except Fact.UnrecognizedNameError:
                obj = uuid.uuid4()
                Fact.objects.create(subject=obj.hex, verb=uunameID.hex, directObject = s, transaction=transactionState.transaction)
           
        # Mark all uunames as instances of uuname.
        UniqueObject(Fact.uuNameUUID()).createMissingSubFact(Fact.instanceOfUUID(), Fact.uuNameUUID().hex, transactionState)
        for s in Fact._initialKinds:
            id = Fact.getNamedUUID(s, transactionState)
            UniqueObject(id).createMissingSubFact(Fact.instanceOfUUID(), Fact.uuNameUUID().hex, transactionState)
            
        Fact.createUUNameConfiguration(transactionState)
        Fact.createConfigurationConfiguration(transactionState)
        Fact.createFieldConfiguration(transactionState)
            
    # Return the UUID for the 'uuname' ontology element. 
    def uuNameUUID():
        name = Fact.uuNameName
        if name not in Fact._initialUUNames:
            with connection.cursor() as c:
                sql = "SELECT f1.subject" + \
                      " FROM consentrecords_fact f1" + \
                      " WHERE f1.verb = f1.subject AND f1.directObject = %s" + \
                      " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
                c.execute(sql, [Fact.uuNameName])
                i = c.fetchone();
                Fact._initialUUNames[name] = uuid.UUID(i[0])
        
        return Fact._initialUUNames[name]
    
    def _getInitialUUID(name):
        if name not in Fact._initialUUNames:
            try:
                Fact._initialUUNames[name] = Fact.objects.get(directObject=name, verb=Fact.uuNameUUID().hex).subject
            except Fact.DoesNotExist:
                raise Fact.UnrecognizedNameError(name)
                
            if isinstance(Fact._initialUUNames[name], str):
                Fact._initialUUNames[name] = uuid.UUID(Fact._initialUUNames[name])
                
        return Fact._initialUUNames[name]

    # Return the UUID for the 'is an instance of' ontology element. 
    def instanceOfUUID(): return Fact._getInitialUUID(Fact.instanceOfName)
    
    # Return the UUID for the 'value' ontology element. 
    def valueUUID(): return Fact._getInitialUUID(Fact.valueName)
        
    def configurationUUID(): return Fact._getInitialUUID(Fact.configurationName)
        
    def nameUUID(): return Fact._getInitialUUID(Fact.nameName)
        
    def fieldUUID(): return Fact._getInitialUUID(Fact.fieldName)
        
    def dataTypeUUID(): return Fact._getInitialUUID(Fact.dataTypeName)
        
    def stringUUID(): return Fact._getInitialUUID(Fact.stringName)
    def numberUUID(): return Fact._getInitialUUID(Fact.numberName)
    def datestampUUID(): return Fact._getInitialUUID(Fact.datestampName)
        
    def objectUUID(): return Fact._getInitialUUID(Fact.objectName)
        
    def enumeratedValueUUID(): return Fact._getInitialUUID(Fact.enumeratedValueName)
    
    def ofKindUUID(): return Fact._getInitialUUID(Fact.ofKindName)
    
    def indexUUID(): return Fact._getInitialUUID(Fact.indexName)
    
    # Gets the UUID for the quantity relationship of a field within its container.
    def maxCapacityUUID(): return Fact._getInitialUUID(Fact.maxCapacityName)

    # Gets the UUID for the enum of fields that have only one value.
    def uniqueValueUUID(): return Fact._getInitialUUID(Fact.uniqueValueName)

    # Gets the UUID for the enum of fields that have multiple values.
    def multipleValuesUUID(): return Fact._getInitialUUID(Fact.multipleValuesName)

    def addObjectRuleFieldUUID(): return Fact._getInitialUUID(Fact.addObjectRuleFieldName)
    def pickObjectRuleUUID(): return Fact._getInitialUUID(Fact.pickObjectRuleName)
    def createObjectRuleUUID(): return Fact._getInitialUUID(Fact.createObjectRuleName)

    def isDescriptorUUID(): return Fact._getInitialUUID(Fact.isDescriptorName)
    def yesUUID(): return Fact._getInitialUUID(Fact.yesName)
    def noUUID(): return Fact._getInitialUUID(Fact.noName)

    # Return the UUID for the specified Ontology object. If it doesn't exist, it is created with the specified transaction.   
    def getNamedUUID(uuname, transactionState=None):
        verb = Fact.uuNameUUID()
        with connection.cursor() as c:
            sql = "SELECT f1.subject" + \
                  " FROM consentrecords_fact f1" + \
                  " WHERE f1.verb = %s" + \
                  " AND   f1.directObject = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [verb.hex, uuname])
            r = c.fetchone()
            if not r:
                raise Fact.UnrecognizedNameError(uuname)
            else:
                return uuid.UUID(r[0])
            
    def markAsDeleted(self, transactionState):
        DeletedFact.objects.create(fact=self, transaction=transactionState.transaction)

class DeletedFact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fact = models.ForeignKey('consentrecords.Fact', db_index=True, editable=False)
    transaction = models.ForeignKey('consentrecords.Transaction', db_index=True, editable=False)
    
    def __str__(self):
        return UniqueObject(self.fact.subject).objectString + ":" + str(self.fact.verbString) + ": " \
            + self.fact.directObjectString
    
class UniqueObject():
    
    # id can be a UUID or a string representation of a UUID
    def __init__(self, id=None):
        if not id:
            self.id = uuid.uuid4()
        elif isinstance(id, uuid.UUID):
            self.id = id
        else:
            self.id = uuid.UUID(id)
            
    def __str__(self):
        return "uo{%s}" % self.id.hex
        
    def verbString(verbID):
        return UniqueObject(verbID).getSubData(Fact.uuNameUUID()) or str(verbID)
    
    @property   
    def objectString(self):
        logger = logging.getLogger(__name__)
        logger.error("        objectString: %s" % str(self.id))
        if Fact.instanceOfName not in Fact._initialUUNames:
            logger.error("          instanceOfName does not exist %s" % str(Fact._initialUUNames))
            return str(self.id)
            
        try:
            instanceID = self.getSubData(Fact.instanceOfUUID())
            if not instanceID:
                logger.error("          object has no instanceOf element")
                return str(self.id)
            verbString = UniqueObject.verbString(uuid.UUID(instanceID))
            logger.error("          object verbString: %s" % verbString)
            if verbString == Fact.uuNameName:
                return "{%s}" % UniqueObject.verbString(self.id)
            else:
                return "{%s: %s}" % (verbString, str(self.id))
        except Exception:
            logger.error("          objectstring exception: %s" % traceback.format_exc())
            return str(self.id)     
    
    # Return the UniqueObject for the specified unique name. If it doesn't exist, it is created with the specified transaction.   
    def getNamedObject(uuname, transactionState):
        return UniqueObject(Fact.getNamedUUID(uuname, transactionState))
            
    # Gets an array of all of the enumeration value summary information: id, name and index.
    @property
    def enumerationValues(self):
        with connection.cursor() as c:
            sql = "SELECT f2.directObject, f3.directObject" + \
                  " FROM consentrecords_fact f1" + \
                       " JOIN consentrecords_fact f2" + \
                        " ON (f2.subject = f1.directObject AND f2.verb = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
                       " LEFT OUTER JOIN consentrecords_fact f3" + \
                        " ON (f3.subject = f1.directObject AND f3.verb = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f3.id))" + \
                  " WHERE f1.subject = %s AND f1.verb = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.valueUUID().hex, 
                            Fact.indexUUID().hex, 
                            self.id.hex, 
                            Fact.enumeratedValueUUID().hex,
                            ])
            r = [];
            for i in c.fetchall():
                d = {"id": None, 
                     "value": {"id": i[0], "description": UniqueObject(i[0]).getSubData(Fact.uuNameUUID())}}
                if i[1]: d["index"] = i[1]
                
                r.append(d)
            return sorted(r, key=UniqueObject.getIndex)
    
    def getIndex(d):
        return int(d["index"])
    
    # Gets a dictionary with all of the names of the enumeration values in the specified type as keys,
    # and the uuid of the enumeration object as the value.
    # Gets a dictionary of all of the universalObjects that are instances of the specified kind.
    # ofKindID is used as the directObject of an instanceOf verb to identify subjects that are root object IDs.
    # elementTypeName is the type used to identify what the descriptors are that describe each object.
    # Most of the type, nameTypeName and elementTypeName are the same, but they can be different
    # if there are objects that have two types (a parent type and a child type) and the child
    # type is used to identify the objects, but the parent type is used to get the description.
    def rootDescriptors(ofKindID):
        with connection.cursor() as c:
            r = []
            if ofKindID == Fact.uuNameUUID():
                sql = "SELECT f1.subject, f1.directObject" + \
                      " FROM consentrecords_fact f1" + \
                      " WHERE f1.verb = %s" + \
                      " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)" + \
                      " ORDER BY f1.directObject"
                c.execute(sql, [ofKindID.hex])
                for i in c.fetchall():
                    r.append({'id': None, 'value': {'description': i[1], 'id': i[0]}})
            else:
                ofKindObject = UniqueObject(ofKindID)
                nameFieldUUIDs = ofKindObject._descriptors
                for e in ofKindObject.getAllInstances():
                    r.append({'id': None, 'value': { 'id': e.id.hex,
                          'description': e._getDescription(nameFieldUUIDs), }})

            return r
    
    # verb is a UUID
    # directObject is an optional value.
    # return value is either a Fact object or None
    def getSubFact(self, verb, directObject=None):
        with connection.cursor() as c:
            if directObject:
                sql = "SELECT f1.id" + \
                  " FROM consentrecords_fact f1" + \
                  " WHERE subject = %s AND verb = %s AND directObject = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
                c.execute(sql, [self.id.hex, verb.hex, directObject])
            else:
                sql = "SELECT f1.id" + \
                  " FROM consentrecords_fact f1" + \
                  " WHERE subject = %s AND verb = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
                c.execute(sql, [self.id.hex, verb.hex])
            for i in c.fetchall():
                return Fact.objects.get(id=i[0])
            return None
        
    # verb is a UUID
    # directObject is an optional value.
    # return value is an array of all facts with the specified verb for this object.
    def getSubFacts(self, verb):
        with connection.cursor() as c:
            sql = "SELECT f1.id" + \
              " FROM consentrecords_fact f1" + \
              " WHERE subject = %s AND verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [self.id.hex, verb.hex])
            r = []
            for i in c.fetchall():
                r.append(Fact.objects.get(id=i[0]))
            return r
        
    def getSubObject(self, verb):
        with connection.cursor() as c:
            sql = "SELECT f1.directObject" + \
              " FROM consentrecords_fact f1" + \
              " WHERE subject = %s AND verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [self.id.hex, verb.hex])
            for i in c.fetchall():
                return UniqueObject(i[0])
            return None
    
    # verb is a UUID
    # return value is an array of all objects with the specified verb for this object.
    def getAllInstances(self):
        with connection.cursor() as c:
            sql = "SELECT f1.subject" + \
              " FROM consentrecords_fact f1" + \
              " WHERE verb = %s AND directObject = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.instanceOfUUID().hex, self.id.hex])
            r = []
            for i in c.fetchall():
                r.append(UniqueObject(i[0]))
            return r
            
    # verb is a UUID
    # return value is an array of all objects with the specified verb for this object.
    def getSubObjects(self, verb):
        with connection.cursor() as c:
            sql = "SELECT f1.directObject" + \
              " FROM consentrecords_fact f1" + \
              " WHERE subject = %s AND verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [self.id.hex, verb.hex])
            r = []
            for i in c.fetchall():
                # Confirm that the directObject is a uuid
                if len(i[0]) == 32 and all(c in string.hexdigits for c in i[0]):
                    r.append(UniqueObject(i[0]))
            return r
            
    # verb is a UUID
    # return value is an array of all objects with the specified verb for this object.
    def getSubUUIDs(self, verb):
        with connection.cursor() as c:
            sql = "SELECT f1.directObject, f2.directObject" + \
              " FROM consentrecords_fact f1" + \
              "      LEFT OUTER JOIN consentrecords_fact f2" + \
              "          ON (f2.subject = f1.directObject AND f2.verb = %s" + \
              "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
              " WHERE f1.subject = %s AND f1.verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.valueUUID().hex, self.id.hex, verb.hex])
            r = []
            for i in c.fetchall():
                if i[1]:
                    r.append(uuid.UUID(i[1]))
                else:
                    r.append(uuid.UUID(i[0]))
            return r
    
    # Returns a description of this object with these verbs. 
    # verbs is an array of pairs where the first of the pair is the field name and 
    # the second is the field dataType.
    # The string can either be directly attached to the verb (f1), a uuname from the verb (f2), 
    # a value object from the verb (f3) or a uuname from the value from the verb (f4).       
    def _getDescription(self, verbs):
        r = []
        logger = logging.getLogger(__name__)
        for verb in verbs:
            name, dataType = verb[0], verb[1]
            logger.error("    %s, %s" % (UniqueObject(name).objectString, UniqueObject(dataType).objectString))
            if dataType == Fact.objectUUID().hex or dataType == Fact.enumeratedValueUUID().hex:
                with connection.cursor() as c:
                    sql = "SELECT f3.directObject" + \
                      " FROM consentrecords_fact f1" + \
                      "      LEFT OUTER JOIN consentrecords_fact f3" + \
                      "          ON (f3.subject = f1.directObject AND f3.verb = %s" + \
                      "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f3.id))" + \
                      " WHERE f1.subject = %s AND f1.verb = %s" + \
                      " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
                    c.execute(sql, [Fact.valueUUID().hex, self.id.hex, name])
                    r.extend([UniqueObject(i[0])._description for i in c.fetchall()])
            else:
                with connection.cursor() as c:
                    sql = "SELECT f1.directObject, f2.directObject, f3.directObject, f4.directObject" + \
                      " FROM consentrecords_fact f1" + \
                      "      LEFT OUTER JOIN consentrecords_fact f2" + \
                      "          ON (f2.subject = f1.directObject AND f2.verb = %s" + \
                      "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
                      "      LEFT OUTER JOIN consentrecords_fact f3" + \
                      "          ON (f3.subject = f1.directObject AND f3.verb = %s" + \
                      "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f3.id))" + \
                      "      LEFT OUTER JOIN consentrecords_fact f4" + \
                      "          ON (f4.subject = f3.directObject AND f4.verb = %s" + \
                      "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f4.id))" + \
                      " WHERE f1.subject = %s AND f1.verb = %s" + \
                      " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
                    c.execute(sql, [Fact.uuNameUUID().hex, Fact.valueUUID().hex, Fact.uuNameUUID().hex, self.id.hex, name])
                    r.extend([(i[3] or i[2] or i[1] or i[0]) for i in c.fetchall()])
                    
        return " ".join(r)
    
    @property
    def _description(self):
        instanceID = self.getSubData(Fact.instanceOfUUID())
        if not instanceID: return "Object"
        
        ofKindObject = UniqueObject(instanceID)
        nameFieldUUIDs = ofKindObject._descriptors
        return self._getDescription(nameFieldUUIDs)
        
    def getSubData(self, verb):
        f = self.getSubFact(verb=verb)
        return f and f.directObject
    
    def getSubValue(self, verb):
        if not verb:
            raise ValueError("verb is not specified")
            
        with connection.cursor() as c:
            sql = "SELECT f2.directObject" + \
              " FROM consentrecords_fact f1" + \
              "      JOIN consentrecords_fact f2" + \
              "          ON (f2.subject = f1.directObject AND f2.verb = %s" + \
              "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
              " WHERE f1.subject = %s AND f1.verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.valueUUID().hex, self.id.hex, verb.hex])
            r = c.fetchone()
            return r and r[0]
    
    def getSubValueObject(self, verb):
        if not verb:
            raise ValueError("verb is not specified")
            
        v = self.getSubValue(verb)
        if v is not None:
            return UniqueObject(v)
        else:
            return None
            
    # verb is a UUIDs
    # return value is an array of dictionaries with value strings. 
    # The string can either be directly attached to the verb (f1) or 
    # a value object from the verb (f2).       
    def _getSubValues(self, verb):
        r = []
        with connection.cursor() as c:
            sql = "SELECT f1.directObject, f2.directObject, f3.directObject" + \
              " FROM consentrecords_fact f1" + \
              "      LEFT OUTER JOIN consentrecords_fact f2" + \
              "          ON (f2.subject = f1.directObject AND f2.verb = %s" + \
              "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
              "      LEFT OUTER JOIN consentrecords_fact f3" + \
              "          ON (f3.subject = f1.directObject AND f3.verb = %s" + \
              "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f3.id))" + \
              " WHERE f1.subject = %s AND f1.verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.valueUUID().hex, Fact.indexUUID().hex, self.id.hex, verb.hex])
            indexedFields = {}
            unindexedFields = []
            for i in c.fetchall():
                if i[1] is not None:
                    v = {"value": i[1], "id": uuid.UUID(i[0])}
                else:
                    v = {"value": i[0], "id": self.id}
                if i[2] is not None and int(i[2]) not in indexedFields:
                    indexedFields[int(i[2])] = v
                else:
                    unindexedFields.append(v)
        r = []
        for i in sorted(indexedFields):
            r.append(indexedFields[i])

        return (r + unindexedFields)
        
    def _getSubValueObjects(self, verb):
        r = []
        for v in self._getSubValues(verb):
            r.append(UniqueObject(v["value"]))
        return r
        
    def createMissingSubValue(self, verb, directObject, index, transactionState):
        with connection.cursor() as c:
            sql = "SELECT f1.directObject, f2.directObject" + \
              " FROM consentrecords_fact f1" + \
              "      LEFT OUTER JOIN consentrecords_fact f2" + \
              "          ON (f2.subject = f1.directObject AND f2.verb = %s" + \
              "              AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
              " WHERE f1.subject = %s AND f1.verb = %s" + \
              " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)" + \
              " AND   f2.directObject = %s"
            c.execute(sql, [Fact.valueUUID().hex, self.id.hex, verb.hex, directObject])
            for i in c.fetchall():
                return
                
        self.addValue(verb, directObject, index, transactionState)
        
    # Returns a list of pairs of text that are used to generate the description of objects 
    # of this kind.
    # The first of the pair is the hex UUID of the name, the second is the hex UUID of the dataType
    @property
    def _descriptors(self):
        configuration = self.getSubValueObject(verb=Fact.configurationUUID())
        results = []
        yesUUID = Fact.yesUUID()
        if configuration:
            elementIDs = [Fact.nameUUID(), Fact.dataTypeUUID()]
            for fieldObject in configuration._getSubValueObjects(verb=Fact.fieldUUID()):
                r = fieldObject.getSubValueObject(verb=Fact.isDescriptorUUID())
                if r and r.id == yesUUID:
                    n = [fieldObject.getSubValue(x) for x in elementIDs]
                    if n[0] and n[1]:
                        results.append(n)
        return results
        
    # Return enough data for a reference to this object and its human readable form.
    # This method is called only for root instances that don't have containers.
    def getReferenceData(self, ofKindObject):
        nameFieldUUIDs = ofKindObject._descriptors
        
        # The container of the data may be a value object or the object itself.
        # It will be a value object for values that have multiple data, such as enumerations.
        v = self.getSubObject(Fact.valueUUID()) or self
        f = { "id": None,
              "value": {"id": self.id.hex, "description": v._getDescription(nameFieldUUIDs), }}
        index = self.getSubData(verb=Fact.indexUUID());
        if index:
            f["index"] = index
            
        return f;
        
    def getValueData(self, ofKindObject):
        nameFieldUUIDs = ofKindObject._descriptors
        v = self.getSubObject(Fact.valueUUID()) or self
        f = { "id": self.id.hex,
              "value": {"id" : v.id.hex, "description": v._getDescription(nameFieldUUIDs), }}
        index = self.getSubData(verb=Fact.indexUUID());
        if index:
            f["index"] = index
        return f;
            
    # Return an array where each element contains the id and description for an object that
    # is contained by self.
    def _getSubReferences(self, nameObject, ofKindObject):
        nameFieldUUIDs = ofKindObject._descriptors

        data = self._getSubValues(nameObject.id)
        for d in data:
            v = UniqueObject(d["value"])
            d["value"] = {"id" : d["value"], "description" : v._getDescription(nameFieldUUIDs)}
        
        return data
    
    def getMaxElementIndex(self, elementID):
        maxElementIndex = None
        for e in self.getSubObjects(elementID):
            index = e.getSubData(verb=Fact.indexUUID())
            if index and (not maxElementIndex or maxElementIndex < int(index)):
                maxElementIndex = int(index)
        return maxElementIndex    

    # Returns a duple containing the name and id of an item referenced by self.
    def getSubValueReference(self, verb):
        valueObject = self.getSubValueObject(verb)
        if not valueObject:
            return None
        valueName = valueObject.getSubData(Fact.uuNameUUID())
        if valueName:
            return (valueName, valueObject.id)
        else:
            return None
    
    def getFieldData(self):
        nameReference = self.getSubValueReference(verb=Fact.nameUUID())
        dataTypeReference = self.getSubValueReference(verb=Fact.dataTypeUUID())
        fieldData = None
        if nameReference and dataTypeReference:
            fieldData = {"id" : self.id.hex, 
                         "name" : nameReference[0],
                         "nameID" : nameReference[1].hex,
                         "dataType" : dataTypeReference[0],
                         "dataTypeID" : dataTypeReference[1].hex}
            r = self.getSubValueReference(verb=Fact.maxCapacityUUID())
            if r:
                fieldData["capacity"] = r[0]
            else:
                fieldData["capacity"] = Fact.multipleValuesName
                
            r = self.getSubValueReference(verb=Fact.isDescriptorUUID())
            fieldData["isDescriptor"] = r and (r[0] == Fact.yesName)
            
            r = self.getSubValueReference(verb=Fact.addObjectRuleFieldUUID())
            if r:
                fieldData[Fact.addObjectRuleFieldName] = r[0]
            
            if fieldData["dataType"] == Fact.objectName:
                ofKindReference = self.getSubValueReference(verb=Fact.ofKindUUID())
                if not ofKindReference:
                    raise TypeError("the object field '%s' has no kind specified" % nameReference[0])
                fieldData["ofKind"] = ofKindReference[0]
                fieldData["ofKindID"] = ofKindReference[1].hex
        
        return fieldData
    
    # Returns an array of arrays.    
    def getData(self, dataObject=None):
        cells = []
        
        i = 0
        for fieldObject in self._getSubValueObjects(verb=Fact.fieldUUID()):
            fieldData = fieldObject.getFieldData()
            if fieldData:
                fieldData["index"] = i
                i += 1
                cell = {"field": fieldData}                        
                if dataObject:
                    nameObject = UniqueObject(fieldData["nameID"])
                    if fieldData["dataType"] == Fact.enumeratedValueName:
                        ofKindObject = UniqueObject(Fact.uuNameUUID())
                        cell["data"] = dataObject._getSubReferences(nameObject, ofKindObject)
                    elif fieldData["dataType"] == Fact.objectName:
                        ofKindObject = UniqueObject(fieldData["ofKindID"])
                        cell["data"] = dataObject._getSubReferences(nameObject, ofKindObject)
                    else:
                        # Default case is that this field contains a unique value.
                        cell["data"] = dataObject._getSubValues(nameObject.id)
                
                cells.append(cell)
                
        return cells

    # Returns a new instance of an object of this kind.
    def createEmptyInstance(self, transactionState):
        obj = UniqueObject()
        f = Fact.objects.create(subject=obj.id, verb=Fact.instanceOfUUID(), directObject=self.id.hex, transaction = transactionState.transaction)
        return obj
        
    def createSubFact(self, verb, directObject, transactionState):
        if isinstance(directObject, uuid.UUID):
            directObject = directObject.hex
        return Fact.objects.create(subject=self.id, verb=verb, directObject=directObject, transaction=transactionState.transaction)

    def createMissingSubFact(self, verb, directObject, transactionState):
        return self.getSubFact(verb, directObject) or self.createSubFact(verb, directObject, transactionState)
    
    def createEnumerations(self, itemValues, transactionState):
        elementUUID = Fact.enumeratedValueUUID()
        items = {}
        
        # See if there is an element of self which has a value in items.
        with connection.cursor() as c:
            sql = "SELECT f1.directObject, f2.directObject" + \
                  " FROM consentrecords_fact f1" + \
                       " JOIN consentrecords_fact f2" + \
                        " ON (f2.subject = f1.directObject AND f2.verb = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
                  " WHERE f1.subject = %s AND f1.verb = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.valueUUID().hex,
                            self.id.hex, 
                            elementUUID.hex,
                            ])
                            
            for i in c.fetchall():
                if i[1] in itemValues:
                    items[i[1]] = UniqueObject(i[0])

        index = self.getMaxElementIndex(elementUUID)
        if index == None:
            index = 0
        else:
            index = index + 1
        for v in itemValues:
            if v not in items:
                items[v] = self.addValue(elementUUID, v, index, transactionState)
                index += 1
        
        return items
    
    def createConfigurations(self, itemValues, transactionState):
        return self.createMissingInstances(Fact.configurationUUID(), Fact.nameUUID(), itemValues, transactionState)
        
    def createFields(self, itemValues, transactionState):
        return self.createMissingInstances(Fact.fieldUUID(), Fact.nameUUID(), itemValues, transactionState)
        
    # items is a dictionary whose keys are the missing values and whose values start as None
    # and end with the items that represent the instances.    
    # Updates the items dictionary by inserting the newly created property objects as the values for the keys
    def createMissingInstances(self, elementUUID, descriptorUUID, itemValues, transactionState):
        items = {}

        # See if there is an field of self which has a value that points to a name which has a value in items.
        with connection.cursor() as c:
            sql = "SELECT f2.directObject, f4.directObject" + \
                  " FROM consentrecords_fact f1" + \
                       " JOIN consentrecords_fact f2" + \
                        " ON (f2.subject = f1.directObject AND f2.verb = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f2.id))" + \
                       " JOIN consentrecords_fact f3" + \
                        " ON (f3.subject = f2.directObject AND f3.verb = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f3.id))" + \
                       " JOIN consentrecords_fact f4" + \
                        " ON (f4.subject = f3.directObject AND f4.verb = %s" + \
                        " AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f4.id))" + \
                  " WHERE f1.subject = %s AND f1.verb = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [Fact.valueUUID().hex,
                            descriptorUUID.hex, 
                            Fact.valueUUID().hex, 
                            self.id.hex, 
                            elementUUID.hex,
                            ])
                            
            for i in c.fetchall():
                if i[1] in itemValues:
                    items[i[1]] = UniqueObject(i[0])

        index = self.getMaxElementIndex(elementUUID)
        if index == None:
            index = 0
        else:
            index = index + 1
        for v in itemValues:
            if not v in items:
                items[v] = UniqueObject()
                self.addValue(elementUUID, items[v].id.hex, index, transactionState)
                index += 1
                items[v].addValue(descriptorUUID, v, 0, transactionState)
                items[v].createSubFact(Fact.instanceOfUUID(), elementUUID.hex, transactionState)
        
        return items
        
    # Updates the value of the specified object
    # All existing facts that identify the value are marked as deleted.            
    def updateValue(self, verbID, directObject, transactionState):
        with connection.cursor() as c:
            sql = "SELECT f1.id" + \
                  " FROM consentrecords_fact f1" + \
                  " WHERE f1.subject = %s AND f1.verb = %s" + \
                  " AND   NOT EXISTS(SELECT 1 FROM consentrecords_deletedfact df WHERE df.fact_id = f1.id)"
            c.execute(sql, [self.id.hex,
                            verbID.hex])
            for i in c.fetchall():
                f = Fact.objects.get(id=i[0])
                f.markAsDeleted(transactionState)
            
            self.createSubFact(verbID, directObject, transactionState)
    
    def updateElementIndexes(self, elementID, newIndex, transactionState):
        ids = {}
        
        verb = Fact.indexUUID()
        for e in self.getSubObjects(elementID):
            index = e.getSubData(verb=verb)
            if index:
                ids[int(index)] = e
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
                ids[movingIndexes[0]].updateValue(verb, str(movingIndexes[0] + 1), transactionState)
                lastIndex = movingIndexes[0]
                for i in movingIndexes[1:]:
                    if lastIndex + 1 < i:
                        break
                    ids[i].updateValue(verb, str(i + 1), transactionState)
                    lastIndex = movingIndexes[i]
                    
                return movingIndexes[0]
        
    def addValue(self, elementID, value, index, transactionState):
        dataObject = UniqueObject()
        self.createSubFact(elementID, dataObject.id.hex, transactionState)
        dataObject.createSubFact(Fact.valueUUID(), value, transactionState)
        dataObject.createSubFact(Fact.indexUUID(), str(index), transactionState)
        return dataObject
    
    def _addElementData(self, data, fieldData, elementObject, transactionState):
        # If the data is iterable, then create a fact for each iteration of the data.
        # Otherwise, create a fact whose value is the data.
        # Note that this doesn't recur, so it can't handle arrays of dictionaries,
        # which would be the logical construction of a recursive add.
        if isinstance(data, (str, numbers.Number, datetime.date, datetime.time, datetime.timedelta)):
            raise TypeError("Element data not in an array")
        else:           
            i = 0
            ids = []
            logger = logging.getLogger(__name__)
            for d in data:
                logger.error("        Saving data:\n          %s" % str(d))
                logger.error("        Field of data:\n          %s" % str(fieldData))
                elementID = elementObject.id
                v = d["value"]
                if isinstance(v, (str, numbers.Number, datetime.date, datetime.time, datetime.timedelta)):
                    logger.error("        Creating value object")
                    if elementID == Fact.uuNameUUID():
                        self.createSubFact(elementID, v, transactionState)
                        newObject = self
                    else:
                        newObject = self.addValue(elementID, v, i, transactionState)
                    ids.append(newObject.id.hex)
                elif "id" in v and v["id"] is not None:
                    # This is a reference to an object or an enumerated value.
                    logger.error("        Creating reference")
                    newObject = self.addValue(elementID, v["id"], i, transactionState)
                    ids.append(newObject.id.hex)
                elif uuid.UUID(fieldData["dataTypeID"]) == Fact.objectUUID():
                    logger.error("        Creating sub-instance")
                    ofKindObject = UniqueObject(fieldData["ofKindID"])
                    ofKindObject.createInstance(self, elementID, -1, v["cells"], transactionState)
                else:
                    raise TypeError("Unrecognized type of data to save")
                i += 1
            return ids
    
    # Add the specified data as a field to self during the process of instantiating
    # self.            
    def addData(self, fieldObject, data, transactionState):        
        fieldData = fieldObject.getFieldData()
        if fieldData:
            nameObject = UniqueObject(fieldData["nameID"])
            self._addElementData(data, fieldData, nameObject, transactionState)

    def createInstance(self, containerObject, elementID, index, propertyList, transactionState):
        logger = logging.getLogger(__name__)
        item = self.createEmptyInstance(transactionState)
    
        if containerObject:
            logger.error("createInstance containerObject: %s" % str(containerObject))
            logger.error("createInstance elementID: %s" % elementID)
            logger.error("createInstance index: %s" % index)
            
            if index < 0:
                maxIndex = containerObject.getMaxElementIndex(elementID)
                if maxIndex == None:
                    index = 0
                else:
                    index = maxIndex + 1
            logger.error("createInstance next index: %s" % index)
            newIndex = containerObject.updateElementIndexes(elementID, index, transactionState)
            newValue = containerObject.addValue(elementID, item.id.hex, newIndex, transactionState)
            logger.error("  newValue: %s" % str(newValue.id))
        else:
            newValue = None
    
        logger.error("  PropertyList: %s" % str(propertyList))
        for f in propertyList:
            fieldData = f['field']
            fieldID = fieldData['id']
            fieldObject = UniqueObject(fieldID)
            item.addData(fieldObject, f['data'], transactionState)
            
        return (item, newValue)
                    
    # Marks all of the facts that match the specified property as deleted.   
    def deleteEnumerationProperty(self, propertyName=None, propertyUUID=None, valueName=None, valueUUID=None, transactionState=None):
        if propertyUUID is None:
            propertyUUID = Fact.getNamedUUID(propertyName, transactionState)
        if valueUUID is None:
            valueUUID = Fact.getNamedUUID(valueName, transactionState)
        query_set = Fact.objects.filter(subject=self.id.hex, verb=propertyUUID.hex, directObject=valueUUID.hex)
        for f in query_set:
            f.markAsDeleted(transactionState)
        return self
        
