# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0009_auto_20151004_0326'),
    ]

    operations = [
        migrations.AlterField(
            model_name='instance',
            name='parentID',
            field=models.UUIDField(editable=False, null=True, db_index=True),
        ),
    ]
