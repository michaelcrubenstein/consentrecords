# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-06-08 23:33
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0064_offeringservicehistory_position'),
    ]

    operations = [
        migrations.AlterField(
            model_name='offeringservicehistory',
            name='service',
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='offeringServiceHistories', to='consentrecords.Service'),
        ),
    ]
