# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import uuid

class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0006_require_contenttypes_0002'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuthUser',
            fields=[
                ('password', models.CharField(verbose_name='password', max_length=128)),
                ('last_login', models.DateTimeField(verbose_name='last login', blank=True, null=True)),
                ('is_superuser', models.BooleanField(verbose_name='superuser status', help_text='Designates that this user has all permissions without explicitly assigning them.', default=False)),
                ('id', models.UUIDField(default=uuid.uuid4, serialize=False, primary_key=True, editable=False)),
                ('email', models.EmailField(verbose_name='email address', unique=True, max_length=255, db_index=True)),
                ('first_name', models.CharField(max_length=30, blank=True, null=True)),
                ('last_name', models.CharField(max_length=50, blank=True, null=True)),
                ('date_joined', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('groups', models.ManyToManyField(related_query_name='user', verbose_name='groups', to='auth.Group', help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', blank=True, related_name='user_set')),
                ('user_permissions', models.ManyToManyField(related_query_name='user', verbose_name='user permissions', to='auth.Permission', help_text='Specific permissions for this user.', blank=True, related_name='user_set')),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='PasswordReset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, serialize=False, primary_key=True, editable=False)),
                ('email', models.EmailField(verbose_name='email address', max_length=255, db_index=True)),
                ('creation_time', models.DateTimeField(db_index=True, db_column='creation_time', auto_now_add=True)),
            ],
        ),
    ]
