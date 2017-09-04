# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0015_auto_20151114_1831'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deletedinstance',
            name='id',
            field=models.OneToOneField(serialize=False, db_column='id', to='consentrecords.Instance', primary_key=True, editable=False, on_delete=models.CASCADE),
        ),
    ]
