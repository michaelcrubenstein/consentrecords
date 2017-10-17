# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0019_auto_20151117_1943'),
    ]

    operations = [
        migrations.AddField(
            model_name='value',
            name='referenceValue',
            field=models.ForeignKey(null=True, editable=False, to='consentrecords.Instance', related_name='referenceValues', on_delete=models.CASCADE),
        ),
        migrations.AlterField(
            model_name='instance',
            name='parent',
            field=models.ForeignKey(null=True, editable=False, to='consentrecords.Instance', db_column='parentid', related_name='children', on_delete=models.CASCADE),
        ),
        migrations.AlterField(
            model_name='instance',
            name='typeID',
            field=models.ForeignKey(editable=False, to='consentrecords.Instance', db_column='typeid', related_name='typeInstances', on_delete=models.CASCADE),
        ),
        migrations.AlterField(
            model_name='value',
            name='fieldID',
            field=models.ForeignKey(editable=False, to='consentrecords.Instance', db_column='fieldid', related_name='fieldValues', on_delete=models.CASCADE),
        ),
    ]
