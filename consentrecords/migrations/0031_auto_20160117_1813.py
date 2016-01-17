# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0030_auto_20160111_0351'),
    ]

    operations = [
#         migrations.RemoveField(
#             model_name='deletedinstance',
#             name='id',
#         ),
#         migrations.RemoveField(
#             model_name='deletedinstance',
#             name='transaction',
#         ),
#         migrations.RemoveField(
#             model_name='deletedvalue',
#             name='id',
#         ),
#         migrations.RemoveField(
#             model_name='deletedvalue',
#             name='transaction',
#         ),
        migrations.RenameField(
            model_name='value',
            old_name='fieldID',
            new_name='field',
        ),
        migrations.DeleteModel(
            name='DeletedInstance',
        ),
        migrations.DeleteModel(
            name='DeletedValue',
        ),
    ]
