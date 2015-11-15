import datetime
import django
import tzlocal
import getpass

from django.conf import settings
from django.db import transaction, connection
from django.contrib.auth import authenticate

from custom_user import views as userviews
from consentrecords.models import TransactionState, Fact, LazyInstance, LazyValue, NameList
from consentrecords import instancecreator
from consentrecords import pathparser
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
