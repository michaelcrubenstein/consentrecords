# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-09-05 21:35
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0080_auto_20170719_2041'),
    ]

    operations = [
        migrations.AddField(
            model_name='experience',
            name='engagement',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='experiences', to='consentrecords.Engagement'),
        ),
        migrations.AddField(
            model_name='experiencehistory',
            name='engagement',
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='experienceHistories', to='consentrecords.Engagement'),
        ),
    ]
