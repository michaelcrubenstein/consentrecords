# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-09-13 17:23
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('custom_user', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='passwordreset',
            name='creation_time',
            field=models.DateTimeField(db_column='creation_time', db_index=True),
        ),
    ]