# python3 maintenance/11migrateBirthdays.py michaelcrubenstein@gmail.com

# Copy birthday objects from the user to the More Experiences.

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import instancecreator
from consentrecords import pathparser

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[1] if len(sys.argv) > 1 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        users = Instance.objects.filter(typeID=terms['_user'], deleteTransaction__isnull=True)

        print ("User Count: %s" % users.count())
        birthdayTerm = terms['Birthday']
        pathTerm = terms['More Experiences']
        nameLists = NameList()
        for i in users:
            print("user: %s"%i.getDescription())
            birthday = i.value_set.get(field=birthdayTerm, deleteTransaction__isnull=True).stringValue[0:7]
            pathFilter = i.value_set.filter(field=pathTerm, deleteTransaction__isnull=True)
            if not pathFilter.exists():
                print("  Add path: %s"%(birthday))
                path, newValue = instancecreator.create(pathTerm, i, pathTerm, 0, 
                    {'Birthday': {'text': birthday}}, nameLists, 
                    TransactionState(i.user, timezoneoffset))
            else:
                path = pathFilter[0].referenceValue
                birthdayFilter = path.value_set.filter(field=birthdayTerm, deleteTransaction__isnull=True)
                if not birthdayFilter.exists():
                    print("  Add birthday: %s"%(birthday))
                    path.addStringValue(birthdayTerm, birthday, 0, 
                                        TransactionState(i.user, timezoneoffset))
