# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-09-23 11:41
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0084_auto_20170923_1137'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='GroupGrant',
            new_name='UserGroupGrant',
        ),
        migrations.RenameModel(
            old_name='UserGrant',
            new_name='UserUserGrant',
        ),
    ]
