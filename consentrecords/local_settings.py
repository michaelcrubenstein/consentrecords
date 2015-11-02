# Database
# https://docs.djangoproject.com/en/1.8/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'consentrecords.mysql.connector.django',
        'NAME': 'consentrecordsdev',
        'USER': 'root',
        'PASSWORD': 'fretOut9867',
        'HOST': '127.0.0.1',   # Or an IP Address that your DB is hosted on
        'PORT': '3306',
        'OPTIONS': {
          'autocommit': True,
          'charset': 'utf8',
        },
    },
}

