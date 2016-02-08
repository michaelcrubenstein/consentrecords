from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch

import html.parser
import logging
from functools import reduce

from parse.cssparser import parser as cssparser
from consentrecords.models import Instance, Value, Terms

def _getSimpleQClause(symbol, testValue):
    if Terms.isUUID(testValue):
        if symbol == '=':
            return Q(value__referenceValue_id=testValue)
        else:
            raise ValueError("unrecognized symbol: %s" & symbol)
    else:
        if symbol == '^=':
            q = Q(value__stringValue__istartswith=testValue)
        elif symbol == '=':
            q = Q(value__stringValue__iexact=testValue)
        elif symbol == '*=':
            q = Q(value__stringValue__icontains=testValue)
        elif symbol == '<':
            q = Q(value__stringValue__lt=testValue)
        elif symbol == '<=':
            q = Q(value__stringValue__lte=testValue)
        elif symbol == '>':
            q = Q(value__stringValue__gt=testValue)
        elif symbol == '>=':
            q = Q(value__stringValue__gte=testValue)
        else:
            raise ValueError("unrecognized symbol: %s" & symbol)
        return q&Q(value__referenceValue__isnull=True)  
        # Handles a degenerate case where a referenceValue was stored in the same place as
        # the stringValue and it happens to match the query string, 

def _getQClause(symbol, testValue):
    if isinstance(testValue, list):
        simples = map(lambda t: _getSimpleQClause(symbol, t), testValue)
        return reduce(lambda q1, q2: q1 | q2, simples)
    else:
        return _getSimpleQClause(symbol, testValue)

def _refineResults(resultSet, path, userInfo):
#     logger = logging.getLogger(__name__)
#     logger.error("_refineResults(%s, %s)" % (str(resultSet), path))
    
    if path[0] == '#':
        return Instance.objects.filter(pk=path[1]), path[2:]
    elif path[0] == '*':
        return Instance.objects.filter(deleteTransaction__isnull=True), path[1:]
    elif path[0] == '[':
        params = path[1]
        if params[0] != '?':
            i = Terms.getInstance(params[0])
        else:
            i = None
        if len(params) == 1:
            f = resultSet.filter(value__field=i, value__deleteTransaction__isnull=True)
        elif len(params) == 3 or (len(params) == 4 and params[2]==','):
            # Get a Q clause that compares either a single test value or a comma-separated list of test values
            # according to the specified symbol.
            stringText = _getQClause(symbol=params[1], testValue=params[-1])
            
            # Need to add distinct after the tests to prevent duplicates if there is
            # more than one value of the instance that matches.
            if i:
                f = resultSet.filter(stringText, value__field=i,
                                     value__deleteTransaction__isnull=True).distinct()
            else:
                f = resultSet.filter(stringText,
                                     value__deleteTransaction__isnull=True).distinct()
        else:
            raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
        return f, path[2:]
    elif path[0] == '>':
        i = Terms.getInstance(path[1])
        f = Instance.objects.filter(referenceValues__instance__in=userInfo.findFilter(resultSet),
                                    referenceValues__field=i,
                                    referenceValues__deleteTransaction__isnull=True)\
                            .order_by('parent', 'parentValue__position')
        return f, path[2:]         
    elif path[0] == '::':
        function = path[1]
        if function == 'reference':
            if path[2] == '(':
                if path[3][0] == ',':
                    t = map(Terms.getInstance, path[3][1])
                    f = Instance.objects.filter(typeID__in=t,
                                                value__deleteTransaction__isnull=True,
                                                value__referenceValue__in=userInfo.findFilter(resultSet))
                else:
                    t = Terms.getInstance(path[3][0])
                    f = Instance.objects.filter(Q(value__deleteTransaction__isnull=True)&\
                                                Q(value__referenceValue__in=userInfo.findFilter(resultSet)),
                                                typeID=t,
                                               )
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
                    f = resultSet.filter(~(Q(value__field=i)&Q(value__deleteTransaction__isnull=True)))
                    return f, path[4:]
                elif len(params) == 3:
                    symbol = params[1]
                    testValue = params[2]
                    stringText=_getQClause(symbol, testValue)
                    f = resultSet.filter(~(Q(value__field=i)&
                                           Q(value__deleteTransaction__isnull=True)&
                                           stringText))
                    return f, path[4:]
                else:
                    raise ValueError("unrecognized contents within ':not([...])'")
            else:
                raise ValueError("unimplemented 'not' expression")
        else:
            raise ValueError("malformed 'not' expression")
    elif path[0] == '(': # Path[1] is a list of type IDs.
        if path[1][0] == ',':
            t = map(Terms.getInstance, path[1][1])
            f = Instance.objects.filter(typeID__in=t,
                                        deleteTransaction__isnull=True)
        else:
            t = Terms.getInstance(path[1][0])
            f = Instance.objects.filter(typeID=t,
                                        deleteTransaction__isnull=True)
        return f, path[2:]
    else:   # Path[0] is a typeID.
        i = Terms.getInstance(path[0])
        f = Instance.objects.filter(typeID=i, deleteTransaction__isnull=True)
        return f, path[1:]

def _tokenize(path):
    html_parser = html.parser.HTMLParser()
    unescaped = html_parser.unescape(path)
    tokens = cssparser.tokenize(unescaped)
    a, remainder = cssparser.cascade(tokens)
    return a

# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def selectAllObjects(path, startSet=[], userInfo=None, securityFilter=None):
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects path: %s" % str(path))
    a = _tokenize(path)
    resultSet = [(startSet, a)]
    while len(resultSet[-1][1]) > 0:
        lastPair = resultSet[-1]
        nextPair = _refineResults(lastPair[0], lastPair[1], userInfo)
        resultSet.append(nextPair)
    return securityFilter(resultSet[-1][0]).distinct()
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects result: %s" % (str(resultSet[-1][0])))
#     logger.error("selectAllObjects result for %s: %s" % (userInfo.authUser, str(f)))
           
