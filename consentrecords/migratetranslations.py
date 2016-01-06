# Migrate translation objects to translation types.

import datetime
import django
import tzlocal
import getpass
import logging

from django.db import transaction
from django.contrib.auth import authenticate

from consentrecords.models import TransactionState, Terms, Instance, Value, DeletedValue, DeletedInstance

if __name__ == "__main__":
    django.setup()

    timezoneoffset = -int(tzlocal.get_localzone().utcoffset(datetime.datetime.now()).total_seconds()/60)
    username = input('Email Address: ')
    password = getpass.getpass("Password: ")

    user = authenticate(username=username, password=password)

    logger = logging.getLogger(__name__)
    with transaction.atomic():
        transactionState = TransactionState(user, timezoneoffset)
        Terms.initialize(transactionState)
        
        f = Instance.objects.filter(typeID=Terms.field, deletedinstance__isnull=True,
                                    value__fieldID=Terms.dataType,
                                    value__referenceValue=Terms.objectEnum,
                                    value__deletedvalue__isnull=True)
                                    
        f = f.filter(value__fieldID=Terms.ofKind,
                     value__referenceValue=Terms.translation,
                     value__deletedvalue__isnull=True).distinct()
                     
        # logger.error([[str(i.parent.parent), i] for i in f])
        
        for field in f:
            dataType = field.value_set.get(fieldID=Terms.dataType,
                                              referenceValue=Terms.objectEnum,
                                              deletedvalue__isnull=True)
            dataType.markAsDeleted(transactionState)
            field.addReferenceValue(Terms.dataType, Terms.translationEnum, 0, transactionState)
            ofKind = field.value_set.get(fieldID=Terms.ofKind,
                                            referenceValue=Terms.translation,
                                            deletedvalue__isnull=True)
            ofKind.markAsDeleted(transactionState)
            logger.error("update parent %s, field %s to translation" % (field.parent.parent, field.description()))
                     
        g = Instance.objects.filter(typeID=Terms.translation,
                                deletedinstance__isnull=True)
        # logger.error([{"parent": i.parent, "text": i.value_set.get(deletedvalue__isnull=True, fieldID=Terms.text).stringValue} for g in f])
        for t in g:
            for v in t.value_set.filter(fieldID=Terms.text, deletedvalue__isnull=True):
                p = t.parent
                text = v.stringValue
                field = t.parentValue.fieldID
                position = t.parentValue.position
                t.parentValue.deepDelete(transactionState)
                p.addTranslationValue(field, {"text": text, "languageCode": "en"}, position, transactionState)
                logger.error("update value %s, field %s, text %s" % (p, field.description(), text))
