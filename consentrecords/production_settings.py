DATABASES = {
    'default': {
        'ENGINE': 'consentrecords.mysql.connector.django',
        'NAME': 'btcdb',
        'USER': 'admin',
        'PASSWORD': 'goLdXS1OPHj7',
        'HOST': 'btcdbproduction.cgbhphj40gae.us-east-1.rds.amazonaws.com',   # Or an IP Address that your DB is hosted on
        'PORT': '3306',
        'OPTIONS': {
          'autocommit': True,
        },
    }
}

