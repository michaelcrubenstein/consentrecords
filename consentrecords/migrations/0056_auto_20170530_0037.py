# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-05-30 00:37
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0055_auto_20170530_0008'),
    ]

    operations = [
        migrations.AlterField(
            model_name='experienceservice',
            name='service',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='experienceServices', to='consentrecords.Service'),
        ),
        migrations.AlterField(
            model_name='experienceservicehistory',
            name='service',
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='experienceServiceHistories', to='consentrecords.Service'),
        ),
    ]
