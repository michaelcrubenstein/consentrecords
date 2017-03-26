from django.db import models as dbmodels
from django.db.models import F, Q, Prefetch
from django.contrib.auth.models import AnonymousUser

import html.parser
import logging
from functools import reduce

from parse.cssparser import parser as cssparser
from consentrecords.models import Instance, Value, Terms, terms, UserInfo, InstanceQuerySet

def _tokenize(path):
    html_parser = html.parser.HTMLParser()
    unescaped = html_parser.unescape(path)
    tokens = cssparser.tokenize(unescaped)
    a, remainder = cssparser.cascade(tokens)
    return a

# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def selectAllObjects(path, userInfo=UserInfo(AnonymousUser()), securityFilter=None):
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects path: %s" % str(path))

    if not securityFilter: securityFilter = userInfo.findFilter
    
    parsed = InstanceQuerySet().parse(_tokenize(path), userInfo)
    return securityFilter(parsed).distinct()
#     logger = logging.getLogger(__name__)
#     logger.error("selectAllObjects result: %s" % (str(resultSet[-1][0])))
#     logger.error("selectAllObjects result for %s: %s" % (userInfo.authUser, str(f)))
           
# select all of the ids that are represented by the specified path.
# The resulting IDs are represented tuples as either a single instance id or
# a duple with a value followed by the instance.
def getObjectQuerySet(path, userInfo=UserInfo(AnonymousUser()), securityFilter=None):
#     logger = logging.getLogger(__name__)
#     logger.error("getObjectQuerySet path: %s" % str(path))

    if not securityFilter: securityFilter = userInfo.findFilter
    
    parsed = InstanceQuerySet().parse(_tokenize(path), userInfo)
    return parsed.createObjectQuerySet(securityFilter(parsed).distinct())
#     logger = logging.getLogger(__name__)
#     logger.error("getObjectQuerySet result: %s" % (str(resultSet[-1][0])))
#     logger.error("getObjectQuerySet result for %s: %s" % (userInfo.authUser, str(f)))
           
