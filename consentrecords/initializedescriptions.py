import datetime
import django
import tzlocal
import getpass

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import Instance, NameList,Terms

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)
    
    Terms.initialize()

    with transaction.atomic():
        print ("all instance count: %s" % str(Instance.objects.all().count()))
        print ("current instance count: %s" % str(Instance.objects.filter(deletedinstance__isnull=True).count()))
        nameList = NameList()
        for i in Instance.objects.filter(deletedinstance__isnull=True):
            i.cacheDescription(nameList)
        print ("Done")
