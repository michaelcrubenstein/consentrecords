# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0021_instance_parentvalue'),
    ]

    operations = [
        migrations.AddField(
            model_name='value',
            name='languageCode',
            field=models.CharField(null=True, editable=False, db_index=True, max_length=10),
        ),
    ]
