# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('consentrecords', '0003_delete_uuidrecord'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='session',
            name='user',
        ),
        migrations.RemoveField(
            model_name='transaction',
            name='session',
        ),
        migrations.AddField(
            model_name='transaction',
            name='user',
            field=models.ForeignKey(to=settings.AUTH_USER_MODEL, default=111, on_delete=models.CASCADE),
            preserve_default=False,
        ),
        migrations.DeleteModel(
            name='Session',
        ),
    ]
