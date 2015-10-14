# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0012_auto_20151007_1954'),
    ]

    operations = [
        migrations.RenameField(
            model_name='instance',
            old_name='parentID',
            new_name='parent',
        ),
        migrations.RemoveField(
            model_name='deletedinstance',
            name='instance',
        ),
        migrations.AlterField(
            model_name='deletedinstance',
            name='id',
            field=models.UUIDField(primary_key=True, serialize=False, editable=False),
        ),
        migrations.AlterField(
            model_name='deletedvalue',
            name='id',
            field=models.UUIDField(primary_key=True, serialize=False, editable=False),
        ),
    ]
