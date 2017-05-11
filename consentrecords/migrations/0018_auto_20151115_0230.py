# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0017_auto_20151114_2123'),
    ]

    operations = [
        migrations.AlterField(
            model_name='instance',
            name='parent',
            field=models.ForeignKey(editable=False, null=True, related_name='parentInstance', to='consentrecords.Instance', db_column='parentid', on_delete=models.CASCADE),
        ),
        migrations.AlterField(
            model_name='instance',
            name='typeID',
            field=models.ForeignKey(editable=False, related_name='typeInstance', db_column='typeid', to='consentrecords.Instance', on_delete=models.CASCADE),
        ),
    ]
