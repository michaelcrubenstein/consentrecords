import django; django.setup()
import json
from django.contrib.auth.models import AnonymousUser

from consentrecords.models import *
from consentrecords.views import api

print ('##################################')
print ('# Test 1 ')
print ('# Tests getting information about a term')
print ('##################################')
print ('Test 1 obsolete')


print ('##################################')
print ('# Test 2 ')
print ('##################################')
u = User.objects.all()[0]

v = u.path
print(str(v))

print ('##################################')
print ('# Test 4 ')
print ('##################################')
a = ('organization')
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 7 ')
print ('##################################')
a = u.urlPath()
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 8 ')
print ('##################################')
print ('Test 8 obsolete')

print ('##################################')
print ('# Test 9 ')
print ('##################################')
print ('Test 9 obsolete')

print ('##################################')
print ('# Test 10 ')
print ('##################################')
print ('Test 10 obsolete')

print ('##################################')
print ('# Test 11 ')
print ('# Tests getting data that contains a string and and object ')
print ('##################################')
a = ('organization[name>text=BCYF]')
print (str(api.getData(AnonymousUser(), a, {} ).content))

print ('##################################')
print ('# Test 12 ')
print ('# Tests selectAll on a type name. ')
print ('##################################')
print (json.loads(api.getData(AnonymousUser(), 'user', {'fields': '["none"]'}).content.decode('utf-8')))

pathparser.getQuerySet('Site[name^=Jackson]')
pathparser.getQuerySet('"Service Domain"')
pathparser.getQuerySet('"Service Domain"[?]')
pathparser.getQuerySet('user[?*=ichael]')
pathparser.getQuerySet('user[(name,email)*=ichael]')
pathparser.getQuerySet('user["first name"]')
pathparser.getQuerySet('user[("first name","last name")]')
pathparser.getQuerySet('("Service Domain","Service")[name=Education]')
pathparser.getQuerySet('Site[name^=Jackson][Offerings>Offering>Service[name="Grade 8"]]')
pathparser.getQuerySet('user[email^=michael]::reference(Experience,Enrollment)')
pathparser.getQuerySet('user[email^=michael]::reference(Experience)::reference(Experiences)::reference(Session)::reference(Sessions)::reference(Offering)')
pathparser.getQuerySet('user::not(user[email^=michael])' +
	'::not(user[email^=michael]::reference("access record")[privilege=(read,write,administer)]::reference(user))')
pathparser.getQuerySet('Offerings>Offering[name="Grade 9"]')
pathparser.getQuerySet('Organization[name="Boston Public Schools"]>Sites>Site[Offerings>Offering[name="Grade 9"]]')
pathparser.getQuerySet('Organization[name="Boston Public Schools"]>Sites>Site[Offerings>Offering[Service=%s]]'%\
    pathparser.getQuerySet('Service[name="Grade 9"]')[0].id)
    
print ("Test complete")