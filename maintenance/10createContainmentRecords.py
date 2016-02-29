# python3 maintenance/10createContainmentRecords.py

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate
from django.db.models import F
from django.db.models import Count

from consentrecords.models import *

import queue

if __name__ == "__main__":
    django.setup()

    with transaction.atomic():
        f = Instance.objects.filter(parent__isnull=True,
                                    deleteTransaction__isnull=True)
                                    
        print("%s root instances" % f.count())
        
        Containment.objects.bulk_create([Containment(ancestor=i, descendent=i) for i in f])
        
        q = queue.Queue()
        for i in f: q.put(i)
        
        count = 0
        while not q.empty():
            next = q.get()
            f = Instance.objects.filter(parent=next, deleteTransaction__isnull=True)
            g = next.ancestors.all()
            Containment.objects.bulk_create([Containment(ancestor=j.ancestor, descendent=i) for i in f for j in g])
            Containment.objects.bulk_create([Containment(ancestor=i, descendent=i) for i in f])
            for i in f: q.put(i)
            count += 1
            if count % 50 == 0: print ("%s - %s" % (count, q.qsize()))
        
