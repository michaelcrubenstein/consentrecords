##################################################################
# Commands to run when prod server starts to prep for running scripts.
##################################################################

cd eb_django_app/
. prod/bin/activate
cd prod/consentrecords
export DJANGO_SETTINGS_MODULE=consentrecords.settings
export PYTHONPATH=~/eb_django_app/prod/lib/python3.4/site-packages
export PYTHONPATH=~/eb_django_app/prod/consentrecords:$PYTHONPATH
export PYTHONPATH=~/eb_django_app/prod/consentrecords/consentrecords:$PYTHONPATH
