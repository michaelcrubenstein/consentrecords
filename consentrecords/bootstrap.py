from django.db import connection, models
from django.conf import settings
from django.utils import timezone

import datetime
import numbers
import uuid
import logging
import string
from multiprocessing import Lock

from consentrecords.models import Fact

class BootStrapper():
    def initializeUUNames():
        #Instantiate the uuName uuName.
        with connection.cursor() as c:
            sql = "SELECT f1.subject" + \
                  " FROM consentrecords_fact f1" + \
                  " WHERE f1.verb = f1.subject AND f1.directObject = %s"
            c.execute(sql, [Fact.uuNameName])
            i = c.fetchone()
            if not i:
                return
            else:
                Fact._initialUUNames[Fact.uuNameName] = uuid.UUID(i[0])
        
        # Instantiate all of the other core uuNames.
        for s in Fact._initialKinds:
            try: 
                id = Fact._getInitialUUID(s)
            except Fact.UnrecognizedNameError:
                pass
    
