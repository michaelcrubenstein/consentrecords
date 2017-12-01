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

        email = sys.argv[sys.argv.index('-target') + 1] if '-target' in sys.argv \
        	else input('Target: ')
        groupPath = sys.argv[sys.argv.index('-group') + 1] if '-group' in sys.argv \
        	else input('Group Path: ')

        with transaction.atomic():
            context = Context('en', authenticate(username=username, password=password))
            
            user = User.objects.get(emails__text=email, emails__deleteTransaction__isnull=True, deleteTransaction__isnull=True)

            propertyList = {}
            propertyList['grantee'] = groupPath	# organization[name>text=Beacon Academy]/group[name>text=Beacon Academy Staff]
            propertyList['privilege'] = 'read'
            
            userGroupGrant = UserGroupGrant.create(user, propertyList, context)
            
    except Exception as e:
        print("%s" % traceback.format_exc())
