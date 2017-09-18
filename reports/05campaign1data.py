# A script for listing the users created between a specified start date and end date.
# The -all option including users created for testing (.pathadvisor.com and .consentrecords.org)
#
# python3 data/10listusers.py -start 2016-05-08 -end 2016-05-08
# python3 data/10listusers.py -start 2016-05-08 -end 2016-05-08 -all

import datetime
import django; django.setup()
import tzlocal
import getpass
import sys
import csv
import traceback
import dateutil.parser

from django.db import transaction
from django.db.models import Count
from django.contrib.auth import authenticate
from django.core.mail import send_mail

from consentrecords.models import *
from monitor.models import LogRecord

def taggedArg(key):
    try:
        return sys.argv[sys.argv.index(key) + 1]
    except ValueError:
        return None
    except IndexError:
        return None
    
if __name__ == "__main__":

    try:
        try:
            start = dateutil.parser.parse(sys.argv[sys.argv.index('-start') + 1]).date()
        except ValueError:
            start = datetime.datetime.now().date()
    
        try:
            end = dateutil.parser.parse(sys.argv[sys.argv.index('-end') + 1]).date()
        except ValueError:
            end = datetime.datetime.now().date() + datetime.timedelta(days=1)
        
        userTotal = 0
        experiencedUserTotal = 0
        firstStart = start
        text = ""
        while start < end:
            next = start + datetime.timedelta(days=1)

            users = User.objects.filter(transaction__creation_time__range=[start, next])
            passwordResets = LogRecord.objects.filter(name='setResetPassword',
                creation_time__range=[start, next])
            experiences = Experience.objects.filter((Q(deleteTransaction__isnull=True)|Q(deleteTransaction__creation_time__gte=next)), transaction__creation_time__range=[start, next])
            requests = UserUserGrantRequest.objects.filter(transaction__creation_time__range=[start, next])
            shares = UserGrant.objects.filter(grantor_id__in=User.objects.all(), transaction__creation_time__range=[start, next])
            accepts = UserUserGrantRequest.objects.filter(deleteTransaction__creation_time__range=[start, next],
                deleteTransaction__createdUserGrants__grantee=F('grantee'))
            rejects = UserUserGrantRequest.objects.filter(deleteTransaction__creation_time__range=[start, next],
                deleteTransaction__createdUserGrants__grantee__isnull=True)
                
            userExperiences = Experience.objects.filter((Q(deleteTransaction__isnull=True)|Q(deleteTransaction__creation_time__gte=next))&\
            	Q(parent__parent__transaction__creation_time__range=[firstStart, next])&\
            	Q(transaction__creation_time__range=[firstStart, next]))
            
            userTotal += users.count()
            experiencedUserTotal += users.annotate(experience_count=Count('paths__experiences')).filter(experience_count__gte=1).count()
            
            text += ("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" % 
                (start, users.count(), passwordResets.count(), experiences.count(), 
                 requests.count(), shares.count(), accepts.count(), rejects.count(), 
                 userTotal, experiencedUserTotal, userExperiences.count(), 
                 0 if experiencedUserTotal == 0 else userExperiences.count() / experiencedUserTotal))
            start = next
        
        send_mail('User Data from %s to %s' % (str(firstStart), str(end)),
            text, settings.PASSWORD_RESET_SENDER,
            ['info@pathadvisor.com'], fail_silently=False)
        
    except Exception as e:
        print("%s" % traceback.format_exc())