from django.db import connection, models
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
import string
from multiprocessing import Lock

from consentrecords.models import Fact, LazyInstance, Instance, NameList
from consentrecords import instancecreator

def initializeUUNames():
    Fact.initialUUNames = {}
    
    #Instantiate the uuName uuName.
    uuNameID = Fact.getUUNameID()
    if uuNameID:
        Fact.initialUUNames[Fact.uuNameName] = uuNameID
    else:
        return
        
    # Instantiate all of the other core uuNames.
    for s in Fact.initialKinds:
        try: 
            id = Fact._getInitialUUID(s)
        except Fact.UnrecognizedNameError:
            pass

def _addEnumeratorTranslations(uuNameID, enumerationNames, transactionState):
    container = LazyInstance(uuNameID)
    enumeratorInstance = LazyInstance(Fact.enumeratorUUID())
    translationInstance = LazyInstance(Fact.translationUUID())
    englishUUID = Fact.getNamedEnumeratorID(Fact.languageUUID(), Fact.englishName)
    
    nameLists = NameList()
    for name in enumerationNames:
        try:
            item = LazyInstance(Fact.getTranslationNamedEnumeratorID(uuNameID, name))
        except Fact.UnrecognizedNameError:
            item, value1 = instancecreator.create(enumeratorInstance, container, Fact.enumeratorUUID(), -1, None, nameLists, transactionState)
            item2, value2 = instancecreator.create(translationInstance, item, Fact.translationUUID(), 0, None, nameLists, transactionState)
            item2.addValue(Fact.textUUID().hex, name, 0, transactionState)
            item2.addValue(Fact.languageUUID().hex, englishUUID.hex, 0, transactionState)

def _addEnumerators(uuNameID, enumerationNames, transactionState):
    container = LazyInstance(uuNameID)
    ofKindObject = LazyInstance(Fact.enumeratorUUID())
    
    nameLists = NameList()
    for name in enumerationNames:
        try:
            item = LazyInstance(Fact.getNamedEnumeratorID(uuNameID, name))
        except Fact.UnrecognizedNameError:
            item, newValue = instancecreator.createInstance(ofKindObject, container, Fact.enumeratorUUID(), -1, None, nameLists, transactionState)
            item.addValue(Fact.nameUUID(), name, 0, transactionState)

def createConfigurations(container, itemValues, transactionState):
	return instancecreator.createMissingInstances(container, Fact.configurationUUID(), Fact.configurationUUID(), Fact.nameUUID(), itemValues, transactionState)
	
def createFields(container, itemValues, transactionState):
	return instancecreator.createMissingInstances(container, Fact.fieldUUID(), Fact.fieldUUID(), Fact.nameUUID(), itemValues, transactionState)

def createDataTypes(transactionState):
    _addEnumerators(Fact.dataTypeUUID(), [Fact.objectName, Fact.stringName, Fact.datestampName, Fact.numberName], transactionState)
    
def createAddObjectRules(transactionState):
    _addEnumerators(Fact.addObjectRuleUUID(), [Fact.pickObjectRuleName, Fact.createObjectRuleName], transactionState)
    
def createMaxCapacities(transactionState):
    _addEnumerators(Fact.maxCapacityUUID(), [Fact.uniqueValueName, Fact.multipleValuesName], transactionState)
    
def createDescriptorTypes(transactionState):
    _addEnumerators(Fact.descriptorTypeUUID(), [Fact.textEnumName, Fact.countEnumName], transactionState)
    
def createLanguages(transactionState):
    _addEnumerators(Fact.languageUUID(), [Fact.englishName], transactionState)

def createBooleans(transactionState):
    _addEnumeratorTranslations(Fact.booleanUUID(), [Fact.yesName, Fact.noName], transactionState)

def createTranslationConfiguration(transactionState):
    container = LazyInstance(Fact.translationUUID())
    
    configurationValues = [Fact._bootstrapName];
    configurations = createConfigurations(container, configurationValues, transactionState)
    configObject = configurations[Fact._bootstrapName]
    
    configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

    fieldValues = [Fact.textUUID().hex, Fact.languageUUID().hex]
    
    fields = createFields(configObject, fieldValues, transactionState)
    p = fields[Fact.textUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)

    p = fields[Fact.languageUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.ofKindUUID(), Fact.languageUUID().hex, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.languageName, Fact.enumeratorName)
    p.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)

def createEnumeratorConfiguration(transactionState):
    container = LazyInstance(Fact.enumeratorUUID())
    
    configurationValues = [Fact._bootstrapName];
    configurations = createConfigurations(container, configurationValues, transactionState)
    configObject = configurations[Fact._bootstrapName]
    
    configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

    fieldValues = [Fact.nameUUID().hex, Fact.translationUUID().hex]
    
    fields = createFields(configObject, fieldValues, transactionState)
    p = fields[Fact.nameUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)

    p = fields[Fact.translationUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.ofKindUUID(), Fact.translationUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)

def createBooleanConfiguration(transactionState):
    container = LazyInstance(Fact.booleanUUID())
    
    configurationValues = [Fact._bootstrapName];
    configurations = createConfigurations(container, configurationValues, transactionState)
    configObject = configurations[Fact._bootstrapName]
    
    configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

    fieldValues = [Fact.nameUUID().hex]
    
    fields = createFields(configObject, fieldValues, transactionState)

    p = fields[Fact.nameUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.ofKindUUID(), Fact.translationUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)

# Create the configuration for the uuname uuname.
def createUUNameConfiguration(transactionState):
    uunameUUID = Fact.uuNameUUID()
    container = LazyInstance(uunameUUID)
    
    configurationValues = [Fact._bootstrapName];
    configurations = createConfigurations(container, configurationValues, transactionState)
    configObject = configurations[Fact._bootstrapName]
    
    configurationUUID = Fact.configurationUUID()
        
    configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)

    fieldValues = [uunameUUID.hex, configurationUUID.hex, Fact.enumeratorUUID().hex]

    fields = createFields(configObject, fieldValues, transactionState)
    
    p = fields[uunameUUID.hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)
    
    p = fields[configurationUUID.hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.ofKindUUID(), configurationUUID.hex, 0, transactionState)
    p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
        
    p = fields[Fact.enumeratorUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.ofKindUUID(), Fact.enumeratorUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
        
# Create the configuration for the configuration uuname.    
def createConfigurationConfiguration(transactionState):
    configurationUUID = Fact.configurationUUID()
    container = LazyInstance(configurationUUID)
    
    configurationValues = [Fact._bootstrapName];
    configurations = createConfigurations(container, configurationValues, transactionState)
    configObject = configurations[Fact._bootstrapName]
            
    configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)
    
    fieldValues = [Fact.nameUUID().hex, Fact.fieldUUID().hex]

    fields = createFields(configObject, fieldValues, transactionState)
    
    p = fields[Fact.nameUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)
    
    p = fields[Fact.fieldUUID().hex]
    p.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.ofKindUUID(), Fact.fieldUUID().hex, 0, transactionState)
    p.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.createObjectRuleUUID().hex, 0, transactionState)
    
# Create the configuration for the configuration uuname.    
def createFieldConfiguration(transactionState):
    containerUUID = Fact.fieldUUID()
    container = LazyInstance(containerUUID)
    configurationUUID = Fact.configurationUUID()
    
    configurationValues = [Fact._bootstrapName];
    configurations = createConfigurations(container, configurationValues, transactionState)
    configObject = configurations[Fact._bootstrapName]
    
    configObject.createMissingSubValue(Fact.nameUUID(), Fact._bootstrapName, 0, transactionState)
    
    fieldValues = [Fact.nameUUID().hex, 
                   Fact.dataTypeUUID().hex,
                   Fact.maxCapacityUUID().hex,
                   Fact.descriptorTypeUUID().hex,
                   Fact.addObjectRuleUUID().hex,
                   Fact.ofKindUUID().hex,
                   Fact.pickObjectPathUUID().hex,
                  ]

    fields = createFields(configObject, fieldValues, transactionState)
    
    f = fields[Fact.nameUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.descriptorTypeUUID(), Fact.textEnumUUID().hex, 0, transactionState)
    
    f = fields[Fact.dataTypeUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.dataTypeName, Fact.enumeratorName)
    f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
    
    f = fields[Fact.maxCapacityUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.maxCapacityName, Fact.enumeratorName)
    f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
    
    f = fields[Fact.descriptorTypeUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.descriptorTypeName, Fact.enumeratorName)
    f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
    
    f = fields[Fact.addObjectRuleUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (Fact.uuNameName, Fact.uuNameName, Fact.addObjectRuleName, Fact.enumeratorName)
    f.createMissingSubValue(Fact.pickObjectPathUUID(), pickObjectPath, 0, transactionState)
    
    f = fields[Fact.ofKindUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.objectUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.ofKindUUID(), Fact.uuNameUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)        
    f.createMissingSubValue(Fact.addObjectRuleUUID(), Fact.pickObjectRuleUUID().hex, 0, transactionState)

    f = fields[Fact.pickObjectPathUUID().hex]
    f.createMissingSubValue(Fact.dataTypeUUID(), Fact.stringUUID().hex, 0, transactionState)
    f.createMissingSubValue(Fact.maxCapacityUUID(), Fact.uniqueValueUUID().hex, 0, transactionState)
    
def initializeFacts(transactionState):
    # Initialize global variables.
    Fact.initialUUNames = {}  
    
    #Instantiate the uuName uuName.
    uunameID = Fact.getUUNameID() or Fact.createUUNameID(transactionState)
    
    # Instantiate all of the other core uuNames.
    for s in Fact.initialKinds:
        try: 
            id = Fact.getNamedUUID(s)
        except Fact.UnrecognizedNameError:
            obj = uuid.uuid4()
            i = Instance.objects.create(id=obj.hex, typeID=uunameID.hex, parent=None, transaction=transactionState.transaction)
            LazyInstance(obj).addValue(uunameID, s, 0, transactionState)
    
    createDataTypes(transactionState)
    createAddObjectRules(transactionState)
    createMaxCapacities(transactionState)
    createDescriptorTypes(transactionState)
    createLanguages(transactionState)
    createBooleans(transactionState)
    createTranslationConfiguration(transactionState)
    createEnumeratorConfiguration(transactionState)
    createBooleanConfiguration(transactionState)
    createUUNameConfiguration(transactionState)
    createConfigurationConfiguration(transactionState)
    createFieldConfiguration(transactionState)
            
