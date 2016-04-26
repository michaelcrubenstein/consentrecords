# python3 data/05scrapeAISNE.py data/scrapeAISNE.txt

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

def readURL(url):
    print('url: %s' % url)
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    data = urlopen(req).read()
    return BeautifulSoup(data,"html5lib")

def scrape():
    try:
        url = 'http://www.aisne.org/membership/directory.html'
        bs = readURL(url)
        with open(sys.argv[1], 'w') as fOut:
            main = bs.find(id="directorytable")
            for entry in main.findAll('tr'):
                cells = entry.findAll('td')
                orgCell = cells[0]
                websiteCell = cells[1]
                mapCell = cells[2]
                bs2 = readURL('http://www.aisne.org%s' % orgCell.find('a').get('href'))
                table = bs2.find(id='school')
                head = table.find('tr', attrs={'class': re.compile(r"head")})
                td = head.find('td', attrs={'class': re.compile(r"detail")})
                p = td.find('p').find('strong')
                address = p.get_text().strip()
                fOut.write('Organization\n')
                fOut.write('    _name: %s\n' % orgCell.get_text().strip())
                fOut.write('    _public access: _read\n')
                fOut.write('    Web Site: %s\n' % websiteCell.find('a').get('href'))
                fOut.write('    Sites\n')
                fOut.write('        Site\n')
                fOut.write('            _name: %s\n' % orgCell.get_text().strip())
                fOut.write('            Address\n')
                a = list(map(lambda s: s.strip(), address.split(',')))
                for street in a[0:-2]:
                    fOut.write('                Street: %s\n' % street)
                fOut.write('                City: %s\n' % a[-2])
                fOut.write('                State: %s\n' % a[-1][0:2])
                zipCode = a[-1][2:].strip()
                if len(zipCode) > 0:
                    fOut.write('                Zip Code: %s\n' % zipCode)
                fOut.write('            Offerings\n')
                trs = table.findAll('tr')
                for tr in trs:
                    tds = tr.findAll('td')
                    if tds[0].get_text().strip() == 'Grades Served' and len(tds[1].get_text().strip()) > 0:
                        gs = tds[1].get_text().strip()
                        g = gs.split('-')
                        for name in g:
                            if name.isdigit():
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: Grade %s\n'%name)
                                fOut.write('                    Service: Grade %s\n'%name)
                            elif name == 'Preschool':
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: %s\n'%name)
                                fOut.write('                    Service: %s\n'%name)
                            elif name == 'Pre':
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: Pre-K\n')
                                fOut.write('                    Service: Preschool\n')
                            elif name == 'Toddler':
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: Toddler\n')
                                fOut.write('                    Service: Preschool\n')
                            elif name == 'Nursery':
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: Nursery\n')
                                fOut.write('                    Service: Preschool\n')
                            elif name == 'K':
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: Kindergarten\n')
                                fOut.write('                    Service: Kindergarten\n')
                            elif name == 'PG':
                                fOut.write('                Offering\n')
                                fOut.write('                    _name: High School Post Graduate\n')
                                fOut.write('                    Service: High School Post Graduate\n')
                            else:
                                print('unrecognized grade: %s' % name)
                            fOut.write('                    Sessions\n')
                            fOut.write('                        Session\n')
                            fOut.write('                            _name: 2016-2017\n')

    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("%s" % traceback.format_exc())
    print('done')
    
scrape()