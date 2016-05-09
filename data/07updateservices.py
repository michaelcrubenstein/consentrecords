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

# Rename "Play Baseball" to "Baseball Playing"
# Rename "Play Basketball" to "Basketball Playing"
# Rename "Play Baseball" to "Baseball Playing"
# Rename "Play Chess" to "Chess Playing"
# Rename "Play Football" to "Football Playing"
# Rename "Play Soccer" to "Soccer Playing"
# Rename "Play Squash" to "Squash Playing"
# Rename "Play Tennis" to "Tennis Playing"
# Rename "Play Volleyball" to "Volleyball Playing"
# Rename "Karate" to "Karate Training"
# Rename "Animals" to "Animal Shelter Volunteer"
# Rename "Art Lessons" to "Drawing Lessing"
# Rename "Coach Baseball" to "Baseball Coaching"
# Rename "Coach Football" to "Football Coaching"
# Rename "Coach Soccer" to "Soccer Coaching"
# Rename "Coach Tennis" to "Tennis Coaching"
# Rename "Political Organizing" to "Political Organizing Volunteer"

# Incorporate the Basketball Service into Play Basketball
# Incorporate the Football Service into Play Football
# Incorporate the Soccer Service into Play Soccer
