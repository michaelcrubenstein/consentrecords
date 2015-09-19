# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0005_auto_20150903_0158'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deletedfact',
            name='id',
            field=models.OneToOneField(to='consentrecords.Fact', editable=False, primary_key=True, serialize=False),
        ),
    ]
