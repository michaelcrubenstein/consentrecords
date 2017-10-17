# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LogRecord',
            fields=[
                ('id', models.AutoField(verbose_name='ID', auto_created=True, primary_key=True, serialize=False)),
                ('creation_time', models.DateTimeField(auto_now_add=True, db_column='creation_time', db_index=True)),
                ('name', models.CharField(max_length=40, db_index=True)),
                ('message', models.TextField(null=True)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True, on_delete=models.CASCADE)),
            ],
        ),
    ]
