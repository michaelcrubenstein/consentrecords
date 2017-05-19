# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-05-18 18:08
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0041_auto_20170518_1756'),
    ]

    operations = [
        migrations.CreateModel(
            name='TagSource',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='sources', to='consentrecords.Instance')),
                ('target', models.ForeignKey(editable=False, on_delete=django.db.models.deletion.CASCADE, related_name='targets', to='consentrecords.Instance')),
            ],
        ),
        migrations.AddIndex(
            model_name='tagsource',
            index=models.Index(fields=['source', 'target'], name='consentreco_source__1e9aae_idx'),
        ),
        migrations.AddIndex(
            model_name='tagsource',
            index=models.Index(fields=['target', 'source'], name='consentreco_target__eaa362_idx'),
        ),
    ]
