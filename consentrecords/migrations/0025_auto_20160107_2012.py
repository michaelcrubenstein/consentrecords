# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0024_auto_20160107_2010'),
    ]

    operations = [
        migrations.AlterField(
            model_name='grant',
            name='instance',
            field=models.ForeignKey(to='consentrecords.Instance', editable=False),
        ),
        migrations.AlterField(
            model_name='grant',
            name='privilege',
            field=models.ForeignKey(to='consentrecords.Instance', editable=False, related_name='privilegeInstances'),
        ),
        migrations.AlterField(
            model_name='grantee',
            name='grant',
            field=models.ForeignKey(to='consentrecords.Grant', editable=False),
        ),
        migrations.AlterField(
            model_name='grantee',
            name='instance',
            field=models.ForeignKey(to='consentrecords.Instance', editable=False),
        ),
    ]
