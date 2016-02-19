# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0034_auto_20160217_2036'),
    ]

    operations = [
        migrations.AlterField(
            model_name='value',
            name='field',
            field=models.ForeignKey(to='consentrecords.Instance', editable=False, related_name='fieldValues', null=True, db_column='fieldid'),
        ),
    ]
