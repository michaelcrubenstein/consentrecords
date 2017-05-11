# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0031_auto_20160117_1813'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='description',
            name='language',
        ),
        migrations.AlterField(
            model_name='description',
            name='instance',
            field=models.OneToOneField(to='consentrecords.Instance', editable=False, on_delete=models.CASCADE),
        ),
    ]
