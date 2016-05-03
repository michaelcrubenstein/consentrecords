# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
from consentrecords.models import *

if __name__ == "__main__":
    django.setup()

    with transaction.atomic():
        t = Transaction.objects.order_by('-creation_time')[0]

        for v in t.deletedValue.all():
            v.deleteTransaction=None
            v.save()
    
        for i in t.deletedInstance.all():
            i.deleteTransaction=None
            i.save()
        
        if t.value_set.count():
            sys.stderr.write('Deleting %s values'%t.value_set.count())
    
        if t.instance_set.count():
            sys.stderr.write('Deleting %s instances'%t.instance_set.count())
    
        t.delete()
    
    sys.stderr.write('Transaction deleted: %s\n'%t)