# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
django.setup()

from consentrecords.models import *

if __name__ == "__main__":
    with transaction.atomic():
        t = Transaction.objects.order_by('-creation_time')[0]

        if t.deletedValue.count():
            sys.stderr.write('Restoring %s values\n'%t.deletedValue.count())
    
        if t.deletedInstance.count():
            sys.stderr.write('Restoring %s instances\n'%t.deletedInstance.count())
    
        for v in t.deletedValue.all():
            v.deleteTransaction=None
            v.save()
    
        instances = list(t.deletedInstance.all())
        if len(instances):
            for i in instances:
                if i.typeID.defaultCustomAccess:
                    i.accessSource = i
                    i.save()
            
            foundOne = False
            while not foundOne:
                foundOne = False
                for i in instances:
                    print(i)
                    i.refresh_from_db()
                    i.parent.refresh_from_db()
                    if not i.accessSource and i.parent.accessSource:
                        i.accessSource = i.parent.accessSource
                        i.save()
                        foundOne = True
                    
            for i in instances:
                i.deleteTransaction=None
                i.save()
            
        if t.value_set.count():
            sys.stderr.write('Deleting %s values\n'%t.value_set.count())
    
        if t.instance_set.count():
            sys.stderr.write('Deleting %s instances\n'%t.instance_set.count())
    
        t.delete()
    
    sys.stderr.write('Transaction deleted: %s\n'%t)