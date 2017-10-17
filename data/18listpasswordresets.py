# A script for listing the all of the activate passwordresets
#
# python3 data/18listpasswordresets.py
#
# To send emails:
# python3 data/18listpasswordresets.py -send -host 'https://www.pathadvisor.com/' -template campaign01 -title 'Your PathAdvisor Path'
# python3 data/18listpasswordresets.py -after '2017-10-08 01:07:00' -send -host 'https://www.pathadvisor.com/' -template campaign01 -title 'Your PathAdvisor Path'

import datetime
import django; django.setup()
import tzlocal
import getpass
import sys
import csv
import traceback
import dateutil.parser

from django.db import transaction
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.template import loader

from consentrecords.models import *
from custom_user.models import *

if __name__ == "__main__":

    try:
        if '-after' in sys.argv:
            expiration = dateutil.parser.parse(sys.argv[sys.argv.index('-after') + 1])
        else:
            expiration = datetime.datetime.now()
            
        prs = PasswordReset.objects.filter(expiration__gte=expiration).order_by('expiration')
        
        if '-send' in sys.argv:
            hostURL = sys.argv[sys.argv.index('-host') + 1]
        
        for pr in prs:
            u = User.objects.get(emails__text=pr.email)
            if u.firstName:
                salutation = u.firstName
            else:
                salutation = 'Friend'
            if '-send' in sys.argv:
                hostURL = sys.argv[sys.argv.index('-host') + 1]
                title = sys.argv[sys.argv.index('-title') + 1]
                context = {'resetKey': pr.id.hex,
                           'hostURL': hostURL,
                           'salutation': salutation,
                          }
                templateName = sys.argv[sys.argv.index('-template') + 1]
                htmlTemplate = loader.get_template('email/%s.html' % templateName)
                txtTemplate = loader.get_template('email/%s.txt' % templateName)
                htmlMessage = htmlTemplate.render(context)
                txtMessage = txtTemplate.render(context)

                confirm = input(pr.email + ' [Y/n]:')
                if confirm == '' or confirm[0] == 'y' or confirm[0] == 'Y':
                    send_mail(title, txtMessage, settings.PASSWORD_RESET_SENDER,
                        [pr.email], fail_silently=False, html_message=htmlMessage)
            else:
                print(pr.id.hex, pr.email, salutation, pr.expiration)

    except Exception as e:
        print("%s" % traceback.format_exc())