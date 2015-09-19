# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0004_auto_20150901_2021'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeletedFact',
            fields=[
                ('id', models.ForeignKey(editable=False, to='consentrecords.Fact', primary_key=True, serialize=False)),
            ],
        ),
        migrations.AlterField(
            model_name='fact',
            name='transaction',
            field=models.ForeignKey(to='consentrecords.Transaction', editable=False),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='time_zone_offset',
            field=models.SmallIntegerField(editable=False),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='user',
            field=models.ForeignKey(to=settings.AUTH_USER_MODEL, editable=False),
        ),
        migrations.AddField(
            model_name='deletedfact',
            name='transaction',
            field=models.ForeignKey(to='consentrecords.Transaction', editable=False),
        ),
    ]
