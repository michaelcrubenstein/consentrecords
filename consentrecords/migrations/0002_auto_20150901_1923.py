# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0001_initial'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Object',
            new_name='UUIDRecord',
        ),
        migrations.RemoveField(
            model_name='fact',
            name='object',
        ),
        migrations.AddField(
            model_name='fact',
            name='directObject',
            field=models.CharField(null=True, editable=False, db_index=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='fact',
            name='id',
            field=models.UUIDField(serialize=False, default=uuid.uuid4, editable=False, primary_key=True),
        ),
        migrations.AlterField(
            model_name='fact',
            name='subject',
            field=models.UUIDField(editable=False, db_index=True),
        ),
        migrations.AlterField(
            model_name='fact',
            name='verb',
            field=models.UUIDField(editable=False, db_index=True),
        ),
    ]
