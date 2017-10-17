cd ~/eb_django_app/
. prod/bin/activate
cd prod/consentrecords
export DJANGO_SETTINGS_MODULE=consentrecords.settings
export PYTHONPATH=/home/ubuntu/eb_django_app/prod/lib/python3.5
export PYTHONPATH=/home/ubuntu/eb_django_app/prod/lib/python3.5/site-packages:$PYTHONPATH
export PYTHONPATH=/home/ubuntu/eb_django_app/prod/consentrecords:$PYTHONPATH
export PYTHONPATH=/home/ubuntu/eb_django_app/prod/consentrecords/consentrecords:$PYTHONPATH

python3 reports/05campaign1data.py -start '2016-01-01'

