from django.db import models as dbmodels

import html.parser
import logging
from functools import reduce

from parse.cssparser import parser as cssparser
from consentrecords.models import Instance, Value, Terms

def refineResults(resultSet, path):
#     logger = logging.getLogger(__name__)
#     logger.error("refineResults(%s, %s)" % (str(resultSet), path))
    
    if path[0] == '#':
        return [[Instance.objects.get(pk=path[1])]], path[2:]
    elif path[0] == '[':
        if len(path[1]) == 1:
            i = Terms.getInstance(path[1][0])
            f = lambda s: s[-1].value_set.filter(fieldID=i,deletedvalue__isnull=True).count()
            newResults = filter(f, resultSet)
            return list(newResults), path[2:]
        elif len(path[1]) == 3:
            i = Terms.getInstance(path[1][0])
            symbol = path[1][1]
            testValue = path[1][2]
            if symbol == '^=':
                f = lambda s: s[-1].value_set.filter(fieldID=i, deletedvalue__isnull=True,
                    stringValue__startswith=testValue).count()
            elif symbol == '=':
                f = lambda s: s[-1].value_set.filter(fieldID=i, deletedvalue__isnull=True,
                    stringValue__exact=testValue).count()
            else:
                raise ValueError("unrecognized symbol: %s" & symbol)
            newResults = filter(f, resultSet)
            newList = list(newResults)
#                 logger.error("  list: %s" % str(newList))
            return newList, path[2:]
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
    elif path[0] == '>':
        i = Terms.getInstance(path[1])
        f = lambda s: map(lambda v: (v, v.referenceValue),
                          s[-1].value_set.filter(fieldID=i, deletedvalue__isnull=True).order_by('position'))
        m = map(f, resultSet)
        newResults = [item for sublist in m for item in sublist]
        return newResults, path[2:]         
    elif path[0] == '::':
        function = path[1]
        if function == 'reference':
            if path[2] == '(':
                t = Terms.getInstance(path[3][0])
                f = lambda s: map(lambda v: [v.instance],
                                  s[-1].referenceValues.filter(instance__typeID=t, deletedvalue__isnull=True))
                m = map(f, resultSet)
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
                i = Terms.getInstance(params[0])
                if len(params) == 1:
                    f = lambda s: s[-1].value_set.filter(fieldID=i,deletedvalue__isnull=True).count() == 0
                    newResults = filter(f, resultSet)
                    return list(newResults), path[4:]
                elif len(params) == 3:
                    symbol = params[1]
                    testValue = params[2]
                    if symbol == '^=':
                        f = lambda s: s[-1].value_set.filter(fieldID=i, deletedvalue__isnull=True,
                            stringValue__startswith=testValue).count() == 0
                    elif symbol == '=':
                        f = lambda s: s[-1].value_set.filter(fieldID=i, deletedvalue__isnull=True,
                            stringValue__exact=testValue).count() == 0
                    else:
                        raise ValueError("unrecognized symbol: %s" & symbol)
                    newResults = filter(f, resultSet)
                    return list(newResults), path[4:]
                else:
                    raise ValueError("unrecognized contents within ':not([...])'")
            else:
                raise ValueError("unimplemented 'not' expression")
        else:
            raise ValueError("malformed 'not' expression")
    else:   # Path[0] is a typeID.
        i = Terms.getInstance(path[0])
        return [[r] for r in i.typeInstances.filter(deletedinstance__isnull=True)], path[1:]

def _getValueFromPair(data, language=None):
    if len(data) == 2:
        i = data[1]
        v = data[0]
        if v:
            return v.clientObject(language)
        else:
            return i.clientObject(language)
    else:
        i = data[-1]
        return i.clientObject(language)

# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def selectAllIDs(path, startSet=[]):
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllIDs path: %s" % str(path))
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
    return [i[-1] for i in resultSet]
    
def selectAllDescriptors(path):
    return [_getValueFromPair(i) for i in selectAllIDs(path)]
    
def tokenize(path):
    html_parser = html.parser.HTMLParser()
    unescaped = html_parser.unescape(path)
    tokens = cssparser.tokenize(unescaped)
    a, remainder = cssparser.cascade(tokens)
    return a
