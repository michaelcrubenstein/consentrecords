# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0036_auto_20160219_0302'),
    ]

    operations = [
        migrations.CreateModel(
            name='Containment',
            fields=[
                ('id', models.UUIDField(editable=False, default=uuid.uuid4, primary_key=True, serialize=False)),
                ('ancestor', models.ForeignKey(related_name='descendents', to='consentrecords.Instance', editable=False)),
                ('descendent', models.ForeignKey(related_name='ancestors', to='consentrecords.Instance', editable=False)),
            ],
        ),
    ]
