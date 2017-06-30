from django.db import transaction

import logging
import uuid

from consentrecords.models import *
from consentrecords import instancecreator

class UserFactory:
    def createUserInstance(user, propertyList):
        with transaction.atomic():
            context = Context(user)

            if not propertyList: propertyList = {}
            propertyList['email'] = user.email
            if user.first_name:
                propertyList['first name'] = user.first_name
            if user.last_name:
                propertyList['last name'] = user.last_name
            item = User.create(propertyList, context)
                        
            return item

