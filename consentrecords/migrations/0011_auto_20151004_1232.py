# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0010_auto_20151004_1210'),
    ]

    operations = [
        migrations.RenameField(
            model_name='value',
            old_name='index',
            new_name='position',
        ),
    ]
