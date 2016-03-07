# python3 data/05scrapeSWSG.py data/05scrapeSWSG.html data/scrapeSWSG.txt

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
        data = open(sys.argv[1]).read()
        bs = BeautifulSoup(data,"html5lib")
        with open(sys.argv[2], 'w') as fOut:
            fOut.write('Organization\n')
            fOut.write('    _name: ' + 'Strong Women Strong Girls\n')
            fOut.write('    Sites\n')
            for main in bs.findAll(attrs={'class': re.compile(r".*\blocation-item\b.*")}):
                for link in main.findAll('li'):
                    fOut.write('        Site\n')
                    nameDiv = link.find('a')
                    print(nameDiv.get_text())
                    fOut.write('            _name: ' + nameDiv.get_text() + '\n')
                    # fOut.write('            Web Site: ' + href + '\n')
                    fOut.write('            Address\n')
                    s = link.get_text()[len(nameDiv.get_text()):]
                    a = s.split(',')
                    fOut.write('                Street: ' + a[0].rstrip('*').strip() + '\n')
                    fOut.write('                City: ' + a[1] + '\n')
                    fOut.write('                State: ' + 'MA' + '\n')
                    if len(s) > 2 and s[2].startswith('MA '):
                        fOut.write('                Zip Code: ' + s[2][3:] + '\n')
                    fOut.write('            Offerings\n')
                    fOut.write('                Offering\n')
                    p = 'Strong Women Strong Girls For Girls'
                    fOut.write('                    _name: ' + p + '\n')
                    fOut.write('                    Service: Get A Mentor\n')
                    fOut.write('                    Service: Leadership Skills\n')
                    fOut.write('                    Minimum Grade: 3\n')
                    fOut.write('                    Maximum Grade: 5\n')
                    fOut.write('                Offering\n')
                    p = 'Strong Women Strong Girls For College Women'
                    fOut.write('                    _name: ' + p + '\n')
                    fOut.write('                    Service: Be A Mentor\n')
                    fOut.write('                Offering\n')
                    p = 'Strong Women Strong Girls For Professionals'
                    fOut.write('                    _name: ' + p + '\n')
                    fOut.write('                    Service: Be A Mentor\n')
                    

    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
    print('done')
    
scrape()