import django; django.setup()
import json
from django.contrib.auth.models import AnonymousUser

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords.views import api

print ('##################################')
print ('# Test 1 ')
print ('# Tests getting information about a term')
print ('##################################')
a = ("_term[_name=_term]")
print (str(api.getData(AnonymousUser(), a, {}).content))


print ('##################################')
print ('# Test 2 ')
print ('##################################')
us = terms['_user']
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
print(pathparser.selectAllObjects(a))

print ('##################################')
print ('# Test 7 ')
print ('##################################')
a = ("#"+me.id)
print(pathparser.selectAllObjects(a))

print ('##################################')
print ('# Test 8 ')
print ('##################################')
a = ("#"+me.id+">_configuration")
print(pathparser.selectAllObjects(a))

print ('##################################')
print ('# Test 9 ')
print ('##################################')
a = ("#"+me.id+">_configuration[_name=Boston]")
print(pathparser.selectAllObjects(a))

print ('##################################')
print ('# Test 10 ')
print ('##################################')
a = ("#"+me.id+">_configuration[_name=Boston]>_field:not([_name^=M])")
print(pathparser.selectAllObjects(a))

print ('##################################')
print ('# Test 11 ')
print ('# Tests getting data that contains a string and and object ')
print ('##################################')
a = ("Organization[_name=BCYF]")
dd = pathparser.selectAllObjects(a)
print(dd)
print (str(api.getData(AnonymousUser(), '#'+dd[0].id, {} ).content))

print ('##################################')
print ('# Test 11 ')
print ('# Tests selectAll on a type name. ')
print ('##################################')
print (json.loads(api.selectAll(AnonymousUser(), {'path': '_user'}).content.decode('utf-8')))

pathparser.selectAllObjects('Site[_name^=Jackson]')
pathparser.selectAllObjects('"Service Domain"')
pathparser.selectAllObjects('"Service Domain"[?]')
pathparser.selectAllObjects('_user[?*=ichael]')
pathparser.selectAllObjects('_user[(_name,_email)*=ichael]')
pathparser.selectAllObjects('_user["_first name"]')
pathparser.selectAllObjects('_user[("_first name","_last name")]')
pathparser.selectAllObjects('("Service Domain","Service")[_name=Education]')
pathparser.selectAllObjects('Site[_name^=Jackson][Offerings>Offering>Service[_name="Grade 8"]]')
pathparser.selectAllObjects('_user[_email^=michael]::reference(Experience,Enrollment)')
pathparser.selectAllObjects('_user[_email^=michael]::reference(Experience)::reference(Experiences)::reference(Session)::reference(Sessions)::reference(Offering)')
pathparser.selectAllObjects('_user::not(_user[_email^=michael])' +
	'::not(_user[_email^=michael]::reference("_access record")[_privilege=(_read,_write,_administer)]::reference(_user))')
pathparser.selectAllObjects('Offerings>Offering[_name="Grade 9"]')
pathparser.selectAllObjects('Organization[_name="Boston Public Schools"]>Sites>Site[Offerings>Offering[_name="Grade 9"]]')
pathparser.selectAllObjects('Organization[_name="Boston Public Schools"]>Sites>Site[Offerings>Offering[Service=%s]]'%\
    pathparser.selectAllObjects('Service[_name="Grade 9"]')[0].id)
    
# Test api.createInstance by creating an Organization with a name.
# Test api.updateValues by editing the name of an Organization.
# Test api.updateValues by editing an address of a site by editing one Street Address and adding another.
# Test api.updateValues by picking a new user for a group.
# Test api.getConfiguration by getting the configuration of an Organization
# Test api.getData with a string by displaying an Organization Name Translation
# Test api.deleteInstances by deleting an Organization with a name.
# Test api.deleteValue by deleting a user from a group.

print ("Test complete")