# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-07-19 15:25
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0076_experienceimplication'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='path',
            name='grantTarget',
        ),
        migrations.AddField(
            model_name='organization',
            name='primaryAdministrator',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='administeredOrganizations', to='consentrecords.User'),
        ),
        migrations.AddField(
            model_name='organization',
            name='publicAccess',
            field=models.CharField(db_index=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='path',
            name='publicAccess',
            field=models.CharField(db_index=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='primaryAdministrator',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='administeredUsers', to='consentrecords.User'),
        ),
        migrations.AddField(
            model_name='user',
            name='publicAccess',
            field=models.CharField(db_index=True, max_length=10, null=True),
        ),
    ]