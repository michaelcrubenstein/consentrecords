# Copy the contents from the various 'b' directories to the main directories.
# . maintenance/promoteversion.sh

cd ~/GitHub/consentrecords

rm -r consentrecords/static/consentrecords
cp -R -P consentrecords/static/b/consentrecords consentrecords/static/consentrecords

rm -r consentrecords/templates/consentrecords
cp -R -P consentrecords/templates/b/consentrecords consentrecords/templates/consentrecords

