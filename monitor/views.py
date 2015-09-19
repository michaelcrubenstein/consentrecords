from django.http import HttpResponse, JsonResponse

import logging
import traceback

from monitor.models import LogRecord

def getRecords(request):
    results = {'success':False, 'error': 'getRecords failed'}
    
    try:
        results = {'success':True, 'records': LogRecord.getRecords()}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
    
    return JsonResponse(results)

