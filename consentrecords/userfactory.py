from django.db import transaction

import logging
import uuid

from consentrecords.models import *
from consentrecords import instancecreator

class UserFactory:
    def createUserInstance(context, propertyList):
        with transaction.atomic():

            if not propertyList: propertyList = {}
            propertyList['email'] = context.authUser.email
            if context.authUser.first_name:
                propertyList['first name'] = context.authUser.first_name
            if context.authUser.last_name:
                propertyList['last name'] = context.authUser.last_name
            item = User.create(propertyList, context)
                        
            return item

