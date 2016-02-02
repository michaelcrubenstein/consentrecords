# python3 data/01dumping.py 'data/OrganizationNames.txt' michaelcrubenstein@gmail.com

import datetime
import django
import tzlocal
import getpass
import sys
import csv

from django.db import transaction
from django.contrib.auth import authenticate

from functools import reduce

from consentrecords.models import TransactionState, Terms, Instance, Value, UserInfo, AccessRecord, NameList
from consentrecords import pathparser
from consentrecords import instancecreator

def labelGrade(g):
    return 'Grade ' + str(g)

def splitGrades(grades):
    if grades.find(' and ') > 0:
        return reduce(lambda a, b: a + splitGrades(b), grades.split(' and '), [])
    elif grades.find(', ') > 0:
        return reduce(lambda a, b: a + splitGrades(b), grades.split(', '), [])
    elif grades.isdigit():
    	return [labelGrade(grades)]
    elif grades.startswith('K0-') and int(grades[3:]) > 0:
        return ['Kindergarten 0', 'Kindergarten 1', 'Kindergarten 2'] + list(map(labelGrade, range(1, int(grades[3:]) + 1)))
    elif grades.startswith('K1-') and int(grades[3:]) > 0:
        return ['Kindergarten 1', 'Kindergarten 2'] + list(map(labelGrade, range(1, int(grades[3:]) + 1)))
    elif grades.startswith('K2-') and int(grades[3:]) > 0:
        return ['Kindergarten 2'] + list(map(labelGrade, range(1, int(grades[3:]) + 1)))
    else:
        i = grades.find('-')
        if i > 0:
            return list(map(labelGrade, range(int(grades[:i]), int(grades[i+1:])+1)))
        else:
            raise RuntimeError('Invalid grades: %s' % grades)
            
if __name__ == "__main__":
    with transaction.atomic():
        with open(sys.argv[1], 'r') as f:
          with open(sys.argv[2], 'w') as fOut:
            csvWriter = csv.writer(fOut)
            while True:
                name=f.readline().strip();
                leader=f.readline().strip();
                street=f.readline().strip();
                cszip=f.readline().strip();
                grades=f.readline().strip();
                hours=f.readline().strip();
                type=f.readline().strip();
                blank=f.readline().strip();
                if not len(name):
                    break;
                
                if cszip.find(', MA') <= 0:
                    raise RuntimeError('Invalid address line: %s' % cszip)
                gradesLabel = 'Grades Offered: '
                if not grades.startswith(gradesLabel):
                    raise RuntimeError('Invalid grades line: %s' % grades)
                if len(blank):
                    raise RuntimeError('non-blank line: %s' % blank)
                city = cszip[:cszip.find(', MA')]
                grades = grades[len(gradesLabel):]
                
                row = ['Boston Public Schools', name, street, city, 'MA', cszip[-5:]] + splitGrades(grades)
                csvWriter.writerow(row)
                print(name)
