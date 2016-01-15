# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo
from consentrecords import pathparser

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[1] if len(sys.argv) > 1 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)

        f = Instance.objects.filter(typeID=Terms.getNamedInstance('Inquiry'), deleteTransaction__isnull=True,
                                    value__fieldID=Terms.email,
                                    value__deleteTransaction__isnull=True)

        print ("Inquiry Count: %s" % f.count())
        userInfo = UserInfo(user)
        for inquiry in f:
            email = inquiry.value_set.get(fieldID=Terms.email,
                                        deleteTransaction__isnull=True)
            email.markAsDeleted(transactionState)
            path = '_user[_email="%s"]' % email.stringValue
            print("email: %s" % email.stringValue)
            l = pathparser.selectAllObjects(path, userInfo=userInfo, securityFilter=userInfo.findFilter)
            if len(l):
                inquiries = inquiry.parent
                if inquiries:
                    print("l: %s" % str(l))
                    transactionState = TransactionState(l[0].user, timezoneoffset)
                    inquiries.addReferenceValue(Terms.user, l[0], 0, transactionState)
                    print("update inquiry for session %s: user %s" % (inquiry.parent.parent, l[0]))
                    inquiry.markAsDeleted(transactionState)
                else:
                    print("no parent for %s" % str(inquiry))
                     
