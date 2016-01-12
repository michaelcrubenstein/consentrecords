# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import sys

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, DeletedValue, DeletedInstance

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        
        f = Instance.objects.filter(typeID=Terms.field, deleteTransaction__isnull=True,
                                    value__fieldID=Terms.dataType,
                                    value__referenceValue=Terms.objectEnum,
                                    value__deleteTransaction__isnull=True)
                                    
        f = f.filter(value__fieldID=Terms.ofKind,
                     value__referenceValue=Terms.translation,
                     value__deleteTransaction__isnull=True).distinct()
                     
        # print([[str(i.parent.parent), i] for i in f])
        
        for field in f:
            dataType = field.value_set.get(fieldID=Terms.dataType,
                                              referenceValue=Terms.objectEnum,
                                              deleteTransaction__isnull=True)
            dataType.markAsDeleted(transactionState)
            field.addReferenceValue(Terms.dataType, Terms.translationEnum, 0, transactionState)
            ofKind = field.value_set.get(fieldID=Terms.ofKind,
                                            referenceValue=Terms.translation,
                                            deleteTransaction__isnull=True)
            ofKind.markAsDeleted(transactionState)
            print("update parent %s, field %s to translation" % (field.parent.parent, field.description()))
                     
        g = Instance.objects.filter(typeID=Terms.translation,
                                deleteTransaction__isnull=True)
        # print([{"parent": i.parent, "text": i.value_set.get(deleteTranslation__isnull=True, fieldID=Terms.text).stringValue} for g in f])
        for t in g:
            for v in t.value_set.filter(fieldID=Terms.text, deleteTranslation__isnull=True):
                p = t.parent
                text = v.stringValue
                field = t.parentValue.fieldID
                position = t.parentValue.position
                t.parentValue.deepDelete(transactionState)
                p.addTranslationValue(field, {"text": text, "languageCode": "en"}, position, transactionState)
                print("update value %s, field %s, text %s" % (p, field.description(), text))
