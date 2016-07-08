# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0037_containment'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='transaction',
            name='time_zone_offset',
        ),
    ]
