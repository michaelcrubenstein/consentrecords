import datetime
import django
import tzlocal
import getpass

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState
from consentrecords import bootstrap

if __name__ == "__main__":
	django.setup()

	timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
	username = input('Email Address: ')
	password = getpass.getpass("Password: ")

	user = authenticate(username=username, password=password)

	with transaction.atomic():
		transactionState = TransactionState(user, timezoneoffset)  
		bootstrap.initializeFacts(transactionState) 
