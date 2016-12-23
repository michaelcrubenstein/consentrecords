# python3 data/09dumplogrecordstats.py -start '2016-07-28 05:00:00'

import profile
import getpass
import sys
import django
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db.models import Count
from consentrecords.models import *
from consentrecords import pathparser
from consentrecords import instancecreator
from parse import cssparser
from consentrecords.views import api


from monitor.models import LogRecord

if __name__ == "__main__":
    django.setup()
    
    try:
        try:
            start = sys.argv[sys.argv.index('-start') + 1]
        except ValueError:
            start = datetime.datetime.now()
    
        try:
            end = sys.argv[sys.argv.index('-end') + 1]
        except ValueError:
            end = datetime.datetime.now()

        sys.stderr.write("Start:\t%s\n" % start)
        sys.stderr.write("End:\t%s\n" % end)

        transactions = Transaction.objects.filter(creation_time__range=[start, end])
        sys.stderr.write("Transactions:\t%s\n" % transactions.count())

        logRecords = LogRecord.objects.filter(creation_time__range=[start, end])
        sys.stderr.write("Log records:\t%s\n" % logRecords.count())

        users = Instance.objects.filter(typeID=terms.user,deleteTransaction__isnull=True,
                                        transaction__in=transactions)
        sys.stderr.write("Users created:\t%s\n" % users.count())

        activeUsers = AuthUser.objects.order_by('email')\
            .filter(transaction__in=transactions).distinct()
        sys.stderr.write("Active Users:\t%s\n" % activeUsers.count())
        
        sys.stderr.write("")
        sys.stderr.write("email\tuser actions\tdatabase transactions\ttotal experiences")
        for u in activeUsers:
            numLogs = u.logrecord_set.filter(creation_time__range=[start, end]).count()
            numTransactions = u.transaction_set.filter(creation_time__range=[start, end]).count()
            path = Instance.getUserInstance(u).value_set.get(field=terms['More Experiences'], deleteTransaction__isnull=True).referenceValue
            experiences = path.value_set.filter(field=terms['More Experience'], deleteTransaction__isnull=True)
            sys.stderr.write("%s\t%s\t%s\t%s\n" % (u.email, numLogs, numTransactions, experiences.count()))


    except Exception as e:
        sys.stderr.write("%s\n" % traceback.format_exc())