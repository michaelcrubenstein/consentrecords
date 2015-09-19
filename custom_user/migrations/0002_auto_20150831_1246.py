# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('custom_user', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='authuser',
            name='id',
            field=models.UUIDField(default=uuid.uuid4, serialize=False, primary_key=True, editable=False),
        ),
        migrations.AlterField(
            model_name='passwordreset',
            name='id',
            field=models.UUIDField(default=uuid.uuid4, serialize=False, primary_key=True, editable=False),
        ),
    ]
