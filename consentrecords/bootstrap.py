from django.db import connection, models
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
import string
from multiprocessing import Lock

from consentrecords.models import Instance, NameList, Terms, TermNames, Value
from consentrecords import instancecreator

_bootstrapName = 'Bootstrap'
    
def _addEnumeratorTranslations(container, enumerationNames, transactionState):
    enumeratorInstance = Terms.enumerator
    
    nameLists = NameList()
    for name in enumerationNames:
        try:
            item = Terms.getTranslationNamedEnumerator(container, name, "en")
        except Value.MultipleObjectsReturned:
            pass
        except Value.DoesNotExist:
            logger = logging.getLogger(__name__)
            logger.error("Adding enumerator translation: %s to container %s" % (name, str(container)))
            item, value1 = instancecreator.create(enumeratorInstance, container, Terms.enumerator, -1, None, nameLists, transactionState)
            item.addTranslationValue(Terms.translation, {"text": name, "languageCode": "en"}, 0, transactionState)

def _addEnumerators(container, enumerationNames, transactionState):
    nameLists = NameList()
    for name in enumerationNames:
        try:
            item = Terms.getNamedEnumerator(container, name)
        except Value.MultipleObjectsReturned:
            pass
        except Value.DoesNotExist:
            logger = logging.getLogger(__name__)
            logger.error("Adding enumerator: %s to container %s" % (name, str(container)))
            item, newValue = instancecreator.create(Terms.enumerator, container, Terms.enumerator, -1, None, nameLists, transactionState)
            item.addStringValue(Terms.name, name, 0, transactionState)

def createConfigurations(container, itemValues, transactionState):
    return instancecreator.createMissingInstances(container, Terms.configuration, Terms.configuration, Terms.name, itemValues, transactionState)
    
def createFields(container, itemValues, transactionState):
    return instancecreator.createMissingInstances(container, Terms.field, Terms.field, Terms.name, itemValues, transactionState)

def createDataTypes(transactionState):
    _addEnumerators(Terms.dataType, [TermNames.object, TermNames.string, TermNames.translation, TermNames.datestamp, TermNames.number, TermNames.datestampDayOptional, TermNames.email], transactionState)
    # TermNames.time, TermNames.url, TermNames.telephone
    
def createAddObjectRules(transactionState):
    _addEnumerators(Terms.addObjectRule, [TermNames.pickObjectRule, TermNames.createObjectRule], transactionState)
    
def createMaxCapacities(transactionState):
    _addEnumerators(Terms.maxCapacity, [TermNames.uniqueValue, TermNames.multipleValues], transactionState)
    
def createDescriptorTypes(transactionState):
    _addEnumerators(Terms.descriptorType, [TermNames.textEnum, TermNames.countEnum], transactionState)
    
def createBooleans(transactionState):
    _addEnumeratorTranslations(Terms.boolean, [TermNames.yes, TermNames.no], transactionState)

def createDefaultAccesses(transactionState):
    _addEnumerators(Terms.defaultAccess, [TermNames.custom], transactionState)
    
def createSpecialAccesses(transactionState):
    _addEnumerators(Terms.specialAccess, [TermNames.custom], transactionState)
    
def createEnumeratorConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(Terms.enumerator, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(Terms.name, _bootstrapName, 0, transactionState)

    fieldValues = [Terms.name, Terms.translation]
    
    fields = createFields(configObject, fieldValues, transactionState)
    p = fields[Terms.name]
    p.createMissingSubValue(Terms.dataType, Terms.stringEnum, 0, transactionState)
    p.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(Terms.descriptorType, Terms.textEnum, 0, transactionState)

    p = fields[Terms.translation]
    p.createMissingSubValue(Terms.dataType, Terms.translationEnum, 0, transactionState)
    p.createMissingSubValue(Terms.addObjectRule, Terms.createObjectRuleEnum, 0, transactionState)
    p.createMissingSubValue(Terms.descriptorType, Terms.textEnum, 0, transactionState)

def createBooleanConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(Terms.boolean, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(Terms.name, _bootstrapName, 0, transactionState)

    fieldValues = [Terms.name]
    
    fields = createFields(configObject, fieldValues, transactionState)

    p = fields[Terms.name]
    p.createMissingSubValue(Terms.dataType, Terms.translationEnum, 0, transactionState)
    p.createMissingSubValue(Terms.descriptorType, Terms.textEnum, 0, transactionState)

# Create the configuration for the uuname uuname.
def createUUNameConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(Terms.uuName, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(Terms.name, _bootstrapName, 0, transactionState)

    fieldValues = [Terms.uuName, Terms.configuration, Terms.enumerator, Terms.defaultAccess]

    fields = createFields(configObject, fieldValues, transactionState)
    
    p = fields[Terms.uuName]
    p.createMissingSubValue(Terms.dataType, Terms.stringEnum, 0, transactionState)
    p.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(Terms.descriptorType, Terms.textEnum, 0, transactionState)
    
    p = fields[Terms.configuration]
    p.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(Terms.ofKind, Terms.configuration, 0, transactionState)
    p.createMissingSubValue(Terms.addObjectRule, Terms.createObjectRuleEnum, 0, transactionState)
        
    p = fields[Terms.enumerator]
    p.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(Terms.ofKind, Terms.enumerator, 0, transactionState)
    p.createMissingSubValue(Terms.addObjectRule, Terms.createObjectRuleEnum, 0, transactionState)
        
    p = fields[Terms.defaultAccess]
    p.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(Terms.ofKind, Terms.enumerator, 0, transactionState)
    p.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (TermNames.uuName, TermNames.uuName, TermNames.defaultAccess, TermNames.enumerator)
    p.createMissingSubValue(Terms.pickObjectPath, pickObjectPath, 0, transactionState)
        
# Create the configuration for the configuration uuname.    
def createConfigurationConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(Terms.configuration, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
            
    configObject.createMissingSubValue(Terms.name, _bootstrapName, 0, transactionState)
    
    fieldValues = [Terms.name, Terms.field]

    fields = createFields(configObject, fieldValues, transactionState)
    
    p = fields[Terms.name]
    p.createMissingSubValue(Terms.dataType, Terms.stringEnum, 0, transactionState)
    p.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    p.createMissingSubValue(Terms.descriptorType, Terms.textEnum, 0, transactionState)
    
    p = fields[Terms.field]
    p.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(Terms.ofKind, Terms.field, 0, transactionState)
    p.createMissingSubValue(Terms.addObjectRule, Terms.createObjectRuleEnum, 0, transactionState)
    
# Create the configuration for the configuration uuname.    
def createFieldConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(Terms.field, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(Terms.name, _bootstrapName, 0, transactionState)
    
    fieldValues = [Terms.name, 
                   Terms.dataType,
                   Terms.maxCapacity,
                   Terms.descriptorType,
                   Terms.addObjectRule,
                   Terms.ofKind,
                   Terms.pickObjectPath,
                  ]

    fields = createFields(configObject, fieldValues, transactionState)
    
    f = fields[Terms.name]
    f.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    f.createMissingSubValue(Terms.ofKind, Terms.uuName, 0, transactionState)
    f.createMissingSubValue(Terms.descriptorType, Terms.textEnum, 0, transactionState)
    
    f = fields[Terms.dataType]
    f.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (TermNames.uuName, TermNames.uuName, TermNames.dataType, TermNames.enumerator)
    f.createMissingSubValue(Terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[Terms.maxCapacity]
    f.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (TermNames.uuName, TermNames.uuName, TermNames.maxCapacity, TermNames.enumerator)
    f.createMissingSubValue(Terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[Terms.descriptorType]
    f.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (TermNames.uuName, TermNames.uuName, TermNames.descriptorType, TermNames.enumerator)
    f.createMissingSubValue(Terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[Terms.addObjectRule]
    f.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = '%s[%s="%s"]>"%s"' % (TermNames.uuName, TermNames.uuName, TermNames.addObjectRule, TermNames.enumerator)
    f.createMissingSubValue(Terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[Terms.ofKind]
    f.createMissingSubValue(Terms.dataType, Terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(Terms.ofKind, Terms.uuName, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)        
    f.createMissingSubValue(Terms.addObjectRule, Terms.pickObjectRuleEnum, 0, transactionState)

    f = fields[Terms.pickObjectPath]
    f.createMissingSubValue(Terms.dataType, Terms.stringEnum, 0, transactionState)
    f.createMissingSubValue(Terms.maxCapacity, Terms.uniqueValueEnum, 0, transactionState)
    
def initializeFacts(transactionState):
    # Initialize global variables.
    Terms.initialize(transactionState)
    
    createDataTypes(transactionState)
    createAddObjectRules(transactionState)
    createMaxCapacities(transactionState)
    createDescriptorTypes(transactionState)
    createBooleans(transactionState)
    createDefaultAccesses(transactionState)
    createSpecialAccesses(transactionState)
    createEnumeratorConfiguration(transactionState)
    createBooleanConfiguration(transactionState)
    createUUNameConfiguration(transactionState)
    createConfigurationConfiguration(transactionState)
    createFieldConfiguration(transactionState)
            
