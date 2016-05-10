import datetime
import django
import tzlocal
import getpass
import traceback
import sys
import csv
import re

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator

# Delete the Education Service
ed = Instance.objects.get(typeID=terms['Service'],description__text='Education')
vs = Value.objects.filter(referenceValue=ed, deleteTransaction__isnull=True)

# Incorporate the Basketball Service into Play Basketball
# Incorporate the Football Service into Play Football
# Incorporate the Soccer Service into Play Soccer
# Incorporate Theater into Theater Role

