import datetime
import django; django.setup()

from consentrecords.models import *

currentDate = datetime.datetime.now().isoformat()[:10]
currentMonth = currentDate[:7]
for e in Experience.objects.filter(timeframe__isnull=True):
    if e.end and e.end < currentMonth:
        e.timeframe = 'Previous'; e.save()
    elif e.start and not e.end and e.start < currentMonth:
        e.timeframe = 'Current'; e.save()
    elif e.start and e.end and e.start < currentMonth and e.end >= currentDate:
        e.timeframe = 'Current'; e.save()
    elif e.start and e.start > currentDate:
        e.timeframe = 'Goal'; e.save()
    elif not e.start and not e.end:
        e.timeframe = 'Goal'; e.save()

for e in Experience.objects.filter(era__isnull=True):
    e.era = 1 if e.timeframe == 'Previous' \
       else 2 if e.timeframe == 'Current' \
       else 3 if e.timeframe == 'Goal' else None
    e.save()


