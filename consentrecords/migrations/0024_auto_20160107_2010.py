# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0023_auto_20160106_2156'),
    ]

    operations = [
        migrations.AddField(
            model_name='grant',
            name='instance',
            field=models.ForeignKey(null=True, editable=False, to='consentrecords.Instance'),
        ),
        migrations.AddField(
            model_name='grantee',
            name='grant',
            field=models.ForeignKey(null=True, editable=False, to='consentrecords.Grant'),
        ),
        migrations.AlterField(
            model_name='grant',
            name='id',
            field=models.UUIDField(primary_key=True, default=uuid.uuid4, serialize=False, editable=False),
        ),
        migrations.AlterField(
            model_name='grantee',
            name='id',
            field=models.UUIDField(primary_key=True, default=uuid.uuid4, serialize=False, editable=False),
        ),
        migrations.AlterField(
            model_name='grantee',
            name='instance',
            field=models.ForeignKey(null=True, editable=False, to='consentrecords.Instance'),
        ),
    ]
