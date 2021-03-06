# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-06-13 17:41
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0070_auto_20170613_1729'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userusergrantrequest',
            name='deleteTransaction',
            field=models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='deletedUserUserGrantRequests', to='consentrecords.Transaction'),
        ),
        migrations.AlterField(
            model_name='userusergrantrequest',
            name='grantee',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='userUserGrantRequests', to='consentrecords.User'),
        ),
        migrations.AlterField(
            model_name='userusergrantrequest',
            name='lastTransaction',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='changedUserUserGrantRequests', to='consentrecords.Transaction'),
        ),
        migrations.AlterField(
            model_name='userusergrantrequest',
            name='parent',
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='userGrantRequests', to='consentrecords.User'),
        ),
        migrations.AlterField(
            model_name='userusergrantrequest',
            name='transaction',
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='createdUserUserGrantRequests', to='consentrecords.Transaction'),
        ),
        migrations.AlterField(
            model_name='userusergrantrequesthistory',
            name='grantee',
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='userUserGrantRequestHistories', to='consentrecords.User'),
        ),
        migrations.AlterField(
            model_name='userusergrantrequesthistory',
            name='transaction',
            field=models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='userUserGrantRequestHistories', to='consentrecords.Transaction'),
        ),
    ]
