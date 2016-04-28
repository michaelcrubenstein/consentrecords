from django.db import transaction

import logging
import uuid

from consentrecords.models import TransactionState, Terms, TermNames, Instance, Value, NameList
from consentrecords import instancecreator

class UserFactory:
    def createUserInstance(user, propertyList, timezoneOffset):
        with transaction.atomic():
            transactionState = TransactionState(user, timezoneOffset)
            if isinstance(user.id, uuid.UUID):
                userID = user.id.hex    # SQLite
            else:
                userID = user.id        # MySQL

            ofKindObject = terms[TermNames.user]
            if not propertyList: propertyList = {}
            propertyList[TermNames.email] = {"text": user.email}
            if user.first_name:
                propertyList[TermNames.firstName] = {"text": user.first_name}
            if user.last_name:
                propertyList[TermNames.lastName] = {"text": user.last_name}
            item, newValue = instancecreator.create(ofKindObject, None, None, 0, propertyList, NameList(), transactionState)
            
            # Add userID explicitly in case it isn't part of the configuration.
            item.addStringValue(terms[TermNames.userID], userID, 0, transactionState)
            
            return item

