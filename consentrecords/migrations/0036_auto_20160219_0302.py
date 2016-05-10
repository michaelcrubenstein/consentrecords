# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0035_auto_20160219_0005'),
    ]

    operations = [
        migrations.AlterField(
            model_name='value',
            name='field',
            field=models.ForeignKey(related_name='fieldValues', default='f256771fce17454d8559ce48ce33735c', editable=False, db_column='fieldid', to='consentrecords.Instance'),
            preserve_default=False,
        ),
    ]
