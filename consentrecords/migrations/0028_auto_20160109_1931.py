# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0027_grant_grantee'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='grant',
            name='instance',
        ),
        migrations.RemoveField(
            model_name='grant',
            name='privilege',
        ),
        migrations.RemoveField(
            model_name='grantee',
            name='grant',
        ),
        migrations.RemoveField(
            model_name='grantee',
            name='instance',
        ),
        migrations.DeleteModel(
            name='Grant',
        ),
        migrations.DeleteModel(
            name='Grantee',
        ),
    ]
