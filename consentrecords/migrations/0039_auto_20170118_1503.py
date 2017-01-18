# -*- coding: utf-8 -*-
# Generated by Django 1.10.3 on 2017-01-18 15:03
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0038_remove_transaction_time_zone_offset'),
    ]

    operations = [
        migrations.AddField(
            model_name='instance',
            name='accessSource',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='accessTargets', to='consentrecords.Instance'),
        ),
        migrations.DeleteModel(
            name='AccessRecord',
        ),
    ]