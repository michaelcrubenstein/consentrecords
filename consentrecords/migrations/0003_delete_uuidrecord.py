# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0002_auto_20150901_1923'),
    ]

    operations = [
        migrations.DeleteModel(
            name='UUIDRecord',
        ),
    ]
