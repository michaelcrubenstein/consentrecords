# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0014_description'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deletedinstance',
            name='id',
            field=models.ForeignKey(to='consentrecords.Instance', primary_key=True, serialize=False, editable=False, db_column='id', on_delete=models.CASCADE),
        ),
    ]
