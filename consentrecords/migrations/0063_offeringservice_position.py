# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-06-08 16:56
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0062_auto_20170608_0428'),
    ]

    operations = [
        migrations.AddField(
            model_name='offeringservice',
            name='position',
            field=models.IntegerField(default=0),
            preserve_default=False,
        ),
    ]
