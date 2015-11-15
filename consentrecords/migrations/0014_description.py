# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0013_auto_20151011_1556'),
    ]

    operations = [
        migrations.CreateModel(
            name='Description',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False, serialize=False)),
                ('text', models.CharField(max_length=255, db_index=True)),
                ('instance', models.ForeignKey(to='consentrecords.Instance', editable=False)),
                ('language', models.ForeignKey(null=True, editable=False, to='consentrecords.Instance', related_name='language')),
            ],
        ),
    ]
