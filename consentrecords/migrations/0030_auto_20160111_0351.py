# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0029_auto_20160109_1950'),
    ]

    operations = [
        migrations.AddField(
            model_name='instance',
            name='deleteTransaction',
            field=models.ForeignKey(to='consentrecords.Transaction', null=True, related_name='deletedInstance', on_delete=models.CASCADE),
        ),
        migrations.AddField(
            model_name='value',
            name='deleteTransaction',
            field=models.ForeignKey(to='consentrecords.Transaction', null=True, related_name='deletedValue', on_delete=models.CASCADE),
        ),
    ]
