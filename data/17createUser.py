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
from django.conf import settings

from consentrecords.models import *
from custom_user.models import AuthUser, PasswordReset

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

        email = sys.argv[sys.argv.index('-email') + 1] if '-email' in sys.argv \
        	else input('Email: ')
        firstName = sys.argv[sys.argv.index('-first') + 1] if '-first' in sys.argv \
        	else input('First Name: ')
        lastName = sys.argv[sys.argv.index('-last') + 1] if '-last' in sys.argv \
        	else input('Last Name: ')
        hostURL = sys.argv[sys.argv.index('-host') + 1] if '-host' in sys.argv \
        	else 'http://127.0.0.1:8000'
        
        expiration = datetime.datetime.now() + datetime.timedelta(days=7)

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
            reset = PasswordReset.objects.create(email=email,expiration=expiration)
            
            print(email + '\t' + hostURL + settings.PASSWORD_RESET_PATH + reset.id.hex + '/')
            print("To reverse: ");
            print("python3")
            print("import django; django.setup()")
            print("from consentrecords.models import *")
            print("from custom_user.models import AuthUser, PasswordReset")
            print("Transaction.objects.filter(pk='%s').delete()" % context.transaction.id.hex)
            print("AuthUser.objects.filter(email='%s').delete()" % email)
            print("PasswordReset.objects.filter(email='%s').delete()" % email)
            
    except Exception as e:
        print("%s" % traceback.format_exc())
