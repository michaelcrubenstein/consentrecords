# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0028_auto_20160109_1931'),
    ]

    operations = [
        migrations.AlterField(
            model_name='description',
            name='language',
            field=models.CharField(null=True, db_index=True, max_length=10),
        ),
    ]
