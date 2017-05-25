# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-05-19 13:08
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0042_auto_20170518_1808'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tagsource',
            name='source',
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='tag_sources', to='consentrecords.Instance'),
        ),
        migrations.AlterField(
            model_name='tagsource',
            name='target',
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='tag_targets', to='consentrecords.Instance'),
        ),
    ]