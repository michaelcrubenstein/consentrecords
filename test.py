import django; django.setup()
import json

from consentrecords.models import *
from consentrecords import pathparser
from consentrecords.views import api

# Initialize terms before using them.
Terms.initialize()

s = Terms.uuName
print ('##################################')
print ('# Test 1 ')
print ('##################################')
print(s._getValues())
print(s._descriptors)
print(s._getDescription(s.typeID._descriptors))

print ('##################################')
print ('# Test 2 ')
print ('##################################')
us = Terms.getNamedInstance('_user')
u = us.typeInstances.all()[0]

me = Terms.getNamedInstance('More Experiences')
v = u.getSubValue(me)
print(v.referenceValue)
print(v.referenceValue.description())

print ('##################################')
print ('# Test 3 ')
print ('##################################')
nameLists=NameList()
print(u.cacheDescription(nameLists))
Instance.updateDescriptions([u], nameLists)

print ('##################################')
print ('# Test 5 ')
print ('##################################')
c = us._getSubInstances(Terms.configuration)[0]
fs = c._getSubInstances(Terms.field)

print (c.getConfiguration())
print (str(c.getMaxElementIndex(Terms.field)))

print ('##################################')
print ('# Test 6 ')
print ('##################################')
a = ('Organization')
print(pathparser.selectAllDescriptors(a))

print ('##################################')
print ('# Test 7 ')
print ('##################################')
a = ("#"+me.id)
print(pathparser.selectAllDescriptors(a))

print ('##################################')
print ('# Test 8 ')
print ('##################################')
a = ("#"+me.id+">_configuration")
print(pathparser.selectAllDescriptors(a))

print ('##################################')
print ('# Test 9 ')
print ('##################################')
a = ("#"+me.id+">_configuration[_name=Boston]")
print(pathparser.selectAllDescriptors(a))

print ('##################################')
print ('# Test 10 ')
print ('##################################')
a = ("#"+me.id+">_configuration[_name=Boston]>_field:not([_name^=M])")
print(pathparser.selectAllDescriptors(a))

print ('##################################')
print ('# Test 11 ')
print ('# Tests getting data that contains a string and and object ')
print ('##################################')
a = ("Organization>_name[_text=BYCF]")
dd = pathparser.selectAllDescriptors(a)
print(dd)
print (str(api.getData(None, {'path': '#'+dd[0]['value']['id']} ).content))

print ('##################################')
print ('# Test 11 ')
print ('# Tests selectAll on a type name. ')
print ('##################################')
print (json.loads(api.selectAll(None, {'path': '_user'}).content.decode('utf-8')))

# Test api.createInstance by creating an Organization with a name.
# Test api.updateValues by editing the name of an Organization.
# Test api.updateValues by editing an address of a site by editing one Street Address and adding another.
# Test api.updateValues by picking a new user for a group.
# Test api.addValue by adding a user to a group.
# Test api.getConfiguration by getting the configuration of an Organization
# Test api.getData with a string by displaying an Organization Name Translation
# Test api.deleteInstances by deleting an Organization with a name.
# Test api.deleteValue by deleting a user from a group.

print ("Test complete")