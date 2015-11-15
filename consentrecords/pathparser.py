from django.db import connection
from django.db import models as dbmodels
from django.conf import settings
from django.utils import timezone

import html.parser
import logging
import re
import string
import uuid
from functools import reduce

from parse.cssparser import parser as cssparser
from consentrecords.models import LazyInstance, LazyValue, Fact, NameList

def _checkCount(sql, item, argList):
    """ 
        item is either a string which is an instance id, or a tuple
        which is a value id and an instance id.
    """ 
    if isinstance(item, str):
        newArgList = [item]
    else:
        newArgList = [item[-1]]
    newArgList.extend(argList)
        
    with connection.cursor() as c:
        c.execute(sql, newArgList)
        return c.fetchone()[0]
    
def _getResultArray(sql, item, argList):
    """ 
        item is either a string which is an instance id, or a tuple
        which is a value id and an instance id.
    """ 
#         logger = logging.getLogger(__name__)
#         logger.error("_getResultArray(%s, %s, %s)" % (sql, str(item), str(argList)))
    if isinstance(item, str):
        newArgList = [item]
    else:
        newArgList = [item[-1]]
    newArgList.extend(argList)
#         logger.error("  newArgList(%s)" % (str(newArgList)))
    with connection.cursor() as c:
        c.execute(sql, newArgList)
        return [i for i in c.fetchall()]
    
def refineResults(resultSet, path):
#     logger = logging.getLogger(__name__)
#     logger.error("refineResults(%s, %s)" % (str(resultSet), path))
    
    if path[0] == '#':
        return [(None, path[1])], path[2:]
    elif path[0] == '[':
        if len(path[1]) == 1:
            sql = 'SELECT COUNT(*) FROM consentrecords_value v1' + \
                  ' WHERE v1.instance_id = %s AND v1.fieldID = %s' + \
                  ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id))'
            fieldID = Fact.getUUIDHex(path[1][0])
            newResults = filter(lambda s: _checkCount(sql, s, [fieldID]), resultSet)
            return list(newResults), path[2:]
        elif len(path[1]) == 3:
            fieldID = Fact.getUUIDHex(path[1][0])
            symbol = path[1][1]
            testValue = path[1][2]
            if symbol == '^=':
                symbol = 'LIKE'
                testValue += '%'
            sql = 'SELECT COUNT(*) FROM consentrecords_value v1' + \
                  ' WHERE v1.instance_id = %s' + \
                  ' AND v1.fieldID = %s AND v1.stringvalue ' + symbol + ' %s' + \
                  ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)'
            newResults = filter(lambda s: _checkCount(sql, s, [fieldID, testValue]), resultSet)
            newList = list(newResults)
#                 logger.error("  list: %s" % str(newList))
            return newList, path[2:]
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
    elif path[0] == '>':
        fieldID = Fact.getUUIDHex(path[1])
        sql = 'SELECT v1.id, v1.stringvalue id' + \
                 ' FROM consentrecords_value v1' + \
                 ' WHERE v1.instance_id = %s AND v1.fieldid = %s' + \
                 ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)' + \
                 ' ORDER BY v1.position'
        m = map(lambda s: _getResultArray(sql, s, [fieldID]), resultSet)
        newResults = [item for sublist in m for item in sublist]
        return newResults, path[2:]         
    elif path[0] == '::':
        function = path[1]
        if function == 'reference':
            if path[2] == '(':
                typeID = Fact.getUUIDHex(path[3][0])
                sql = 'SELECT v1.id, v1.instance_id' + \
                      ' FROM consentrecords_value v1' + \
                      ' JOIN consentrecords_instance i1 ON (i1.id = v1.instance_id)' + \
                      ' WHERE v1.stringvalue = %s AND i1.typeid = %s' + \
                      ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)' + \
                      ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)'
                m = map(lambda s: _getResultArray(sql, s, [typeID]), resultSet)
                newResults = [item for sublist in m for item in sublist]
                return newResults, path[4:]
            else:
                raise ValueError("malformed reference (missing parentheses)")
        else:
            raise ValueError("unrecognized function: %s" % function)
    elif len(path) >= 4 and path[0] == ':' and path[1] == 'not':
        if path[2] == '(':
            if path[3][0] == '[':
                params = path[3][1]
                fieldID = Fact.getUUIDHex(params[0])
                if len(params) == 1:
                    sql = 'SELECT COUNT(*) FROM consentrecords_value v1' + \
                          ' WHERE v1.instance_id = %s AND v1.fieldID = %s' + \
                          ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id))'
                    newResults = filter(lambda s: not _checkCount(sql, s, [fieldID]), resultSet)
                    return list(newResults), path[4:]
                elif len(params) == 3:
                    symbol = params[1]
                    testValue = params[2]
                    if symbol == '^=':
                        symbol = 'LIKE'
                        testValue += '%'
                    sql = 'SELECT COUNT(*) FROM consentrecords_value v1' + \
                          ' WHERE v1.instance_id = %s' + \
                          ' AND v1.fieldID = %s AND v1.stringvalue ' + symbol + ' %s' + \
                          ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedvalue dv WHERE dv.id = v1.id)'
                    newResults = filter(lambda s: not _checkCount(sql, s, [fieldID, testValue]), resultSet)
                    return list(newResults), path[4:]
                else:
                    raise ValueError("unrecognized contents within ':not([...])'")
            else:
                raise ValueError("unimplemented 'not' expression")
        else:
            raise ValueError("malformed 'not' expression")
    else:   # Path[0] is a typeID.
        fieldID = Fact.getUUIDHex(path[0])
        sql = 'SELECT i1.id' + \
                 ' FROM consentrecords_instance i1' + \
                 ' WHERE i1.typeid = %s' + \
                 ' AND NOT EXISTS(SELECT 1 FROM consentrecords_deletedinstance di WHERE di.id = i1.id)'
        with connection.cursor() as c:
            c.execute(sql, [fieldID])
            return [r for r in c.fetchall()], path[1:]

def _getValueFromPair(data, languageID=None):
    if len(data) == 2:
        i = LazyInstance(data[1])
        v = LazyValue(id=data[0], stringValue=data[1])
        return v.clientObject(languageID, i)
    else:
        i = LazyInstance(data[-1])
        return i.clientObject()

# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def selectAllIDs(path, startSet=[]):
    resultSet = [(startSet, path)]
    while len(resultSet[-1][1]) > 0:
        lastPair = resultSet[-1]
        nextPair = refineResults(lastPair[0], lastPair[1])
        resultSet.append(nextPair)
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllIDs result: %s" % str(resultSet[-1][0]))
    return resultSet[-1][0]
           
def selectAllObjects(path):
    resultSet = selectAllIDs(path)
    
#         logger = logging.getLogger(__name__)
#         logger.error("selectAllObjects result: %s" % str(resultSet[-1][0]))
    return [LazyInstance(i[-1]) for i in resultSet]
    
def selectAllDescriptors(path):
    return [_getValueFromPair(i) for i in selectAllIDs(path)]
    
def tokenize(path):
    html_parser = html.parser.HTMLParser()
    unescaped = html_parser.unescape(path)
    tokens = cssparser.tokenize(unescaped)
    a, remainder = cssparser.cascade(tokens)
    return a
