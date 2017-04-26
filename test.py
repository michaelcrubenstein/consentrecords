import django; django.setup()
import json
from django.contrib.auth.models import AnonymousUser

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords.views import api

i = InstanceQuerySet()
i.refineResults(['0005ddf4fec641f7b3dc66e58c902f51'], UserInfo(AnonymousUser()))

print ('##################################')
print ('# Test 1 ')
print ('# Tests getting information about a term')
print ('##################################')
a = ("term[name=term]")
print (str(api.getData(AnonymousUser(), a, {}).content))


print ('##################################')
print ('# Test 2 ')
print ('##################################')
us = terms['user']
u = us.typeInstances.all()[0]

me = terms['Path']
v = u.getSubValue(me)
print(v.referenceValue)
print(v.referenceValue.getDescription())

print ('##################################')
print ('# Test 3 ')
print ('##################################')
nameLists=NameList()
print(u.cacheDescription(nameLists))
Instance.updateDescriptions([u], nameLists)

print ('##################################')
print ('# Test 5 ')
print ('##################################')
c = us._getSubInstances(terms.configuration)[0]
fs = c._getSubInstances(terms.field)

print (c.getConfiguration())

print ('##################################')
print ('# Test 6 ')
print ('##################################')
a = ('Organization')
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 7 ')
print ('##################################')
a = (me.id)
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 8 ')
print ('##################################')
a = (me.id+"/configuration")
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 9 ')
print ('##################################')
a = (me.id+"/configuration[name=Boston]")
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 10 ')
print ('##################################')
a = (me.id+"/configuration[name=Boston]/field:not([name^=M])")
print(pathparser.getQuerySet(a))

print ('##################################')
print ('# Test 11 ')
print ('# Tests getting data that contains a string and and object ')
print ('##################################')
a = ("Organization[name=BCYF]")
dd = pathparser.getQuerySet(a)
print(dd)
print (str(api.getData(AnonymousUser(), dd[0].id, {} ).content))

print ('##################################')
print ('# Test 11 ')
print ('# Tests selectAll on a type name. ')
print ('##################################')
print (json.loads(api.selectAll(AnonymousUser(), {'path': 'user'}).content.decode('utf-8')))

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