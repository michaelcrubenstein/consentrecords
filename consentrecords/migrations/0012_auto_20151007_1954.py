# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0011_auto_20151004_1232'),
    ]

    operations = [
        migrations.AlterField(
            model_name='instance',
            name='parentID',
            field=models.ForeignKey(db_column='parentid', editable=False, to='consentrecords.Instance', null=True),
        ),
    ]
