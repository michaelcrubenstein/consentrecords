# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-05-30 01:16
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0056_auto_20170530_0037'),
    ]

    operations = [
        migrations.AlterField(
            model_name='comment',
            name='asker',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='askedComments', to='consentrecords.Path'),
        ),
        migrations.AlterField(
            model_name='commenthistory',
            name='asker',
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='askedCommentHistories', to='consentrecords.Path'),
        ),
    ]
