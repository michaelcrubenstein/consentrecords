# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0026_auto_20160107_2040'),
    ]

    operations = [
        migrations.CreateModel(
            name='Grant',
            fields=[
                ('id', models.UUIDField(serialize=False, primary_key=True, default=uuid.uuid4, editable=False)),
                ('instance', models.ForeignKey(to='consentrecords.Instance', editable=False)),
                ('privilege', models.ForeignKey(related_name='privilegeInstances', to='consentrecords.Instance', editable=False)),
            ],
        ),
        migrations.CreateModel(
            name='Grantee',
            fields=[
                ('id', models.UUIDField(serialize=False, primary_key=True, default=uuid.uuid4, editable=False)),
                ('grant', models.ForeignKey(to='consentrecords.Grant', editable=False)),
                ('instance', models.ForeignKey(to='consentrecords.Instance', editable=False)),
            ],
        ),
    ]
