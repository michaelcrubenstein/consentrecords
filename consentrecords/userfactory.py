from django.db import transaction

import logging
import uuid

from consentrecords.models import *
from consentrecords import instancecreator

class UserFactory:
    def createUserInstance(user, propertyList):
        with transaction.atomic():
            transactionState = TransactionState(user)
            userInfo = UserInfo(user)

            ofKindObject = terms.user
            if not propertyList: propertyList = {}
            propertyList[TermNames.email] = {"text": user.email}
            if user.first_name:
                propertyList[TermNames.firstName] = {"text": user.first_name}
            if user.last_name:
                propertyList[TermNames.lastName] = {"text": user.last_name}
            item, newValue = instancecreator.create(ofKindObject, None, None, 0, propertyList, NameList(), userInfo, transactionState)
                        
            return item

