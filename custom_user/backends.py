from django.conf import settings
from django.contrib.auth import get_user_model

import urllib
import urllib.parse
import json

class FacebookBackend(object):
    """
    Authenticate against the facebook access token.
    """

    def authenticate(self, accessToken=None):
        fbrequest = urllib.request.Request(url="https://graph.facebook.com/app/?access_token="+accessToken, \
            origin_req_host=settings.FACEBOOK_REQ_HOST)
        response = urllib.request.urlopen(fbrequest)
        data = json.loads(response.read().decode("UTF-8"))
        if data['id'] != settings.FACEBOOK_APP_ID:
            return None
            
        fbrequest = urllib.request.Request(url="https://graph.facebook.com/me/?access_token="+accessToken, \
            origin_req_host=settings.FACEBOOK_REQ_HOST)
        response = urllib.request.urlopen(fbrequest)
        data = json.loads(response.read().decode("UTF-8"))
        
        if 'email' not in data:
            return None
        
        manager = get_user_model().objects
        querySet = manager.filter(email=data['email'])
        if querySet.count() == 0:
            # Create a new user. Note that we can set password
            # to anything, because it won't be checked; the password
            # from settings.py will.
            user = manager.create_user(password='get from settings.py', email=data['email'])
            user.first_name = data['first_name']
            user.last_name = data['last_name']
            user.save(using=manager._db)
            return user
        else:
            return querySet.get()

    def get_user(self, user_id):
        try:
            manager = get_user_model().objects
            return manager.get(pk=user_id)
        except User.DoesNotExist:
            return None

