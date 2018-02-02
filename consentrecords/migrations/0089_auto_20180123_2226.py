# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2018-01-23 22:26
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0088_auto_20171227_2107'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='experience',
            name='timeframe',
        ),
        migrations.RemoveField(
            model_name='experiencehistory',
            name='timeframe',
        ),
        migrations.AlterField(
            model_name='experience',
            name='era',
            field=models.IntegerField(db_index=True, null=True),
        ),
    ]
