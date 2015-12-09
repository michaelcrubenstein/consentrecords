import logging

class parser:
    
    def countTrailingQuotes(s):
        i = 0
        for x in range(0, len(s)):
            if s[-x-1] != '"':
                return x
        return len(s)
        
    def tokenize(s):
        a = []
        lastString = ""
        inQuote = False
        for c in s:
            if inQuote:
                if c == '"':
                    lastString += c
                elif parser.countTrailingQuotes(lastString[1:]) % 2 == 1: #The number of quotes at the end is odd
                    a += [lastString]
                    inQuote = False
                    lastString = c
                else:
                    lastString += c
            elif c == '"':
                if len(lastString) > 0:
                    a += [lastString]
                    lastString=""
                inQuote = True
                lastString += c
            elif c == ' ':
                if len(lastString) > 0:
                    a += [lastString]
                    lastString = ""
            elif c == ',':
                if len(lastString) > 0:
                    if len(a) >= 2 and a[-2] == ',':
                        a[-1] += [lastString]
                    else:
                        a += [',', [lastString]]
                    lastString=''
            elif c in ':*':
                if len(lastString) > 0:
                    if lastString.count(c) == len(lastString):
                        lastString += c # Concatenate consecutive characters into a single token.
                    else:
                        a += [lastString]
                        lastString=c
                else:
                    lastString = c
            elif c in '#~^$|<>+':
                if len(lastString) > 0:
                    a += [lastString]
                lastString = c
            elif c in '[()]':
                if len(lastString) > 0: a += [lastString]
                lastString = c
            elif c == '=':
                if lastString in '~^*$|<>': # Check for characters that are combined with '='
                    lastString += c
                else:
                    if len(lastString) > 0: a += [lastString]
                    lastString = c
            else:
                if len(lastString) > 0 and lastString[-1] in ' :#~^$|<>+[()]=':
                    a += [lastString]
                    lastString = ""
                lastString += c
        
        if inQuote and parser.countTrailingQuotes(lastString[1:]) % 2 == 0:
            lastString += '"'
            
        a += [lastString]
        
        return a

    def cascade(source, i=0, closer=None):
#         logger = logging.getLogger(__name__)
#         logger.error("cascade(%s, %s)" % (source, closer))

        a = []
        while i < len(source):
            s = source[i]
            if s == closer:
#                 logger.error("  return(%s, %s)" % (a, i+1))
                return a, i+1
            elif s == '[':
                item, i = parser.cascade(source, i+1, "]")
                a += [s, item]
            elif s == '(':
                item, i = parser.cascade(source, i+1, ')')
                a += [s, item]
            elif len(s) > 1 and s[0] == '"':
                a += [s[1:-1].replace('""', '"')]
                i += 1
            else:
                a += [s]
                i += 1
#         logger.error("  return(%s, %s)" % (a, i))
        return a, i