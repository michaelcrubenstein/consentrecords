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
from django.db.models import Count, Min
from django.contrib.auth import authenticate
from django.core.mail import send_mail

from consentrecords.models import *

try:
    # With no arguments, set start and end to the previous ten minute window.
    try:
        start = dateutil.parser.parse(sys.argv[sys.argv.index('-start') + 1])
    except ValueError:
        start = datetime.datetime.now()
        start -= datetime.timedelta(minutes=(start.minute % 10) + 10, seconds=start.second, microseconds=start.microsecond)

    try:
        end = dateutil.parser.parse(sys.argv[sys.argv.index('-end') + 1])
    except ValueError:
        end = start + datetime.timedelta(minutes=10)
    
    # Make a list of all users who have at least two experiences.
    # annotate with minimum date
    
    experiencesUsers = User.objects.filter(deleteTransaction__isnull=True)\
        .annotate(min_experience_date=Min('paths__experiences__transaction__creation_time'))\
        .filter(min_experience_date__isnull=False)
    
    # Make a list of all users who have a usergrant
    # annotate with minimum date
    
    grantingUsers = User.objects.filter(deleteTransaction__isnull=True)\
        .annotate(prize_date=Min('userGrants__transaction__creation_time'))\
        .filter(prize_date__isnull=False)
    
    # Users that have at least two experiences and have shared at least once.
    # Either the second of the two experiences must fall after the start date or
    # the first usergrant must fall after the start date.
    
    # Filter the list of users with experiences by the list of users with a UserGrant
    # filter that list by users that have an experience whose creation date is greater than minimum
    # date and greater than start date.
    
    # Exclude users whose second experience was before this day.
    pastExperiencesUsers = \
        experiencesUsers.filter(paths__experiences__transaction__creation_time__gt=F('min_experience_date'),
                 paths__experiences__transaction__creation_time__lt=start)
    
    u1 = experiencesUsers.exclude(pk__in=pastExperiencesUsers)\
        .filter(pk__in=grantingUsers,
                paths__experiences__transaction__creation_time__gt=F('min_experience_date'),
                paths__experiences__transaction__creation_time__range=[start, end])\
        .annotate(prize_date=Min('paths__experiences__transaction__creation_time'))\
        .distinct()
    
    # Filter the list of users with usergrants by the list of users with at least two experiences
    # Filter that list by users whose minimum date >= start date.
    u2=grantingUsers.filter(pk__in=pastExperiencesUsers,
        prize_date__range=[start,end]).distinct()
    
    text = ""
    for u in u1:
        text += "%s\t%s\t%s\t%s\n" % \
            ('u1', u.prize_date, u.id, u.emails.filter(deleteTransaction__isnull=True)[0].text)
    for u in u2:
        text += "%s\t%s\t%s\t%s\n" % \
            ('u2', u.prize_date, u.id, u.emails.filter(deleteTransaction__isnull=True)[0].text)
    
    if text:   
        send_mail('Prize Winners from %s to %s' % (str(start), str(end)),
            text, settings.PASSWORD_RESET_SENDER,
            ['info@pathadvisor.com'], fail_silently=False)
    
except Exception as e:
    print("%s" % traceback.format_exc())
