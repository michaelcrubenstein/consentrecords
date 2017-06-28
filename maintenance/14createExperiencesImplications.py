import django; django.setup()
from django.db import transaction
import traceback
import logging
from uuid import UUID
from consentrecords.models import *
from parse.cssparser import parser as cssparser
mr = User.objects.filter(emails__text='michaelcrubenstein@gmail.com')[0]
es = User.objects.filter(emails__text='elizabethskavish@gmail.com')[0]

if __name__ == "__main__":
    try:
        with transaction.atomic():
            for u in User.objects.filter(deleteTransaction__isnull=True):
                print(str(u))
                experiences = Experience.objects.filter(deleteTransaction__isnull=True,
                    parent__parent=u)
                for e in experiences:
                    e.cacheImplications()
    except Exception as e:
        print("%s" % traceback.format_exc())
