# python3 maintenance/unwindtransaction.py

import django
import sys

from django.db import transaction
django.setup()

from consentrecords.models import *

def printTransaction(t):
    print("Transaction\t%s\t%s\t%s" % (t.id, t.user, t.creation_time))
    nullString = "-"
    
    if t.createdGrantTargets.count():
        print("\nCreated Grant Targets\tpublic access\tprimary administrator")
        for i in t.createdGrantTargets.all():
            print("%s\t%s\t%s" % (i.id, i.publicAccess or nullString, i.primaryAdministrator or nullString))
    if t.changedGrantTargets.count():
        print("\nChanged Grant Targets\tpublic access\tprimary administrator")
        for i in t.changedGrantTargets.all():
            print("%s\t%s\t%s" % (i.id, i.publicAccess or nullString, i.primaryAdministrator or nullString))
    if t.deletedGrantTargets.count():
        print("\nDeleted Grant Targets\tpublic access\tprimary administrator")
        for i in t.deletedGrantTargets.all():
            print("%s\t%s\t%s" % (i.id, i.publicAccess or nullString, i.primaryAdministrator or nullString))
    if t.grantTargetHistories.count():
        print("\nGrant Target Histories\tpublic access\tprimary administrator")
        for i in t.grantTargetHistories.all():
            print("%s\t%s\t%s" % (i.id, i.publicAccess or nullString, i.primaryAdministrator or nullString))

    if t.createdPaths.count():
        print("\nCreated Paths\tuser\tbirthday\tname\tspecial access\tcan answer experience")
        for i in t.createdPaths.all():
            print("%s\t%s\t%s\t%s\t%s\t%s" % (i.id, i.parent, i.birthday or nullString, i.name or nullString, i.specialAccess or nullString, i.canAnswerExperience or nullString))
    if t.changedPaths.count():
        print("\nChanged Paths\tuser\tbirthday\tname\tspecial access\tcan answer experience")
        for i in t.changedPaths.all():
            print("%s\t%s\t%s\t%s\t%s\t%s" % (i.id, i.parent, i.birthday or nullString, i.name or nullString, i.specialAccess or nullString, i.canAnswerExperience or nullString))
    if t.deletedPaths.count():
        print("\nDeleted Paths\tuser\tbirthday\tname\tspecial access\tcan answer experience")
        for i in t.deletedPaths.all():
            print("%s\t%s\t%s\t%s\t%s\t%s" % (i.id, i.parent, i.birthday or nullString, i.name or nullString, i.specialAccess or nullString, i.canAnswerExperience or nullString))
    if t.pathHistories.count():
        print("\nPathHistories\tuser\tbirthday\tname\tspecial access\tcan answer experience")
        for i in t.pathHistories.all():
            print("%s\t%s\t%s\t%s\t%s\t%s" % (i.id, i.parent, i.birthday or nullString, i.name or nullString, i.specialAccess or nullString, i.canAnswerExperience or nullString))

    if t.createdUsers.count():
        print("\nCreated Users\tfirst name\tlast name\tbirthday")
        for i in t.createdUsers.all():
            print("%s\t%s\t%s\t%s" % (i.id, i.firstName or nullString, i.lastName or nullString, i.birthday or nullString))
    if t.changedUsers.count():
        print("\nChanged Users\tfirst name\tlast name\tbirthday")
        for i in t.changedUsers.all():
            print("%s\t%s\t%s\t%s" % (i.id, i.firstName or nullString, i.lastName or nullString, i.birthday or nullString))
    if t.deletedUsers.count():
        print("\nDeleted Users\tfirst name\tlast name\tbirthday")
        for i in t.deletedUsers.all():
            print("%s\t%s\t%s\t%s" % (i.id, i.firstName or nullString, i.lastName or nullString, i.birthday or nullString))
    if t.userHistories.count():
        print("\nUser Histories\tfirst name\tlast name\tbirthday")
        for i in t.userHistories.all():
            print("%s\t%s\t%s\t%s" % (i.id, i.firstName or nullString, i.lastName or nullString, i.birthday or nullString))

    publicAccess = dbmodels.CharField(max_length=10, db_index=True, null=True)
    primaryAdministrator = dbmodels.ForeignKey('consentrecords.User', related_name='administered', db_index=True, null=True, on_delete=dbmodels.CASCADE)

if __name__ == "__main__":
    with transaction.atomic():
        t = Transaction.objects.order_by('-creation_time')[0]
        
        printTransaction(t)
# 
#         if t.deletedValue.count():
#             sys.stderr.write('Restoring %s values\n'%t.deletedValue.count())
#     
#         if t.deletedInstance.count():
#             sys.stderr.write('Restoring %s instances\n'%t.deletedInstance.count())
#     
#         for v in t.deletedValue.all():
#             v.deleteTransaction=None
#             v.save()
#     
#         instances = list(t.deletedInstance.all())
#         if len(instances):
#             for i in instances:
#                 if i.typeID.defaultCustomAccess:
#                     i.accessSource = i
#                     i.save()
#             
#             foundOne = False
#             while not foundOne:
#                 foundOne = False
#                 for i in instances:
#                     print(i)
#                     i.refresh_from_db()
#                     i.parent.refresh_from_db()
#                     if not i.accessSource and i.parent.accessSource:
#                         i.accessSource = i.parent.accessSource
#                         i.save()
#                         foundOne = True
#                     
#             for i in instances:
#                 i.deleteTransaction=None
#                 i.save()
#             
#         if t.value_set.count():
#             sys.stderr.write('Deleting %s values\n'%t.value_set.count())
#     
#         if t.instance_set.count():
#             sys.stderr.write('Deleting %s instances\n'%t.instance_set.count())
#     
#         t.delete()
#     
#     sys.stderr.write('Transaction deleted: %s\n'%t)