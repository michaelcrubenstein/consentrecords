# -*- coding: utf-8 -*-
# Generated by Django 1.11.1 on 2017-12-01 22:19
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('consentrecords', '0086_auto_20170923_1330'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='disqualifyingtag',
            name='deleteTransaction',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtag',
            name='lastTransaction',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtag',
            name='parent',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtag',
            name='service',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtag',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtaghistory',
            name='instance',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtaghistory',
            name='service',
        ),
        migrations.RemoveField(
            model_name='disqualifyingtaghistory',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='deleteTransaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='domain',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='lastTransaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='offering',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='organization',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='site',
        ),
        migrations.RemoveField(
            model_name='experienceprompt',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompthistory',
            name='domain',
        ),
        migrations.RemoveField(
            model_name='experienceprompthistory',
            name='instance',
        ),
        migrations.RemoveField(
            model_name='experienceprompthistory',
            name='offering',
        ),
        migrations.RemoveField(
            model_name='experienceprompthistory',
            name='organization',
        ),
        migrations.RemoveField(
            model_name='experienceprompthistory',
            name='site',
        ),
        migrations.RemoveField(
            model_name='experienceprompthistory',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservice',
            name='deleteTransaction',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservice',
            name='lastTransaction',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservice',
            name='parent',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservice',
            name='service',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservice',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservicehistory',
            name='instance',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservicehistory',
            name='service',
        ),
        migrations.RemoveField(
            model_name='experiencepromptservicehistory',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompttext',
            name='deleteTransaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompttext',
            name='lastTransaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompttext',
            name='parent',
        ),
        migrations.RemoveField(
            model_name='experienceprompttext',
            name='transaction',
        ),
        migrations.RemoveField(
            model_name='experienceprompttexthistory',
            name='instance',
        ),
        migrations.RemoveField(
            model_name='experienceprompttexthistory',
            name='transaction',
        ),
        migrations.AddField(
            model_name='experience',
            name='era',
            field=models.IntegerField(null=True),
        ),
        migrations.AddField(
            model_name='experiencehistory',
            name='era',
            field=models.IntegerField(editable=False, null=True),
        ),
        migrations.DeleteModel(
            name='DisqualifyingTag',
        ),
        migrations.DeleteModel(
            name='DisqualifyingTagHistory',
        ),
        migrations.DeleteModel(
            name='ExperiencePrompt',
        ),
        migrations.DeleteModel(
            name='ExperiencePromptHistory',
        ),
        migrations.DeleteModel(
            name='ExperiencePromptService',
        ),
        migrations.DeleteModel(
            name='ExperiencePromptServiceHistory',
        ),
        migrations.DeleteModel(
            name='ExperiencePromptText',
        ),
        migrations.DeleteModel(
            name='ExperiencePromptTextHistory',
        ),
    ]
