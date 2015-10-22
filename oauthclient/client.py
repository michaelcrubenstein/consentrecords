# This code is used as part of the oauth workflow for authenticating a user.
# getAccessToken takes a request and fills args in.
#
# settings.CR_CLIENT_ID: a binary string which contains the client id for this application.
# settings.CR_SECRET_ID: a binary string which contains the secret id for this application.
# settings.CR_REQ_HOST: a string which contains the url from which client requests are coming.
# settings.CR_REDIRECT_URL: The command to redirect to after running? Is this used in a post?
# settings.CR_TOKEN_URL: The server url for getting a token: /o/token/
# settings.CR_GETUSERID_URL: The server url for getting a userID from a token.
import base64
import urllib
import urllib.parse

def getAccessToken(request, args):
    accessToken = request.GET.get('access_token', None)
    
    if 'code' in request.GET:
        # Redirect to get an access token.
        dataDict = {'code': request.GET['code'],
                    'redirect_uri': settings.CR_REDIRECT_URL, 
                    'grant_type': 'authorization_code'}
        crData = urllib.parse.urlencode(dataDict)
        tokenRequest = urllib.request.Request(url=settings.CR_TOKEN_URL, 
            data=bytes(crData, "UTF-8"),
            headers={'Authorization':  
                     'Basic ' + base64.b64encode(settings.CR_CLIENT_ID + b':' + settings.CR_SECRET_ID).decode('ascii')},
            origin_req_host=settings.CR_REQ_HOST)
        response = urllib.request.urlopen(tokenRequest)
        data = json.loads(response.read().decode("UTF-8"))
        accessToken = data["access_token"]
        args.update(data);

    if accessToken:
        dataDict = {'access_token': accessToken}
        crData = urllib.parse.urlencode(dataDict)
        tokenRequest = urllib.request.Request(url=settings.CR_GETUSERID_URL, 
            data=bytes(crData, "UTF-8"),
            headers={'Authorization':  
                     'Bearer ' + accessToken},
            origin_req_host=settings.CR_REQ_HOST)
        response = urllib.request.urlopen(tokenRequest)
        data = json.loads(response.read().decode("UTF-8"))
        args.update(data);

