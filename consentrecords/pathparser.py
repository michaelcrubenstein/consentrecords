from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch

import html.parser
import logging
from functools import reduce

from parse.cssparser import parser as cssparser
from consentrecords.models import Instance, Value, Terms

def refineResults(resultSet, path):
#     logger = logging.getLogger(__name__)
#     logger.error("refineResults(%s, %s)" % (str(resultSet), path))
    
    if path[0] == '#':
        return Instance.objects.filter(pk=path[1]), path[2:]
    elif path[0] == '*':
    	return Instance.objects.filter(deletedinstance__isnull=True)
    elif path[0] == '[':
        params = path[1]
        if params[0] != '?':
            i = Terms.getInstance(params[0])
        else:
            i = None
        if len(params) == 1:
            f = resultSet.filter(value__fieldID=i, value__deletedvalue__isnull=True)
        elif len(params) == 3:
            symbol = params[1]
            testValue = params[2]
            if symbol == '^=':
                stringText = Q(value__stringValue__istartswith=testValue)
            elif symbol == '=':
                stringText = Q(value__stringValue__iexact=testValue)
            elif symbol == '*=':
                stringText = Q(value__stringValue__icontains=testValue)
            elif symbol == '<':
                stringText = Q(value__stringValue__lt=testValue)
            elif symbol == '<=':
                stringText = Q(value__stringValue__lte=testValue)
            elif symbol == '>':
                stringText = Q(value__stringValue__gt=testValue)
            elif symbol == '>=':
                stringText = Q(value__stringValue__gte=testValue)
            else:
                raise ValueError("unrecognized symbol: %s" & symbol)
            if i:
                f = resultSet.filter(stringText, value__fieldID=i,
                                     value__deletedvalue__isnull=True)
            else:
                f = resultSet.filter(stringText,
                                     value__deletedvalue__isnull=True)
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
        return f, path[2:]
    elif path[0] == '>':
        i = Terms.getInstance(path[1])
        f = Instance.objects.filter(referenceValues__instance__in=resultSet,
                                    referenceValues__fieldID=i,
                                    referenceValues__deletedvalue__isnull=True)\
                            .order_by('parent', 'parentValue__position')
        return f, path[2:]         
    elif path[0] == '::':
        function = path[1]
        if function == 'reference':
            if path[2] == '(':
                t = Terms.getInstance(path[3][0])
                f = Instance.objects.filter(typeID=t,
                                            value__deletedvalue__isnull=True,
                                            value__referenceValue__in=resultSet)
                return f, path[4:]
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
                    f = resultSet.filter(~(Q(value__fieldID=i)&Q(value__deletedvalue__isnull=True)))
                    return f, path[4:]
                elif len(params) == 3:
                    symbol = params[1]
                    testValue = params[2]
                    if symbol == '^=':
                        stringText = Q(value__stringValue__istartswith=testValue)
                    elif symbol == '=':
                        stringText = Q(value__stringValue__iexact=testValue)
                    elif symbol == '*=':
                        stringText = Q(value__stringValue__icontains=testValue)
                    elif symbol == '<':
                        stringText = Q(value__stringValue__lt=testValue)
                    elif symbol == '<=':
                        stringText = Q(value__stringValue__lte=testValue)
                    elif symbol == '>':
                        stringText = Q(value__stringValue__gt=testValue)
                    elif symbol == '>=':
                        stringText = Q(value__stringValue__gte=testValue)
                    else:
                        raise ValueError("unrecognized symbol: %s" % symbol)
                    f = resultSet.filter(~(Q(value__fieldID=i)&
                                           Q(value__deletedvalue__isnull=True)&
                                           stringText))
                    return f, path[4:]
                else:
                    raise ValueError("unrecognized contents within ':not([...])'")
            else:
                raise ValueError("unimplemented 'not' expression")
        else:
            raise ValueError("malformed 'not' expression")
    else:   # Path[0] is a typeID.
        i = Terms.getInstance(path[0])
        f = Instance.objects.filter(typeID=i, deletedinstance__isnull=True)
        return f, path[1:]

# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def selectAllObjects(path, limit=0, startSet=[]):
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects path: %s" % str(path))
    resultSet = [(startSet, path)]
    while len(resultSet[-1][1]) > 0:
        lastPair = resultSet[-1]
        nextPair = refineResults(lastPair[0], lastPair[1])
        resultSet.append(nextPair)
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects result: %s" % str(resultSet[-1][0]))
    if limit > 0:
        return resultSet[-1][0][:limit]
    else:
        return resultSet[-1][0]
           
def selectAllDescriptors(path, limit=0, language=None):
    return [i.clientObject(language) for i in selectAllObjects(path, limit=limit)]
    
def tokenize(path):
    html_parser = html.parser.HTMLParser()
    unescaped = html_parser.unescape(path)
    tokens = cssparser.tokenize(unescaped)
    a, remainder = cssparser.cascade(tokens)
    return a
