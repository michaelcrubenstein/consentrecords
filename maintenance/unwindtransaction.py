# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
django.setup()

from consentrecords.models import *

if __name__ == "__main__":
    with transaction.atomic():
        t = Transaction.objects.order_by('-creation_time')[0]

        for v in t.deletedValue.all():
            v.deleteTransaction=None
            v.save()
    
        for i in t.deletedInstance.all():
            i.deleteTransaction=None
            i.save()
        
        if t.value_set.count():
            sys.stderr.write('Deleting %s values\n'%t.value_set.count())
    
        if t.instance_set.count():
            sys.stderr.write('Deleting %s instances\n'%t.instance_set.count())
    
        t.delete()
    
    sys.stderr.write('Transaction deleted: %s\n'%t)