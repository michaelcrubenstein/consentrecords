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
            elif c in ':*':
                if len(lastString) > 0:
                    if lastString.count(c) == len(lastString):
                        lastString += c # Concatenate consecutive characters into a single token.
                    else:
                        a += [lastString]
                        lastString=c
                else:
                    lastString = c
            elif c in '#~^$|>+':
                if len(lastString) > 0:
                    a += [lastString]
                lastString = c
            elif c in '[()]':
                if len(lastString) > 0: a += [lastString]
                lastString = c
            elif c == '=':
                if lastString in '~^$|': # Check for characters that are combined with '='
                    lastString += c
                else:
                    if len(lastString) > 0: a += [lastString]
                    lastString = c
            else:
                if len(lastString) > 0 and lastString[-1] in ' :#~^$|>+[()]=':
                    a += [lastString]
                    lastString = ""
                lastString += c
        
        if inQuote and parser.countTrailingQuotes(lastString[1:]) % 2 == 0:
            lastString += '"'
            
        a += [lastString]
        
        return a

    def cascade(source, closer=None):
        a = []
        for i in range(0, len(source)):
            s = source[i]
            if s == closer:
                return a, source[i+1:]
            elif s == '[':
                item, remainder = parser.cascade(source[i+1:], "]")
                a += ['[', item]
                return a, remainder
            elif s == '(':
                item, remainder = parser.cascade(source[i+1:], ')')
                a += ['(', item]
                return a, remainder
            elif len(s) > 1 and s[0] == '"':
            	a += [s[1:-1].replace('""', '"')]
            else:
                a += [s]
        return a, []