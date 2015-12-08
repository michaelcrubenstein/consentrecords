# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0020_auto_20151117_2100'),
    ]

    operations = [
        migrations.AddField(
            model_name='instance',
            name='parentValue',
            field=models.OneToOneField(related_name='valueChild', to='consentrecords.Value', null=True),
        ),
    ]
