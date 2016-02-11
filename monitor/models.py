from django.db import connection, models
from django.conf import settings

class LogRecord(models.Model):
    creation_time = models.DateTimeField(db_column='creation_time', db_index=True, auto_now_add=True)
    name = models.CharField(max_length=40, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, db_index=True)
    message = models.TextField(null=True)
    
    def emit(user, name, message):
        if user.is_authenticated():
            LogRecord.objects.create(user=user, name=name, message=message)
        else:
            LogRecord.objects.create(user=None, name=name, message=message)

