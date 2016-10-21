# python3 data/04dumpconfiguration.py -path _term -q > data/terms.txt 
# python3 data/04dumpconfiguration.py -path '"Service Domain"' -q > data/servicedomains.txt 
# python3 data/04dumpconfiguration.py -path Domain -q > data/domains.txt 
# python3 data/04dumpconfiguration.py -path Stage -q > data/stages.txt 
# python3 data/04dumpconfiguration.py -path Service -q > data/services.txt 
# python3 data/04dumpconfiguration.py -path '"Experience Prompt"' -q > data/experienceprompts.txt 

import datetime
import django
import tzlocal
import getpass
import sys
import csv
import traceback

from django.db import transaction
from django.contrib.auth import authenticate
from django.contrib.auth.models import AnonymousUser

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

def writeinstance(i, indent, fieldsDataDictionary):
    sys.stdout.write('%s%s\n' % (' ' * indent, i.typeID.getDescription()))
    sys.stderr.write('%s%s\n' % (' ' * indent, i.typeID.getDescription()))
    fieldsData = fieldsDataDictionary[i.typeID]

    for fd in fieldsData:
        values = i.value_set.filter(field__id=fd['nameID'], deleteTransaction__isnull=True)\
                            .order_by('position')
        if fd['dataType'] == '_object':
            if 'objectAddRule' in fd and fd['objectAddRule'] == '_pick one':
                for v in values:
                    sys.stdout.write('%s%s: %s\n' % (' ' * (indent + 4), fd['name'], v.referenceValue.getDescription()))
            else:
                for v in values:
                    writeinstance(v.referenceValue, indent+4, fieldsDataDictionary)
        elif fd['dataType'] == '_translation':
            for v in values:
                sys.stdout.write('%s%s: %s - %s\n' % (' ' * (indent + 4), fd['name'], v.languageCode if v.languageCode else '--', v.stringValue))
        else:
            for v in values:
                sys.stdout.write('%s%s: %s\n' % (' ' * (indent + 4), fd['name'], v.stringValue))
            

if __name__ == "__main__":
    django.setup()
    
    try:
        timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    
        try:
            path = sys.argv[sys.argv.index('-path') + 1]
        except ValueError:
            path = input('Path: ')
        except IndexError:
            path = input('Path: ')
    
        if '-q' in sys.argv:
            user = AnonymousUser()
        else:
            try:
                username = sys.argv[sys.argv.index('-user') + 1]
            except ValueError:
                username = input('Email Address: ')
            except IndexError:
                username = input('Email Address: ')
    
            password = getpass.getpass("Password: ")
            user = authenticate(username=username, password=password)

        with transaction.atomic():
            userInfo = UserInfo(user)
            fieldsDataDictionary = FieldsDataDictionary()
        
            terms = pathparser.selectAllObjects(path, userInfo=userInfo,securityFilter=userInfo.findFilter)\
                              .select_related('typeID')\
                              .select_related('description')\
                              .order_by('description__text', 'id')

            sys.stderr.write('Count: %s\n'%len(terms))
            
            for term in terms:
                writeinstance(term, 0, fieldsDataDictionary)
    except Exception as e:
        sys.stderr.write("%s\n" % traceback.format_exc())