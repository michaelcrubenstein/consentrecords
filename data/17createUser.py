import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import re

django.setup()

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from custom_user.models import AuthUser



if __name__ == "__main__":
    check = '-check' in sys.argv
    
    try:
        try:
            username = sys.argv[sys.argv.index('-user') + 1]
        except ValueError:
            username = input('Administrator Email Address: ')
        except IndexError:
            username = input('Administrator Email Address: ')
        password = getpass.getpass("Password: ")

        email = input('Email: ')
        firstName = input('First Name: ')
        lastName = input('Last Name: ')

        with transaction.atomic():
            context = Context('en', authenticate(username=username, password=password))
            authUser = AuthUser.objects.create_user(email, password=uuid.uuid4().hex, firstName=firstName, lastName=lastName)

            propertyList = {}
            propertyList['emails'] = [{'text': email, 'position': 0}]
            if firstName:
                propertyList['first name'] = firstName
            if lastName:
                propertyList['last name'] = lastName
            user = User.create(propertyList, context)
            path = Path.create(user, {}, context)
            
            print("transaction: %s\n" % context.transaction.id.hex)
            print("To reverse: ");
            print("python3")
            print("import django; django.setup()")
            print("from consentrecords.models import *")
            print("Transaction.objects.filter(pk='%s').delete()" % context.transaction.id.hex)
            print("AuthUser.objects.filter(email='%s').delete()" % email)
            
    except Exception as e:
        print("%s" % traceback.format_exc())
