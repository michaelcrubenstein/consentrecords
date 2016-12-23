# python3 reports/02servicecounts.py

# To Delete a service, 
# 	Run this report and ensure that all of the uses of that service are 0.
# 	Ensure the service is not referenced in any of the .js code
# 	Ensure that the service is not referenced in any _pick value path in the database

# To rename a service,
# 	Ensure the service is not referenced in any of the .js code
# 	Ensure that the service is not referenced in any _pick value path in the database

import profile
import getpass
import sys
import django
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Count
from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator
from parse import cssparser
from consentrecords.views import api


from monitor.models import LogRecord

if __name__ == "__main__":
    django.setup()
    
    try:
        services = Instance.objects.filter(typeID=terms['Service'], deleteTransaction__isnull=True)\
        	.order_by('description__text')\
            .distinct()
        sys.stdout.write("Services:\t%s\n" % services.count())
        
        sys.stdout.write("")
        sys.stdout.write("Service\tExperience Tags\tOfferings\tPrompts\n")
        for service in services:
            tags = service.referenceValues.filter(deleteTransaction__isnull=True,instance__typeID=terms['More Experience'])
            offerings = service.referenceValues.filter(deleteTransaction__isnull=True,instance__typeID=terms['Offerings'])
            prompts = service.referenceValues.filter(deleteTransaction__isnull=True,instance__typeID=terms['Experience Prompt'])
            sys.stdout.write("%s\t%s\t%s\t%s\n" % (service.description.text, tags.count(), offerings.count(), prompts.count()))


    except Exception as e:
        sys.stderr.write("%s\n" % traceback.format_exc())