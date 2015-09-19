# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0007_auto_20150909_2304'),
    ]

    operations = [
        migrations.AddField(
            model_name='deletedfact',
            name='fact',
            field=models.ForeignKey(default=1, editable=False, to='consentrecords.Fact'),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='deletedfact',
            name='id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False),
        ),
    ]
