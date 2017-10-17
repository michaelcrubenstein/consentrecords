# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0006_auto_20150903_0159'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deletedfact',
            name='id',
            field=models.ForeignKey(to='consentrecords.Fact', editable=False, serialize=False, primary_key=True, on_delete=models.CASCADE),
        ),
    ]
