from django.http import HttpResponse, JsonResponse

import logging
import traceback

from monitor.models import LogRecord

def log(request):
    try:
        if request.method != "POST":
            raise Exception("emit only responds to POST requests")
    
        user = request.user
        data = request.POST
    
        name = data.get('name', '')
        message = data.get('message', '')
        LogRecord.emit(user, name, message)
        
        results = {'success':True}
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
        results = {'success':False, 'error': str(e)}
    
    return JsonResponse(results)

