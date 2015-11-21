# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0018_auto_20151115_0230'),
    ]

    operations = [
        migrations.AlterField(
            model_name='instance',
            name='parent',
            field=models.ForeignKey(db_column='parentid', null=True, editable=False, to='consentrecords.Instance', related_name='child'),
        ),
    ]
