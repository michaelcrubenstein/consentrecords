# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0008_auto_20150909_2315'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeletedInstance',
            fields=[
                ('id', models.UUIDField(serialize=False, editable=False, default=uuid.uuid4, primary_key=True)),
            ],
        ),
        migrations.CreateModel(
            name='DeletedValue',
            fields=[
                ('id', models.UUIDField(serialize=False, editable=False, default=uuid.uuid4, primary_key=True)),
                ('transaction', models.ForeignKey(editable=False, to='consentrecords.Transaction')),
            ],
        ),
        migrations.CreateModel(
            name='Instance',
            fields=[
                ('id', models.UUIDField(serialize=False, editable=False, default=uuid.uuid4, primary_key=True)),
                ('typeID', models.UUIDField(editable=False, db_index=True)),
                ('parentID', models.UUIDField(editable=False, db_index=True)),
                ('transaction', models.ForeignKey(editable=False, to='consentrecords.Transaction')),
            ],
        ),
        migrations.CreateModel(
            name='Value',
            fields=[
                ('id', models.UUIDField(serialize=False, editable=False, default=uuid.uuid4, primary_key=True)),
                ('fieldID', models.UUIDField(editable=False, default=uuid.uuid4, db_index=True)),
                ('stringValue', models.CharField(editable=False, null=True, max_length=255, db_index=True)),
                ('index', models.IntegerField(editable=False)),
                ('instance', models.ForeignKey(editable=False, to='consentrecords.Instance')),
                ('transaction', models.ForeignKey(editable=False, to='consentrecords.Transaction')),
            ],
        ),
        migrations.RemoveField(
            model_name='deletedfact',
            name='fact',
        ),
        migrations.RemoveField(
            model_name='deletedfact',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='fact',
            name='transaction',
        ),
        migrations.DeleteModel(
            name='DeletedFact',
        ),
        migrations.DeleteModel(
            name='Fact',
        ),
        migrations.AddField(
            model_name='deletedinstance',
            name='instance',
            field=models.ForeignKey(editable=False, to='consentrecords.Instance'),
        ),
        migrations.AddField(
            model_name='deletedinstance',
            name='transaction',
            field=models.ForeignKey(editable=False, to='consentrecords.Transaction'),
        ),
    ]
