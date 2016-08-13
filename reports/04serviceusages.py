# python3 reports/04serviceusages.py 'Leadership Class'

# To Delete a service, 
#   Run this report and ensure that all of the uses of that service are 0.
#   Ensure the service is not referenced in any of the .js code
#   Ensure that the service is not referenced in any _pick value path in the database

# To rename a service,
#   Ensure the service is not referenced in any of the .js code
#   Ensure that the service is not referenced in any _pick value path in the database

import profile
import getpass
import sys
import django
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Count
from django.db.models import F, Q, Prefetch
from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator
from parse import cssparser
from consentrecords.views import api


from monitor.models import LogRecord

if __name__ == "__main__":
    django.setup()
    
    try:
        iMoreExperience = Instance.objects.filter(typeID=terms['More Experience'],
                   deleteTransaction__isnull=True)
        iMoreExperiences = Instance.objects.filter(typeID=terms['More Experiences'],
                   deleteTransaction__isnull=True)
        qsusers = Instance.objects.filter(typeID=terms['_user'],
                   deleteTransaction__isnull=True)
        moreExperiences = Instance.objects.filter(typeID=terms['More Experience'], deleteTransaction__isnull=True,
                                          value__field=terms['Service'],
                                          value__referenceValue__description__text=sys.argv[1],
                                          value__deleteTransaction__isnull=True)\
                            .prefetch_related(Prefetch('referenceValues__instance',
                                                       queryset=iMoreExperiences,
                                                       to_attr='more_experiences'))\
                            .prefetch_related(Prefetch('referenceValues__instance__referenceValues__instance',
                                                       queryset=qsusers,
                                                       to_attr='user'))
                 
        sys.stdout.write("Service:\t%s\n" % sys.argv[1])
        
        sys.stdout.write("")
        sys.stdout.write("User\tOffering\n")
        for e in moreExperiences:
            sys.stdout.write("%s\t%s\n" % (e.user.description.text, e.description.text))


    except Exception as e:
        sys.stderr.write("%s\n" % traceback.format_exc())