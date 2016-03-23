# python3 data/05scrapeCitizenSchools.py data/scrapeCitizenSchools.txt

from pathlib import Path
import os
import sys
import json
import logging
import traceback
import uuid
import urllib.parse
import datetime
import re

from bs4 import BeautifulSoup
from urllib.request import Request, urlopen

# http://bostonpublicschools.org//site/UserControls/Minibase/MinibaseListWrapper.aspx?ModuleInstanceID=1824&PageModuleInstanceID=1850&PageIndex=5
def scrape():
    try:
        url = 'http://www.citizenschools.org/massachusetts/locations/'
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        data = urlopen(req).read()
        bs = BeautifulSoup(data,"html5lib")
        with open(sys.argv[1], 'w') as fOut:
            fOut.write('Organization\n')
            fOut.write('    _name: ' + 'Citizen Schools\n')
            fOut.write('    Web Site: ' + 'http://www.citizenschools.org/massachusetts/\n')
            fOut.write('    Sites\n')
            main = bs.find(id="content-main")
            for entry in main.findAll(attrs={'class': re.compile(r".*\bentry-content\b.*")}):
                h2 = entry.find('h2')
                siteName = h2.get_text().strip()
                print(siteName)
                fOut.write('        Site\n')
                fOut.write('            _name: ' + siteName + '\n')
                fOut.write('            Address\n')
                for p1 in entry.findAll('p'):
                    s = p1.get_text().strip().split('\n')
                    a = s[-1].split(',')
                    fOut.write('                Street: ' + s[0].strip().rstrip(',') + '\n')
                    fOut.write('                City: ' + a[0] + '\n')
                    fOut.write('                State: ' + 'MA' + '\n')
                    if len(a) > 1 and a[1].strip().startswith('MA '):
                        fOut.write('                Zip Code: ' + a[1].strip()[3:] + '\n')                    

    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
    print('done')
    
scrape()