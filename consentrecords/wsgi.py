"""
WSGI config for consentrecords project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.8/howto/deployment/wsgi/
"""

import os,sys

from django.core.wsgi import get_wsgi_application

import time
import traceback
import signal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "consentrecords.settings")

cwd = os.getcwd()
sys.path.append(cwd)
sys.path.insert(0,cwd + '/consentrecords')  #You must add your project here
sys.path.insert(0,cwd + '/custom_user')  #You must add your project here

try:
    application = get_wsgi_application()
except Exception:
    traceback.print_exc()
    # Error loading applications
    if 'mod_wsgi' in sys.modules:
        os.kill(os.getpid(), signal.SIGINT)
        time.sleep(2.5)
    raise
