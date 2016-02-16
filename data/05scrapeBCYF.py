# python3 data/05scrapeBCYF.py data/scrapeBCYF.txt

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
from urllib import request

# http://bostonpublicschools.org//site/UserControls/Minibase/MinibaseListWrapper.aspx?ModuleInstanceID=1824&PageModuleInstanceID=1850&PageIndex=5
def scrape():
    try:
        url = 'http://www.cityofboston.gov/BCYF/centers/'
        data = request.urlopen(url).read()
        bs = BeautifulSoup(data,"html5lib")
        with open(sys.argv[1], 'w') as fOut:
            fOut.write('Organization\n')
            fOut.write('    _name: ' + 'BCYF\n')
            fOut.write('    Sites\n')
            main = bs.find(attrs={'class': re.compile(r".*\bcontent_main_sub\b.*")})
            for link in main.findAll('a'):
                href = link.get('href')
                sitesoup = BeautifulSoup(request.urlopen(href).read(), 'html5lib')
                fOut.write('        Site\n')
                contentDiv = sitesoup.find(attrs={'class': re.compile(r".*\bfloat_150.*")})
                h2 = contentDiv.find('h2')
                print(h2.get_text())
                fOut.write('            _name: ' + h2.get_text()[5:] + '\n')
                fOut.write('            Web Site: ' + href + '\n')
                fOut.write('            Address\n')
                for p1 in contentDiv.findAll('p'):
                    s = p1.get_text().strip().split('\n')[0]
                    if len(s) > 0:
                        a = s.split(',')
                        fOut.write('                Street: ' + a[0].rstrip('*') + '\n')
                        fOut.write('                City: ' + a[1] + '\n')
                        fOut.write('                State: ' + 'MA' + '\n')
                        if len(s) > 2 and s[2].startswith('MA '):
                            fOut.write('                Zip Code: ' + s[2][3:] + '\n')
                        break
                fOut.write('            Offerings\n')
                contentDiv = sitesoup.find(attrs={'class': re.compile(r".*content_main_sub.*")})
                foundPrograms = False
                for p1 in contentDiv.findAll('p'):
                    s = p1.get_text().strip()
                    if s.startswith('Programs'):
                        foundPrograms = True
                    elif s.startswith('To learn more'):
                        foundPrograms = False
                    elif foundPrograms:
                        for p in s.split('\n'):
                             if len(p)>0: 
                                 fOut.write('                Offering\n')
                                 fOut.write('                    _name: ' + p + '\n')
                # Some sites, like Quincy, organize by lists. 
                for h4 in contentDiv.findAll('h4'):
                    if h4.get_text().strip() == 'Programs:':
                        for li in h4.next_sibling.findAll('li'):
                            s = li.get_text().strip()
                            fOut.write('                Offering\n')
                            fOut.write('                    _name: ' + s + '\n')
                    

    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
    print('done')
    
scrape()