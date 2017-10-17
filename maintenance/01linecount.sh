find . -name '*.py' > r1.txt
find ./consentrecords/static/b/consentrecords -name '*.css' >> r1.txt
find ./consentrecords/static/b/consentrecords -name '*.js' >> r1.txt
find ./consentrecords/templates/b -name '*.html' >> r1.txt

xargs wc -l < r1.txt
rm r1.txt
