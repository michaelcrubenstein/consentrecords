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
        Fact._initialUUNames = {}
        
        #Instantiate the uuName uuName.
        uuNameID = Fact.getUUNameID()
        if uuNameID:
            Fact._initialUUNames[Fact.uuNameName] = uuNameID
        else:
            return
            
        # Instantiate all of the other core uuNames.
        for s in Fact._initialKinds:
            try: 
                id = Fact._getInitialUUID(s)
            except Fact.UnrecognizedNameError:
                pass
    
