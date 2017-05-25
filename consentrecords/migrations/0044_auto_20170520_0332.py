# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-05-20 03:32
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0043_auto_20170519_1308'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='value',
            name='consentreco_instanc_039ad9_idx',
        ),
        migrations.AddIndex(
            model_name='value',
            index=models.Index(fields=['instance', 'field', 'referenceValue'], name='consentreco_instanc_d6399e_idx'),
        ),
        migrations.AddIndex(
            model_name='value',
            index=models.Index(fields=['instance', 'field', 'stringValue', 'languageCode'], name='consentreco_instanc_0be083_idx'),
        ),
    ]