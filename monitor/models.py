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

    def getRecords():
        with connection.cursor() as c:
            sql = "SELECT r.creation_time, r.name, u.email, r.message" + \
                  " FROM monitor_logrecord r LEFT OUTER JOIN custom_user_authuser u ON u.id = r.user_id" + \
                  " ORDER BY r.creation_time"
            c.execute(sql, [])
            results = []
            for i in c.fetchall():
                r = {'time': i[0], 'name': i[1]}
                if i[2] is not None:
                    r['email'] = i[2]
                if i[3] is not None:
                    r['message'] = i[3]
                results.append(r)
            return results
