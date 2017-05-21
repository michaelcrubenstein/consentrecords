# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-05-21 17:18
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0044_auto_20170520_0332'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='value',
            name='consentreco_instanc_d6399e_idx',
        ),
        migrations.RemoveIndex(
            model_name='value',
            name='consentreco_instanc_0be083_idx',
        ),
        migrations.AddIndex(
            model_name='value',
            index=models.Index(fields=['instance', 'field'], name='consentreco_instanc_039ad9_idx'),
        ),
    ]
