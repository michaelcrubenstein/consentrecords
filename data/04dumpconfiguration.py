# python3 data/04dumpconfiguration.py 'data/termsdump.txt' michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import sys
import csv

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo, AccessRecord, NameList
from consentrecords import pathparser
from consentrecords import instancecreator

def writeinstance(i, indent, fieldDataDictionary, fOut):
	fOut.write('%s%s\n' % (' ' * indent, i.typeID.getDescription()))
	print('%s%s\n' % (' ' * indent, i.typeID.getDescription()))
	fieldsData = i.typeID.getFieldsData(fieldDataDictionary)

	for fd in fieldsData:
		values = i.value_set.filter(field__id=fd['nameID'], deleteTransaction__isnull=True)\
							.order_by('position')
		if fd['dataType'] == '_object':
			if 'objectAddRule' in fd and fd['objectAddRule'] == '_pick one':
				for v in values:
					fOut.write('%s%s: %s\n' % (' ' * (indent + 4), fd['name'], v.referenceValue.getDescription()))
			else:
				for v in values:
					writeinstance(v.referenceValue, indent+4, fieldDataDictionary, fOut)
		elif fd['dataType'] == '_translation':
			for v in values:
				fOut.write('%s%s: %s - %s\n' % (' ' * (indent + 4), fd['name'], v.languageCode if v.languageCode else '--', v.stringValue))
		else:
			for v in values:
				fOut.write('%s%s: %s\n' % (' ' * (indent + 4), fd['name'], v.stringValue))
			

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = sys.argv[2] if len(sys.argv) > 2 else input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        userInfo = UserInfo(user)
        fieldDataDictionary = {}
        
        path = statePath='_uuname'
        terms = pathparser.selectAllObjects(path, userInfo=userInfo,securityFilter=userInfo.findFilter)\
                          .select_related('typeID')\
                          .select_related('description')\
                          .order_by('description__text', 'id')

        with open(sys.argv[1], 'w') as fOut:
            for term in terms:
            	writeinstance(term, 0, fieldDataDictionary, fOut)
