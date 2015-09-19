# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Fact',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True, verbose_name='ID', auto_created=True)),
                ('verb', models.CharField(db_index=True, max_length=32)),
                ('object', models.CharField(db_index=True, max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='Object',
            fields=[
                ('id', models.UUIDField(editable=False, primary_key=True, serialize=False, default=uuid.uuid4)),
            ],
        ),
        migrations.CreateModel(
            name='Session',
            fields=[
                ('id', models.UUIDField(editable=False, primary_key=True, serialize=False, default=uuid.uuid4)),
                ('start_time', models.DateTimeField(db_column='start_time', db_index=True, auto_now_add=True)),
                ('end_time', models.DateTimeField(db_column='end_time', db_index=True, null=True)),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.UUIDField(editable=False, primary_key=True, serialize=False, default=uuid.uuid4)),
                ('creation_time', models.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)),
                ('time_zone_offset', models.SmallIntegerField()),
                ('session', models.ForeignKey(to='consentrecords.Session')),
            ],
        ),
        migrations.AddField(
            model_name='fact',
            name='subject',
            field=models.ForeignKey(to='consentrecords.Object'),
        ),
        migrations.AddField(
            model_name='fact',
            name='transaction',
            field=models.ForeignKey(to='consentrecords.Transaction'),
        ),
    ]
