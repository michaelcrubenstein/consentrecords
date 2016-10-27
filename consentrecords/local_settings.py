# Database
# https://docs.djangoproject.com/en/1.8/ref/settings/#databases
#
# To reset the password:
# > mysql -u root -p
# mysql> SET PASSWORD = PASSWORD('XXXXXXXX');
# > exit

DEBUG = True

DATABASES = {
    'default': {
        'ENGINE': 'consentrecords.mysql.connector.django',
        'NAME': 'consentrecordsdev',
        'USER': 'root',
        'PASSWORD': 'fretOut4039',
        'HOST': '127.0.0.1',   # Or an IP Address that your DB is hosted on
        'PORT': '3306',
        'OPTIONS': {
          'autocommit': True,
          'charset': 'utf8',
        },
    },
}

