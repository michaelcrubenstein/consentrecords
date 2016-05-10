# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0032_auto_20160207_2120'),
    ]

    operations = [
        migrations.AlterField(
            model_name='value',
            name='position',
            field=models.IntegerField(),
        ),
    ]
