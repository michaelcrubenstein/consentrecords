from django.db import connection, models
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
import string
from multiprocessing import Lock

from consentrecords.models import *
from consentrecords import instancecreator

_bootstrapName = 'Bootstrap'
    
def _addEnumeratorTranslations(container, enumerationNames, transactionState):
    enumeratorInstance = terms.enumerator
    
    nameLists = NameList()
    for name in enumerationNames:
        try:
            item = Terms.getTranslationNamedEnumerator(container, name, "en")
        except Value.MultipleObjectsReturned:
            pass
        except Value.DoesNotExist:
            logger = logging.getLogger(__name__)
            logger.error("Adding enumerator translation: %s to container %s" % (name, str(container)))
            item, value1 = instancecreator.create(enumeratorInstance, container, terms.enumerator, -1, None, nameLists, transactionState)
            item.addTranslationValue(terms.translation, {"text": name, "languageCode": "en"}, 0, transactionState)

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
            item, newValue = instancecreator.create(terms.enumerator, container, terms.enumerator, -1, None, nameLists, transactionState)
            item.addStringValue(terms.name, name, 0, transactionState)
            item.cacheDescription(nameLists)

def createConfigurations(container, itemValues, transactionState):
    return instancecreator.createMissingInstances(container, terms.configuration, terms.configuration, terms.name, itemValues, transactionState)
    
def createFields(container, itemValues, transactionState):
    return instancecreator.createMissingInstances(container, terms.field, terms.field, terms.name, itemValues, transactionState)

def createDataTypes(transactionState):
    _addEnumerators(terms.dataType, [TermNames.objectEnum, TermNames.stringEnum, TermNames.translationEnum, TermNames.datestamp, TermNames.number, TermNames.datestampDayOptional, TermNames.email], transactionState)
    # TermNames.time, TermNames.url, TermNames.telephone
    
def createAddObjectRules(transactionState):
    _addEnumerators(terms.addObjectRule, [TermNames.pickObjectRule, TermNames.createObjectRule], transactionState)
    
def createMaxCapacities(transactionState):
    _addEnumerators(terms.maxCapacity, [TermNames.uniqueValueEnum, TermNames.multipleValuesEnum], transactionState)
    
def createDescriptorTypes(transactionState):
    _addEnumerators(terms.descriptorType, [TermNames.textEnum, TermNames.firstTextEnum, TermNames.countEnum], transactionState)
    
def createBooleans(transactionState):
    _addEnumeratorTranslations(terms.boolean, [TermNames.yes, TermNames.no], transactionState)

def createDefaultAccesses(transactionState):
    _addEnumerators(terms.defaultAccess, [TermNames.custom], transactionState)
    
def createSpecialAccesses(transactionState):
    _addEnumerators(terms.specialAccess, [TermNames.custom], transactionState)
    
def createPrivileges(transactionState):
    _addEnumerators(terms.privilege, 
                    [TermNames.findPrivilege, 
                     TermNames.readPrivilege, 
                     TermNames.registerPrivilege, 
                     TermNames.writePrivilege, 
                     TermNames.administerPrivilege], 
                    transactionState)
    
def createEnumeratorConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(terms.enumerator, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(terms.name, _bootstrapName, 0, transactionState)

    fieldValues = [terms.name, terms.translation]
    
    fields = createFields(configObject, fieldValues, transactionState)
    p = fields[terms.name]
    p.createMissingSubValue(terms.dataType, terms.stringEnum, 0, transactionState)
    p.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(terms.descriptorType, terms.textEnum, 0, transactionState)

    p = fields[terms.translation]
    p.createMissingSubValue(terms.dataType, terms.translationEnum, 0, transactionState)
    p.createMissingSubValue(terms.addObjectRule, terms.createObjectRuleEnum, 0, transactionState)
    p.createMissingSubValue(terms.descriptorType, terms.textEnum, 0, transactionState)

def createBooleanConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(terms.boolean, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(terms.name, _bootstrapName, 0, transactionState)

    fieldValues = [terms.name]
    
    fields = createFields(configObject, fieldValues, transactionState)

    p = fields[terms.name]
    p.createMissingSubValue(terms.dataType, terms.translationEnum, 0, transactionState)
    p.createMissingSubValue(terms.descriptorType, terms.textEnum, 0, transactionState)

# Create the configuration for the term term.
def createUUNameConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(terms.term, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(terms.name, _bootstrapName, 0, transactionState)

    fieldValues = [terms.name, terms.configuration, terms.enumerator, terms.defaultAccess]

    fields = createFields(configObject, fieldValues, transactionState)
    
    p = fields[terms.name]
    p.createMissingSubValue(terms.dataType, terms.stringEnum, 0, transactionState)
    p.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(terms.descriptorType, terms.textEnum, 0, transactionState)
    
    p = fields[terms.configuration]
    p.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(terms.ofKind, terms.configuration, 0, transactionState)
    p.createMissingSubValue(terms.addObjectRule, terms.createObjectRuleEnum, 0, transactionState)
        
    p = fields[terms.enumerator]
    p.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(terms.ofKind, terms.enumerator, 0, transactionState)
    p.createMissingSubValue(terms.addObjectRule, terms.createObjectRuleEnum, 0, transactionState)
        
    p = fields[terms.defaultAccess]
    p.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(terms.ofKind, terms.enumerator, 0, transactionState)
    p.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = enumeratorPath(TermNames.defaultAccess)
    p.createMissingSubValue(terms.pickObjectPath, pickObjectPath, 0, transactionState)
        
# Create the configuration for the configuration term.    
def createConfigurationConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(terms.configuration, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
            
    configObject.createMissingSubValue(terms.name, _bootstrapName, 0, transactionState)
    
    fieldValues = [terms.name, terms.field]

    fields = createFields(configObject, fieldValues, transactionState)
    
    p = fields[terms.name]
    p.createMissingSubValue(terms.dataType, terms.stringEnum, 0, transactionState)
    p.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    p.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    p.createMissingSubValue(terms.descriptorType, terms.textEnum, 0, transactionState)
    
    p = fields[terms.field]
    p.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    p.createMissingSubValue(terms.ofKind, terms.field, 0, transactionState)
    p.createMissingSubValue(terms.addObjectRule, terms.createObjectRuleEnum, 0, transactionState)

def quoteAsNeeded(s):
	return '"%s"' % s if s.find(' ') >= 0 else s
	
def enumeratorPath(term):
    return '%s[%s=%s]>%s' % (TermNames.term, TermNames.name, quoteAsNeeded(term), quoteAsNeeded(TermNames.enumerator))

# Create the configuration for the configuration term.    
def createFieldConfiguration(transactionState):
    configurationValues = [_bootstrapName];
    configurations = createConfigurations(terms.field, configurationValues, transactionState)
    configObject = configurations[_bootstrapName]
    
    configObject.createMissingSubValue(terms.name, _bootstrapName, 0, transactionState)
    
    fieldValues = [terms.name, 
                   terms.dataType,
                   terms.maxCapacity,
                   terms.descriptorType,
                   terms.addObjectRule,
                   terms.ofKind,
                   terms.pickObjectPath,
                  ]

    fields = createFields(configObject, fieldValues, transactionState)
    
    f = fields[terms.name]
    f.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    f.createMissingSubValue(terms.ofKind, terms.term, 0, transactionState)
    f.createMissingSubValue(terms.descriptorType, terms.textEnum, 0, transactionState)
    
    f = fields[terms.dataType]
    f.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = enumeratorPath(TermNames.dataType)
    f.createMissingSubValue(terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[terms.maxCapacity]
    f.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = enumeratorPath(TermNames.maxCapacity)
    f.createMissingSubValue(terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[terms.descriptorType]
    f.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = enumeratorPath(TermNames.descriptorType)
    f.createMissingSubValue(terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[terms.addObjectRule]
    f.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    f.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)
    pickObjectPath = enumeratorPath(TermNames.addObjectRule)
    f.createMissingSubValue(terms.pickObjectPath, pickObjectPath, 0, transactionState)
    
    f = fields[terms.ofKind]
    f.createMissingSubValue(terms.dataType, terms.objectEnum, 0, transactionState)
    f.createMissingSubValue(terms.ofKind, terms.term, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)        
    f.createMissingSubValue(terms.addObjectRule, terms.pickObjectRuleEnum, 0, transactionState)

    f = fields[terms.pickObjectPath]
    f.createMissingSubValue(terms.dataType, terms.stringEnum, 0, transactionState)
    f.createMissingSubValue(terms.maxCapacity, terms.uniqueValueEnum, 0, transactionState)
    
def initializeFacts(transactionState):
    # Initialize global variables.
    terms.initialize(transactionState)
    
    createDataTypes(transactionState)
    createAddObjectRules(transactionState)
    createMaxCapacities(transactionState)
    createDescriptorTypes(transactionState)
    createBooleans(transactionState)
    createDefaultAccesses(transactionState)
    createSpecialAccesses(transactionState)
    createPrivileges(transactionState)
    createEnumeratorConfiguration(transactionState)
    createBooleanConfiguration(transactionState)
    createUUNameConfiguration(transactionState)
    createConfigurationConfiguration(transactionState)
    createFieldConfiguration(transactionState)
            
