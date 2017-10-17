# Copy the contents from the various 'b' directories to the main directories.
# . maintenance/promoteversion.sh

cd $VIRTUAL_ENV/consentrecords

rm -r -v consentrecords/static/consentrecords
cp -R -P -v consentrecords/static/b/consentrecords consentrecords/static/consentrecords

rm -r -v consentrecords/templates/consentrecords
cp -R -P -v consentrecords/templates/b/consentrecords consentrecords/templates/consentrecords

sed -i '' 's/\"b\//\"/g' consentrecords/templates/consentrecords/*.html


