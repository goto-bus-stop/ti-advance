define(function() {
  // The language lexer, gets some code and returns a token array
  var Lexer = new Class({
    Implements: Options,
    
    options: {
      preserve: false,
      exact: true
    },
    
    code: '',
    chunk: '',
    tokens: [],
    line: 1,
    store: true,
    
    // Regexes for matching tokens
    match: {
      // identifiers can be quite a lot
      identifier: /^([$A-Za-z_\x7f-\uffff][$\w\x7f-\uffff]*)([^\n\S]*:(?!:))?/,
      // comments are everything preceded by //
      comment: /^\/\/.*/,
      // whitespace is skipped
      whitespace: /^\s+/,
      // range keywords
      range: /^t(?:o|il)/,
      // strings in double quotes
      doublestr: /^"[^\\"]*(?:\\.[^\\"]*)*"/,
      // strings in single quotes (merge? there's no difference...)
      singlestr: /^'[^\\']*(?:\\.[^\\']*)*'/,
      // numbers: 10e1, 0x10, 0b10, 0o10, 12r10...
      number: /^\-?0x[\da-f]+|^\d\d?r[0-9a-z]+|^0o[0-7]+|^0b[01]+|^\d*\.?\d+(?:e[+-]?\d+)?/,
      // native piece of TI-Basic
      ti: /^`[^\\`]*(?:\\.[^\\`]*)*`/
    },
    
    // Where the work is done. Gets code, puts tokens in .tokens
    tokenize: function tokenize(code) {
      // clean
      code = code.replace(/\r/g, '').replace(/\s+$/, '');
      this.code = code;
      var i = 0;
      while(this.chunk = code.slice(i)) {
        i += this.getToken(this.chunk);
      }
      return this;
    },
    
    // is used in multiple places, needs own
    getToken: function getToken(c) {
      return this.identifierToken(c) || this.commentToken(c)
          || this.whitespaceToken(c) || this.stringToken(c)
          || this.numberToken(c)     || this.tiToken(c)
          || this.literalToken(c);
    },
    
    // checks out next token, saving if wanted
    next: function next(store, code) {
      var q = this.store;
      this.store = !!store;
      this.getToken(code || this.chunk);
      this.store = q;
      return this.lastToken;
    },
    
    // non-saving next() shortcut
    peek: function peek(code) {
      return this.next(false, code);
    },
    
    // clears lexer state
    clear: function clear() {
      this.code = '';
      this.tokens = [];
      this.chunk = '';
      this.line = 1;
      
      return this;
    },
    
    // add token to .tokens array
    token: function token(tag, value) {
      this.lastToken = [tag, value, this.line]
      if(this.store) {
        this.tokens.push(this.lastToken);
      }
      return value.length;
    },
    
    // an identifierToken can be one of variable, call, control structure
    identifierToken: function identifierToken(chunk) {
      var match = this.match.identifier.exec(chunk);
      if(!match) {
        return 0;
      }
      var input = match[0], id = match[1], colon = match[2], tag = id.toUpperCase();
      // ranges
      if('TO TIL'.contains(tag, ' ')) {
        return this.token('RANGE', id.toLowerCase());
      }
      else if(tag == 'BY') {
        return this.token('RANGESTEP', 'by');
      }
      // for i in range sugar
      else if(tag == 'FROM') {
        return this.token(tag, 'from');
      }
      
      // keywords are all returned as 'keyword'
      var KEYWORDS = 'UNLESS IF ELSE WHILE UNTIL FOR FOREACH RETURN SWITCH CASE DEFAULT EXIT DIE IN FUNCTION CONST';
      this.token(KEYWORDS.contains(tag, ' ') ? 'KEYWORD' : 'IDENTIFIER', id); //this.options.exact ? tag : (['VARIABLE', 'CALL'].contains(tag) ? tag : 'IDENTIFIER'), id);
      return id.length;
    },
    // a commentToken doesn't really do anything at all, it's just ignored
    commentToken: function commentToken(chunk) {
      var match = this.match.comment.exec(chunk);
      if(!match) {
        return 0;
      }
      var index = match[0].indexOf('\n');
      if(index === -1) {
        index = match[0].length;
      }
      
      // need to find a way to parse arbitrary comments and such
      //this.token('COMMENT', match[0].substr(0, index));
      
      return index;
    },
    // whitespace serves only as a delimiter and can be ignored 
    whitespaceToken: function whitespaceToken(chunk) {
      var match = this.match.whitespace.exec(chunk);
      if(!match) {
        return 0;
      }
      if(match[0].contains('\n')) {
        this.line++;
      }
      if(this.options.preserve) {
        this.token('WHITESPACE', match[0]);
      }
      return match[0].length;
    },
    // simple single-line string
    stringToken: function stringToken(chunk) {
      var match = this.match.singlestr.exec(chunk) || this.match.doublestr.exec(chunk);
      if(!match) {
        return 0;
      }
      
      this.token('STRING', match[0]);
      
      return match[0].length;
    },
    // a number
    numberToken: function numberToken(chunk) {
      var match = this.match.number.exec(chunk);
      if(!match) {
        return 0;
      }
      
      return this.token('NUMBER', match[0]);
    },
    // a tiToken is a string of TI-Basic code, that is entered into the output without alterations
    // Extremely hard to use because you never know what the output variables will be...
    tiToken: function tiToken(chunk) {
      var match = this.match.ti.exec(chunk);
      if(!match) {
        return 0;
      }
      
      this.token('NATIVE', match[0]);
      
      return match[0].length;
    },
    // the catch-all token function
    literalToken: function literalToken(chunk) {
      var one = chunk[0], two = one + chunk[1];
      
      // compare
      if('== != && || >= <='.contains(two, ' ')) {
        return this.token('COMPARE', two);
      }
      
      // compound assign
      if('+= -= *= /= %= ^='.contains(two, ' ')) {
        return this.token('C_ASSIGN', two);
      }
      
      // save as += or -=es
      if('++ --'.contains(two, ' ')) {
        this.token('C_ASSIGN', two.charAt(0) + '=')
        this.token('NUMBER', '1');
        // return 2 anyway, as that's how many chars we actually read
        return 2;
      }
      
      // some one-char-tokens
      switch(one) {
      // open/close
      case '(': return this.token('PAREN_OPEN', one);
      case ')': return this.token('PAREN_CLOSE', one);
      case '{': return this.token('BLOCK_OPEN', one);
      case '}': return this.token('BLOCK_CLOSE', one);
      case '[': return this.token('ARR_OPEN', one);
      case ']': return this.token('ARR_CLOSE', one);
      // delim
      case ',': return this.token('DELIMITER', one);
      // assign
      case '=': return this.token('ASSIGN', one);
      // single-char compares
      case '>': return this.token('COMPARE', one);
      case '<': return this.token('COMPARE', one);
      // \n is problematic as a terminator...
      //case '\n': this.line++; return this.token('TERMINATOR', one);
      case ';': return this.token('TERMINATOR', ';');
      }
      
      // operations
      if('+-*/%^'.contains(one)) {
        this.token('MATH', one);
        return 1;
      }
      
      // everything else
      this.token('LITERAL', one);
      
      return 1;
    }
  });
  
  // utility
  Lexer.getTokens = function getTokens(code, opts) {
    return new Lexer(opts).tokenize(code).tokens;
  };
  
  return Lexer;
});
