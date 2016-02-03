# python3 data/01loadorganizations.py 'data/OrganizationNames.txt' michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo, AccessRecord, NameList
from consentrecords import pathparser
from consentrecords import instancecreator

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        orgTerm = Terms.getNamedInstance('Organization')
        nameTerm = Terms.getNamedInstance('_name')
        nameList = NameList()
        with open(sys.argv[1], 'r') as f:
            for s in f:
                orgName = s.strip()
                instances = Instance.objects.filter(deleteTransaction__isnull=True,
                                        typeID=orgTerm,
                                        value__deleteTransaction__isnull=True,
                                        value__field=nameTerm,
                                        value__stringValue__iexact=orgName);
                if len(instances):
                    item = instances[0]
                    print("%s: %s" % (orgName, item.id))
                else:
                    instances = Instance.objects.filter(deleteTransaction__isnull=True,
                                            typeID=orgTerm,
                                            value__deleteTransaction__isnull=True,
                                            value__field=nameTerm,
                                            value__stringValue__istartswith=orgName);
                    if len(instances):
                        item = instances[0]
                        value = item.value_set.filter(field=nameTerm, stringValue__istartswith=orgName, deleteTransaction__isnull=True)
                        print ("? %s: %s: %s" % (orgName, value[0].stringValue, item.id))
                    else:
                        propertyList = {'_name': [{'text': orgName, 'languageCode': 'en'}]}
                        item, newValue = instancecreator.create(orgTerm, None, None, -1, propertyList, nameList, transactionState)
                        print("+ %s: %s" % (orgName, item.id))

