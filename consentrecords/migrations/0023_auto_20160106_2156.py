# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0022_value_languagecode'),
    ]

    operations = [
        migrations.CreateModel(
            name='AccessRecord',
            fields=[
                ('id', models.OneToOneField(editable=False, to='consentrecords.Instance', primary_key=True, db_column='id', serialize=False)),
            ],
        ),
        migrations.CreateModel(
            name='Grant',
            fields=[
                ('id', models.OneToOneField(editable=False, to='consentrecords.Instance', primary_key=True, db_column='id', serialize=False)),
            ],
        ),
        migrations.CreateModel(
            name='Grantee',
            fields=[
                ('id', models.OneToOneField(editable=False, to='consentrecords.Grant', primary_key=True, db_column='id', serialize=False)),
                ('instance', models.ForeignKey(editable=False, to='consentrecords.Instance')),
            ],
        ),
        migrations.AddField(
            model_name='grant',
            name='privilege',
            field=models.ForeignKey(editable=False, to='consentrecords.Instance', related_name='privilegeInstances', null=True),
        ),
        migrations.AddField(
            model_name='accessrecord',
            name='source',
            field=models.ForeignKey(to='consentrecords.Instance', related_name='sources'),
        ),
    ]
