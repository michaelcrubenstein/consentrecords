# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0016_auto_20151114_1832'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deletedvalue',
            name='id',
            field=models.OneToOneField(editable=False, primary_key=True, to='consentrecords.Value', db_column='id', serialize=False, on_delete=models.CASCADE),
        ),
    ]
