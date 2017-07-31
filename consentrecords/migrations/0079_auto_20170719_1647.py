# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-07-19 16:47
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0078_auto_20170719_1559'),
    ]

    operations = [
        migrations.AddField(
            model_name='organizationhistory',
            name='primaryAdministrator',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='administeredOrganizationHistories', to='consentrecords.User'),
        ),
        migrations.AddField(
            model_name='organizationhistory',
            name='publicAccess',
            field=models.CharField(max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='pathhistory',
            name='publicAccess',
            field=models.CharField(db_index=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='userhistory',
            name='primaryAdministrator',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='administeredUserHistories', to='consentrecords.User'),
        ),
        migrations.AddField(
            model_name='userhistory',
            name='publicAccess',
            field=models.CharField(editable=False, max_length=10, null=True),
        ),
    ]