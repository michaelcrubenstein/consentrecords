from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch
from django.contrib.auth.models import AnonymousUser

import html.parser
import logging
from functools import reduce

from parse.cssparser import parser as cssparser
from consentrecords.models import Instance, Value, Terms, terms, UserInfo

def _getValueFilter(field, symbol, testValue):
    if terms.isUUID(testValue):
        if symbol == '=':
            vFilter = Value.objects.filter(referenceValue_id=testValue)
        else:
            raise ValueError("unrecognized symbol: %s" & symbol)
    else:
        if symbol == '^=':
            vFilter = Value.objects.filter(Q(stringValue__istartswith=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__istartswith=testValue))
        elif symbol == '=':
            vFilter = Value.objects.filter(Q(stringValue__iexact=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__iexact=testValue))
        elif symbol == '*=':
            vFilter = Value.objects.filter(Q(stringValue__icontains=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__icontains=testValue))
        elif symbol == '<':
            vFilter = Value.objects.filter(Q(stringValue__lt=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__lt=testValue))
        elif symbol == '<=':
            vFilter = Value.objects.filter(Q(stringValue__lte=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__lte=testValue))
        elif symbol == '>':
            vFilter = Value.objects.filter(Q(stringValue__gt=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__gt=testValue))
        elif symbol == '>=':
            vFilter = Value.objects.filter(Q(stringValue__gte=testValue,referenceValue__isnull=True)|
                                           Q(referenceValue__description__text__gte=testValue))
        else:
            raise ValueError("unrecognized symbol: %s"%symbol)
    vFilter = vFilter.filter(deleteTransaction__isnull=True)
    return vFilter.filter(field=field) if field else vFilter

def _getSimpleQClause(field, symbol, testValue):
    vFilter = _getValueFilter(field, symbol, testValue)
    return Q(value__in=vFilter)

def _getQClause(field, symbol, testValue):
    if isinstance(testValue, list):
        simples = map(lambda t: _getSimpleQClause(field, symbol, t), testValue)
        return reduce(lambda q1, q2: q1 | q2, simples)
    else:
        return _getSimpleQClause(field, symbol, testValue)

def _excludeByField(resultSet, field, symbol, testValue):
    if isinstance(testValue, list):
        f = resultSet
        for test in testValue:
            vFilter = _getValueFilter(field, symbol, test)
            f = f.exclude(value__in=vFilter)
        return f
    else:
        vFilter = _getValueFilter(field, symbol, testValue)
        return resultSet.exclude(value__in=vFilter)           

def _getSimpleAncestorClause(symbol, testValue):
    if symbol == '^=':
        q = Q(ancestors__ancestor__value__stringValue__istartswith=testValue)
    elif symbol == '=':
        q = Q(ancestors__ancestor__value__stringValue__iexact=testValue)
    elif symbol == '*=':
        q = Q(ancestors__ancestor__value__stringValue__icontains=testValue)
    elif symbol == '<':
        q = Q(ancestors__ancestor__value__stringValue__lt=testValue)
    elif symbol == '<=':
        q = Q(ancestors__ancestor__value__stringValue__lte=testValue)
    elif symbol == '>':
        q = Q(ancestors__ancestor__value__stringValue__gt=testValue)
    elif symbol == '>=':
        q = Q(ancestors__ancestor__value__stringValue__gte=testValue)
    else:
        raise ValueError("unrecognized symbol: %s" & symbol)
    return q
    # Handles a degenerate case where a referenceValue was stored in the same place as
    # the stringValue and it happens to match the query string, 

def _getAncestorClause(symbol, testValue):
    if isinstance(testValue, list):
        simples = map(lambda t: _getSimpleAncestorClause(symbol, t), testValue)
        return reduce(lambda q1, q2: q1 | q2, simples)
    else:
        return _getSimpleAncestorClause(symbol, testValue)

def _getFilterClause(params, userInfo):
    if len(params) > 2 and isinstance(params[0], list) and params[1] == '>':
        t = map(terms.__getitem__, params[0])
        subF = _getFilterClause(params[2:], userInfo)
        return Instance.objects.filter(value__field__in=t,
                                    value__deleteTransaction__isnull=True,
                                    value__referenceValue__in=userInfo.findFilter(subF))
    elif len(params) > 2 and params[1] == '>':
        t = terms[params[0]]
        subF = _getFilterClause(params[2:], userInfo)
        return Instance.objects.filter(value__field=t,
                                       value__deleteTransaction__isnull=True,
                                       value__referenceValue__in=userInfo.findFilter(subF))
    else:
        # Replace the field name with a * for any item.
        return _parse([], ['*'] + params[1:], userInfo)

def _getFieldClause(resultSet, params, userInfo):
    if len(params) == 1:
        if isinstance(params[0], list):
            return resultSet.filter(value__field__in=map(terms.__getitem__, params[0]), 
                                    value__deleteTransaction__isnull=True)
        elif params[0] == '?':
            return resultSet #degenerate case
        else:
            return resultSet.filter(value__field=terms[params[0]], value__deleteTransaction__isnull=True)
    elif len(params) > 2 and params[1]=='>':
        return resultSet.filter(pk__in=_getFilterClause(params, userInfo))
    elif len(params) == 3:
        i = None if params[0] == '?' else \
            map(terms.__getitem__, params[0]) if isinstance(params[0], list) else \
            terms[params[0]]
        # Get a Q clause that compares either a single test value or a comma-separated list of test values
        # according to the specified symbol to a list of fields or a single field.
        if isinstance(i, map):
            stringText = reduce(lambda q1, q2: q1 | q2, \
                                map(lambda field: _getQClause(field, params[1], params[2]), i))
        else:
            stringText = _getQClause(i, symbol=params[1], testValue=params[2])
    
        # Need to add distinct after the tests to prevent duplicates if there is
        # more than one value of the instance that matches.
        return resultSet.filter(stringText).distinct()
    else:
        print(params)
        raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in params]))

def _refineResults(resultSet, path, userInfo):
#     logger = logging.getLogger(__name__)
#     logger.error("_refineResults(%s, %s)" % (str(resultSet), path))
    
    if path[0] == '#':
        return Instance.objects.filter(pk=path[1]), path[2:]
    elif path[0] == '*':
        return Instance.objects.filter(deleteTransaction__isnull=True), path[1:]
    elif path[0] == '[':
        params = path[1]
        if params[0] == 'ancestor' and params[1] == ':':
            # Filter by items that contain an ancestor with the specified field clause. 
            if params[2] != '?':
                i = terms[params[2]]
            else:
                i = None
            if len(params) == 3:
                f = resultSet.filter(value__field=i, value__deleteTransaction__isnull=True)
            elif len(params) == 5:
                # Get a Q clause that compares either a single test value or a comma-separated list of test values
                # according to the specified symbol.
                stringText = _getAncestorClause(symbol=params[3], testValue=params[-1])
            
                # Need to add distinct after the tests to prevent duplicates if there is
                # more than one value of the instance that matches.
                if i:
                    f = resultSet.filter(stringText, ancestors__ancestor__value__field=i,
                                         ancestors__ancestor__value__deleteTransaction__isnull=True).distinct()
                else:
                    f = resultSet.filter(stringText,
                                         ancestors__ancestor__value__deleteTransaction__isnull=True).distinct()
            else:
                raise ValueError("unrecognized path contents within [] for %s" % "".join([str(i) for i in path]))
            return f, path[2:]
        else:
            f = _getFieldClause(resultSet, params, userInfo)
            return f, path[2:]
    elif path[0] == '>':
        i = terms[path[1]]
        f = Instance.objects.filter(referenceValues__instance__in=userInfo.findFilter(resultSet),
                                    referenceValues__field=i,
                                    referenceValues__deleteTransaction__isnull=True)\
                            .order_by('parent', 'parentValue__position')
        return f, path[2:]         
    elif path[0] == '::':
        function = path[1]
        if function == 'reference':
            if isinstance(path[2], list):
                if len(path[2]) != 1:
                    t = map(terms.__getitem__, path[2])
                    f = Instance.objects.filter(typeID__in=t,
                                                value__deleteTransaction__isnull=True,
                                                value__referenceValue__in=userInfo.findFilter(resultSet))
                else:
                    t = terms[path[2][0]]
                    f = Instance.objects.filter(Q(value__deleteTransaction__isnull=True)&\
                                                Q(value__referenceValue__in=userInfo.findFilter(resultSet)),
                                                typeID=t,
                                               )
                return f, path[3:]
            else:
                raise ValueError("malformed reference (missing parentheses)")
        elif function == 'not':
            if isinstance(path[2], list):
                f = resultSet.exclude(pk__in=_parse([], path[2], userInfo))
                return f, path[3:]
            else:
                raise ValueError("malformed not (missing parentheses)")
        else:
            raise ValueError("unrecognized function: %s" % function)
    elif path[0] == '|':
        return Instance.objects.filter(Q(pk__in=resultSet)|Q(pk__in=_parse([], path[1:], userInfo))), []
    elif len(path) >= 3 and path[0] == ':' and path[1] == 'not':
        if isinstance(path[2], list):
            if path[2][0] == '[':
                params = path[2][1]
                i = terms[params[0]]
                if len(params) == 1:
                    f = resultSet.exclude(value__in=Value.objects.filter(field=i,deleteTransaction__isnull=True))
                    return f, path[3:]
                elif len(params) == 3:
                    symbol = params[1]
                    testValue = params[2]
                    f = _excludeByField(resultSet, i, symbol, testValue)
                    return f, path[3:]
                else:
                    raise ValueError("unrecognized contents within ':not([...])'")
            else:
                raise ValueError("unimplemented 'not' expression")
        else:
            raise ValueError("malformed 'not' expression")
    elif isinstance(path[0], list): # Path[0] is a list of type IDs.
        t = map(terms.__getitem__, path[0])
        f = Instance.objects.filter(typeID__in=t,
                                    deleteTransaction__isnull=True)
        return f, path[1:]
    else:   # Path[0] is a typeID.
        i = terms[path[0]]
        f = Instance.objects.filter(typeID=i, deleteTransaction__isnull=True)
        return f, path[1:]

def _tokenize(path):
    html_parser = html.parser.HTMLParser()
    unescaped = html_parser.unescape(path)
    tokens = cssparser.tokenize(unescaped)
    a, remainder = cssparser.cascade(tokens)
    return a

def _parse(startSet, a, userInfo):
    resultSet = [(startSet, a)]
    while len(resultSet[-1][1]) > 0:
        lastPair = resultSet[-1]
        nextPair = _refineResults(lastPair[0], lastPair[1], userInfo)
        resultSet.append(nextPair)
    return resultSet[-1][0]
    
# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def selectAllObjects(path, startSet=[], userInfo=None, securityFilter=None):
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects path: %s" % str(path))

    if not userInfo: userInfo = UserInfo(AnonymousUser())
    if not securityFilter: securityFilter = userInfo.findFilter
    
    parsed = _parse(startSet, _tokenize(path), userInfo)
    return securityFilter(parsed).distinct()
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects result: %s" % (str(resultSet[-1][0])))
#     logger.error("selectAllObjects result for %s: %s" % (userInfo.authUser, str(f)))
           
