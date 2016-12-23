# script to promote the 'b' testbed to the main
# . scripts/promotetestbed.sh

rm -r consentrecords/static/consentrecords
cp -r consentrecords/static/b/consentrecords consentrecords/static

rm -r consentrecords/templates/consentrecords
cp -r consentrecords/templates/b/consentrecords consentrecords/templates

find consentrecords/templates/consentrecords/*.html -type f -exec sed -i .bk 's/"b\//"/g' {} \;
rm consentrecords/templates/consentrecords/*.html.bk


