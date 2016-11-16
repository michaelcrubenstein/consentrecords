"""
Django settings for consentrecords project.

Generated by 'django-admin startproject' using Django 1.8.3.

For more information on this file, see
https://docs.djangoproject.com/en/1.8/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/1.8/ref/settings/
"""

# Build paths inside the project like this: os.path.join(BASE_DIR, ...)
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/1.8/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'n2osd(3t797pz590^92^)9(crh_+p!lvu0_tn)_72u!_#aal@-'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = False

ALLOWED_HOSTS = [ '*' ]


# Application definition

INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'oauth2_provider',
    'corsheaders',
    'consentrecords',
    'custom_user',
    'developer',
    'monitor',
)

AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'oauth2_provider.backends.OAuth2Backend',
)

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.auth.middleware.SessionAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'oauth2_provider.middleware.OAuth2TokenMiddleware',
)

ROOT_URLCONF = 'consentrecords.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'consentrecords.wsgi.application'

# Internationalization
# https://docs.djangoproject.com/en/1.8/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True

CORS_ORIGIN_ALLOW_ALL = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = (
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    )
CORS_ALLOW_HEADERS = (
    'x-requested-with',
    'content-type',
    'accept',
    'accept-encoding',
    'origin',
    'authorization',
    'x-csrftoken'
)
CORS_EXPOSE_HEADERS = (
    'Access-Control-Allow-Origin: *',
)

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/1.8/howto/static-files/

STATIC_URL = '/static/'

STATIC_ROOT= os.path.join(BASE_DIR, 'static')

# Auth User Model
AUTH_USER_MODEL = 'custom_user.AuthUser'

EMAIL_USE_TLS = True
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_HOST_USER = 'consentrecordsinfo@gmail.com'
EMAIL_HOST_PASSWORD = 'Hu7RHmjvNw7f'

EMAIL_HOST = 'email-smtp.us-east-1.amazonaws.com'
EMAIL_HOST_USER = 'AKIAJ54SH5JVAJ73Y7VQ'
EMAIL_HOST_PASSWORD = '1/SPSGAaIIUxrSMMBM7MvnFTKhFh+b0WLdqfrRXV'

# Email address of the sender of emails.
PASSWORD_RESET_SENDER = r'info@pathadvisor.com'

# Path of the web page to reset the password of a user.
PASSWORD_RESET_PATH = r'/user/passwordreset/'

# Path of the web page to accept a follower.
ACCEPT_FOLLOWER_PATH = r'/accept/'

# Path of the web page to ignore a follower.
IGNORE_FOLLOWER_PATH = r'/ignore/'

CR_TOKEN_URL = r'http://localhost:8000/o/token/'
CR_GETUSERID_URL = r'http://localhost:8000/getuserid'
CR_REDIRECT_URL = r'http://localhost:8000/'
CR_REQ_HOST = r'http://localhost:8000/'
CR_CLIENT_ID = b'JYXSrHWpBLvVbiOUmJs98XbYbwiG4YwNyBS30IJQ'
CR_SECRET_ID = b'vX9uEtloHxt0c2YeIU1ayQyxBAcvCYzzONr8NIILwssX62HIBof37dTURtPJIEibNQAQqTB3HmZOimQc2b81AlRjeVS1XR7wkPzxtdxv71lG1VTqHtsS49PxXDDeHZvy'

FACEBOOK_SHOW = False

from consentrecords.local_settings import *
