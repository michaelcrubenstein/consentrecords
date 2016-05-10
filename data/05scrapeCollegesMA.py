# python3 data/05scrapeCollegesMA.py data/scrapeCollegesMA.txt

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

def scrape():
    try:
        url = 'http://www.masshome.com/univ.html'
        data = request.urlopen(url).read()
        bs = BeautifulSoup(data,"html5lib")
        with open(sys.argv[1], 'w') as fOut:
            for table in bs.findAll('table')[2:-6]:
                for main in table.findAll('a'):
                    href = main.get('href')
                    if href and href[0:4] == 'http' and not main.find('img'):
                        print(href)
                        name = main.get_text().strip()
                        try:
                            index = name.index(' - ')
                            if index > 0:
                                city = name[index + 3:]
                                name = name[:index]
                                state = 'MA'
                        except ValueError:
                            index = -1
                        fOut.write('Organization\n')
                        fOut.write('    _name: %s\n' % name)
                        fOut.write('    Web Site: %s\n' % href)
                        fOut.write('    _public access: _read\n')
                        fOut.write('    Sites\n')
                        if index > 0:
                            fOut.write('        Site\n')
                            fOut.write('            _name: %s\n' % name)
                            fOut.write('            Address\n')
                            fOut.write('                City: %s\n' % city)
                            fOut.write('                State: %s\n' % state)
                    

    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
    print('done')
    
scrape()