define(['./function_list', './nodes'], function (FUNCTION_LIST, nodes) {
  "use strict";

  // utils
  
  function debug(tokens) {
    // dump seperate tokens in a webkit-readable format (ie. not arrays)
    console.log(tokens.map(function (tok) { return tok[1]; }).join(' '));
    return tokens;
  }

  function err(msg) {
    // subtly show our concerns
    if(DEBUG_) {
      try {
        throw Error(msg);
      }
      catch(e) {
        console.warn(msg, e.stack.replace('Error: ' + msg, ''));
      }
    }
  }

  // helpers
  function getClosing(tokens) {
    // opening token
    var open = tokens[0][1],
    // matching pairs
      close = {
      '{': '}',
      '[': ']',
      '(': ')',
      "'": "'",
      '"': '"'
    }[open],
    // some loop vars
      index = 1, code = tokens.slice(1), i = 0, l = code.length, token;
    for (; i < l; i++) {
      // something's opened
      if (code[i][1] == open) {
        index++;
      }
      // something's closed
      else if (code[i][1] == close) {
        index--;
      }
      
      // if we're back at zero index, everything's probably closed
      if (!index) {
        return i + 1;
      }
    }

    err('Missing closing `' + close + '`, opened on line ' + tokens[0][2]);
  }

  function cleanUp(tokens) {
    // don't mess with the original tokens
    tokens = tokens.clone();
    
    // kill all excessive start terminations
    while (tokens[0][0] === 'TERMINATOR') {
      tokens.shift();
    }
    return tokens;
  }

  function getUntil(tokens, until) {
    var i, l;
    
    // end tokens
    until = Array.from(until);
    
    for (i = 0, l = tokens.length; i < l; i++) {
      // if current token looks like an end token
      if (until.contains(tokens[i][0])) {
        // return everything until here
        return tokens.slice(0, i);
      }
    }

    return false;
  }

  function getBlock(tokens) {
    var code = cleanUp(tokens);
    
    // if there's no block,
    if (code[0][0] !== 'BLOCK_OPEN') {
      // assume the next line to be one,
      code = getUntil(code, 'TERMINATOR');
      // so make it one.
      code.unshift(['BLOCK_OPEN', '{', code[0][2]]);
      code.push(['BLOCK_CLOSE', '}', code.getLast()[2]]);
    }
    
    // then clean up the token stream for a bit
    code = code.slice(0, getClosing(code) + 1);
    
    // and act like it's a block
    return code;
  }
  
  function contains(tokens, what) {
    what = Array.from(what);
    return tokens.some(function(tok) { return what.contains(tok[0]); });
  }
  
  function do_parse(opts, tokens, n) {
    // a block of code enclosed in `{` `}`
    function Block(tokens, pos, isTopLevel) {
      // all the lines
      var lines = [0],
      // last token of the block
        last;
      
      // if this 'block' has block characters around it, remove them
      if (tokens[0][0] === 'BLOCK_OPEN' && tokens.getLast()[0] === 'BLOCK_CLOSE') {
        tokens.pop();
        tokens.shift();
      }
      
      // add last terminator if it's not there, to allow things like
      // `if a == true { print 'things' }`
      // which is much prettier than
      // `if a == true { print 'things'; }`
      last = tokens.getLast() || [];
      if (last[0] !== 'TERMINATOR') {
        tokens.push(['TERMINATOR', ';', last[2]]);
      }
      
      // seperate lines
      tokens.each(function (token, pos) {
        if (token[0] === 'TERMINATOR') {
          lines.push(pos + 1);
        }
      });
      
      // create block containing all the lines, cleaned from empty ones
      return new n.Block(lines.map(function (pos) { return Line(tokens, pos); }).clean());
    }
    
    // a line of code
    function Line(tokens, pos) {
      var line = tokens.slice(pos);
      if (!line.length) {
        return;
      }
      switch (line[0][0]) {
      // we start with a keyword, do things
      case 'KEYWORD':
        return KeyWordThing(line, 0);
      case 'BLOCK_OPEN':
      // a block can start everywhere
        var blockClose = getClosing(line);
        return Block(line.slice(0, blockClose), blockClose);
      default:
        // TI+"Advance" is still pretty limited, eg. an assignment has to be the only thing in a statement.
        // therefore, an assignment line always has an ASSIGN or C_ASSIGN in the second spot.
        // so, as ASSIGN and C_ASSIGN are only used in assignment, we can assume an assignment if
        // the second token in a line is ASSIGN or C_ASSIGN
        
        // this is not really true, we can assign array accesses, but that's a work in progress...
        // perhaps add assignment to Expression?
        if (contains(getUntil(line, 'TERMINATOR'), ['ASSIGN', 'C_ASSIGN'])) {
          return Assign(line);
        }
        else {
          // probably an expression, there's no assign so nothing can really happen
          return Expression(line);
        }
      }
    }
  
    // a line starting with a keyword
    function KeyWordThing(tokens, pos) {
      tokens = tokens.slice(pos);
      var keyword = tokens[0][1].toLowerCase(), isInline = false, npos = 0;
      switch (keyword) {
      case 'unless':
      case 'if':
        return If(tokens, npos, keyword === 'unless');
      case 'for':
        return For(tokens, npos);
      case 'until':
      case 'while':
        return While(tokens, npos, keyword === 'until');
      case 'inline':
        if(tokens[1][1].toLowerCase() != 'function') {
          err('Weird inline spotted');
        }
        isInline = true;
        npos = 1;
      case 'function':
        return Fn(tokens, npos, isInline);
      case 'return':
        return Return(tokens, npos);
      }
    }
    
    // an assignment
    function Assign(tokens) {
      tokens = getUntil(tokens, 'TERMINATOR') || tokens;
      
      // position of assign token
      var pos = 0;
      tokens.some(function(tok, i) { pos = i; return tok[0] == 'ASSIGN' || tok[0] == 'C_ASSIGN'; });
      
      // things on the left side of the assign token
      var variable = tokens.slice(0, pos);
      variable = Expression(variable);
      
      // what kind of assignment this is
      var type = tokens[pos][1];
      
      // the value to set the variable to
      var value = Expression(tokens.slice(pos + 1));
      
      return new n.Assign(variable, type, value);
    }
  
    // an `if` or `unless` statement
    function If(tokens, pos, negate) {
      tokens = tokens.slice(pos);
      
      // the condition
      var condition = getUntil(tokens.slice(1), ['TERMINATOR', 'BLOCK_OPEN']),
      // and the code to execute if it is true,
        code = tokens.slice(condition.length + 1);
      // or false in case of negation,
      if(negate) {
        var ln = condition[0][2];
        // but then we also add a not call around it, to actually negate.
        condition.unshift(['PAREN_OPEN',  '(',   ln]);
        condition.unshift(['IDENTIFIER',  'not', ln]);
        condition.push   (['PAREN_CLOSE', ')',   condition.getLast()[2]]);
      }
      condition = Expression(condition);
      
      // our block of code
      var block = getBlock(code);
      
      // and the first thing after this block,
      var next = code.slice(block.length);
      
      var ifFalse = false;
      
      // which could well be an else,
      if(next[0] && next[0][1].toLowerCase() === 'else') {
        // in which case we add the else part to the if.
        ifFalse = Else(next);
      }
      
      return new n.If(condition, Block(block), ifFalse);
    }
    
    // an else part
    function Else(tokens) {
      // will always be called from an If(),
      var code = tokens.slice(1);
      // so we can just transform
      var block = getBlock(code);
      // into a block.
      return Block(block);
    }
    
    // a while loop
    function While(tokens, pos, until) {
      tokens = tokens.slice(pos);
      
      var condition = getUntil(tokens.slice(1), ['TERMINATOR', 'BLOCK_OPEN']),
        code = tokens.slice(condition.length + 1);
      
      condition = Expression(condition);
      
      var block = getBlock(code);
      
      return new n.While(condition, Block(block), until);
    }
    
    // a for loop
    function For(tokens, pos) {
      tokens = tokens.slice(pos);
      
      // for condition: `for i in list` => `i in list`
      var condition = getUntil(tokens.slice(1), ['TERMINATOR', 'BLOCK_OPEN']),
      // all the code
        code = tokens.slice(condition.length + 1);
      if(condition[1][0] == 'FROM') {
        // transform `for a from 0 to 100 by 2` => `for a in [0 to 100 by 2]`
        var ln = condition[0][2],
        // by seperating the range
          range = condition.slice(2);
        // and creating a condition from the range
        condition = [
        // with the variable,
          condition[0],
        // in an `in` expression,
          ['KEYWORD', 'in', ln],
        // together with an array
          ['ARR_OPEN', '[', ln]
        // containing said range
        ].concat(range).concat([
          ['ARR_CLOSE', ']', ln]
        ]);
      }
      
      // also make this a real Expression
      var iterate = Expression(condition);
      
      // but if it's not an In, refuse
      if(iterate.$node != 'In') {
        err('received non-`in` in for loop');
      }
      
      // then finally create something
      return new n.For(
        iterate.value, iterate.list,
        Block(getBlock(code))
      );
    }
    
    // all kinds of useful stuff: calls, operations and other things that can happen pretty much everywhere,
    // but also native values (string, number, array)
    function Expression(tokens) {
      // start token data
      var firstTok = tokens[0], type = firstTok[0], text = firstTok[1],
      // all the tokens on this line
        fullLine = getUntil(tokens, 'TERMINATOR') || tokens,
      // just the text on this line
        lineText = fullLine.map(function(a) { return a[1] });
      
      // Grouping => seperate Expression
      if(type == 'PAREN_OPEN') {
        return Expression(tokens.slice(1, getClosing(tokens)));
      }
      
      // Some array stuff
      if(type === 'ARR_OPEN') {
        return Arr(tokens);
      }
      
      // Assume a function call when an identifier is in the function list
      if(type === 'IDENTIFIER' && text.toLowerCase() in FUNCTION_LIST) {
        return Call(tokens);
      }
      
      if(lineText.contains('in')) {
        // this thing contains an `in` expression
        return In(tokens);
      }
      
      // if this thing contains a range step,
      if(tokens.some(function(tok, i) { return tok[0] == 'RANGE'; })) {
        // we might want to switch to ranges.
        return Range(tokens);
      }
      
      // left-associative operation / comparison
      var compares = ['==', '!=', '>', '<', '<=', '>='];
      // util
      function ops(op) {
        // get position
        var opPos = op.map(function(sign) { return lineText.lastIndexOf(sign); }).max();
        // we've no op
        if(opPos < 0) {
          return false;
        }
        // left-hand side
        var left = fullLine.slice(0, opPos),
        // operation type
          op = lineText[opPos],
        // right-hand side
          right = fullLine.slice(opPos + 1);
        
        // Expressionate if applicable
        left = left.length && Expression(left);
        right = right.length && Expression(right);
        
        // we handle compares here too, check which one is needed
        return new n[compares.contains(op) ? 'Compare' : 'Op'](
          left, op, right, opts.simplify
        );
      }
      
      // operators, first is lowest precedence, last is highest precedence
      var signs = [
        compares,
        ['-', '+'],
        ['/', '*', '%'],
        ['^']
      ],
      // some useful loops
        i = 0, l = signs.length, it;
      for(; i < l; i++) {
        // brute-force all the ops!
        if(it = ops(signs[i])) {
          return it;
        }
      }
      
      // negation
      if(type == 'LITERAL' && text == '!') {
        return new n.Call('not', [Expression(tokens.slice(1))]);
      }
      
      if(type === 'IDENTIFIER') {
        // only one thing
        if(tokens.length < 2 || 'DELIMITER TERMINATOR'.contains(tokens[1][0], ' ')) {
          // bool
          if('true false'.contains((it = tokens[0])[1], ' ')) {
            return new n.Value(it[1] == 'true');
          }
          
          // variable
          return Variable(tokens);
        }
        
        // an identifier followed directly by `[` can only be array access:
        // `list[this, is, an, array]` is illegal if `list` is not a function,
        // and functions are already handled
        if(tokens[1][0] == 'ARR_OPEN') {
          return Access(tokens);
        }
      }
      
      // numbers
      if(type == 'NUMBER') {
        return Num(tokens);
      }
      
      // strings
      if(type == 'STRING') {
        // remove quotes
        return new n.Value(text.slice(1, text.length - 1));
      }
      
      // else, do nothing for the time being
      return opts.dumpUnknown ? new n.Value('unknown_expr') : new n.Native('');
    }
    
    function Access(tokens) {
      // access will always be of the format `list[index]`. Everything
      // between square brackets is the index.
      var index = tokens.slice(2, getClosing(tokens.slice(1)) + 1);
      return new n.Access(
      // list name
        Expression([tokens[0]]),
      // access index
        Expression(index)
      );
    }
    
    // A variable
    function Variable(tokens) {
      var variable = tokens[0][1];
      // something ninja might sometime happen here, but there's no use at the moment.
      return new n.Variable(variable);
    }
    
    // an Array
    function Arr(tokens) {
      // create List node
      return new n.Value(
        // from inner array part
        tokens.slice(1, getClosing(tokens))
        // split it into seperate values,
          .split(function(tok) { return tok[0] == 'DELIMITER' })
        // with empty values removed
          .clean()
        // and everything Expressionated.
          .map(Expression)
      );
    }
    
    // a Number
    function Num(tokens) {
      // 0XFF, 0B11, 0O77, 10R99 --> 0xff, 0b11, 0o77, 10r99
      var text = tokens[0][1].toLowerCase();
      
      // variable radix regex
      var radix = /^(\d{1,2})r/;
      
      // variable radix
      var base = radix.exec(text);
      if(base) {
        base = base[1];
        text = text.replace(radix, '');
      }
      // normal radix
      else {
        // default
        base = 10;
        
        // get prefix
        var pre = text.substr(0, 2).toLowerCase();
        // hexadecimal
        if(pre == '0x') {
          base = 16;
        }
        // octal
        if(pre == '0o') {
          base = 8;
        }
        // binary
        if(pre == '0b') {
          base = 2;
        }
        
        if(base !== 10) {
          text = text.substr(2);
        }
      }
      
      // something illegal
      if(base < 2 || base > 36) {
        err('impossible radix');
      }
      
      return new n.Value((base == 10 ? parseFloat : parseInt)(text, base));
    }
    
    // a Range
    function Range(tokens) {
      // find range type specifier
      var pos = 0;
      tokens.some(function(tok, i) { pos = i; return tok[0] == 'RANGE'; });
      
      // range start
      var start = tokens.slice(0, pos),
      // range type
        inclusive = tokens[pos][1] == 'to',
      // range end
        end = tokens.slice(pos + 1),
      // default step value
        step = new n.Value(1);
      
      // reuse to get optional step size
      pos = 0;
      if(end.some(function(tok, i) { pos = i; return tok[0] == 'RANGESTEP'; })) {
        step = Expression(end.slice(pos + 1));
        // resize end value if needed
        end = end.slice(0, pos);
      }
      
      // Expressionate things
      start = Expression(start);
      end   = Expression(end);
      
      return new n.Range(start, end, step, inclusive);
    }
    
    // an In check
    function In(tokens) {
      // position of the `in`
      var inPos = 0;
      tokens.some(function(tok, i) { inPos = i; return tok[0] == 'KEYWORD' && tok[1].toLowerCase() == 'in'; });
      
      // left-hand side
      var left = tokens.slice(0, inPos),
      // right-hand side
        right = tokens.slice(inPos + 1);
      
      // Expressionate when needed
      left = left.length && Expression(left);
      right = right.length && Expression(right);
      
      return new n.In(
        left, right
      );
    }
    
    // a function call
    function Call(tokens) {
      // function name
      var fn = tokens[0][1],
      // following token (call open?)
        next = tokens[1],
      // argument list tokens
        paramStream = [],
      // argument list
        params = [];
      
      // if the argument list starts with a paren
      if(next[1][0] === 'PAREN_OPEN') {
        // get everything between parens
        paramStream = tokens.slice(1, getClosing(tokens.slice(1)) - 1);
        // and check if there's no invalid characters in between
        if(paramStream.some(function(tok) { return tok[0] === 'TERMINATOR' })) {
          err('Unclosed arguments list');
        }
      }
      // else, read until end of Expression. (most often Line)
      else {
        paramStream = getUntil(tokens.slice(1), 'TERMINATOR') || tokens.slice(1);
      }
      
      // split stream into parameters
      params = paramStream.split(function(tok) { return tok[0] == 'DELIMITER'; });
      
      // create call to fn with Expressionated params
      return new n.Call(fn, params.map(Expression));
    }
    
    // a function definition
    function Fn(tokens, pos, isInline) {
      tokens = tokens.slice(pos);
      
      // splits argument tokens into arguments
      function getArgs(tokens) {
        return tokens.split(function(tok) { return tok[0] == 'DELIMITER'; });
      }
      
      // remove keyword
      tokens.shift();
      
      // function name is the first identifier
      var fnName = tokens.shift(),
      // holds arguments
        fnArgs = [],
      // holds code
        fnCode;
      
      // if the next token is an identifier, we have unparenthesized arguments.
      if(tokens[0][0] == 'IDENTIFIER') {
        fnArgs = getArgs(getUntil(tokens, ['BLOCK_OPEN', 'TERMINATOR']));
      }
      // else, they probably are
      else if(tokens[0][0] == 'PAREN_OPEN') {
        fnArgs = getArgs(
          tokens.slice(1,
            getClosing(tokens)
          )
        );
      }
      // if there is something between the function name and the start of the function,
      // there's likely something wrong with the argument list.
      else if(!'BLOCK_OPEN TERMINATOR'.contains(tokens[0][0], ' ')) {
        err('invalid arguments list');
      }
      
      // get all code between {}, that's probably function code
      for(var i = 0, l = tokens.length; i < l; i++) {
        if(tokens[i][0] == 'BLOCK_OPEN') {
          fnCode = getBlock(tokens.slice(i + 1));
          break;
        }
      }
      
      fnArgs.each(function(arg, i) {
        if(arg.length < 2) {
          return fnArgs[i] = Expression(arg);
        }
        var ln = arg[0][2],
          expr = Assign(arg);
        console.log(ln, arg.clone(), expr);
        if(expr.$node == 'Assign') {
          if(expr.type != '=') {
            err('invalid default param');
          }
          var assign = [
            ['KEYWORD',     'if',  ln],
            ['IDENTIFIER',  'not', ln],
            ['PAREN_OPEN',  '(',   ln],
            arg[0],
            ['PAREN_CLOSE', ')',   ln],
            ['BLOCK_OPEN',  '{',   ln],
            arg[0],
            ['ASSIGN',      '=',   ln]
          ].concat(arg.slice(2));
          assign.push(['BLOCK_CLOSE', '}', ln]);
          fnCode = assign.concat(fnCode);
        }
        fnArgs[i] = Expression([arg[0]]);
      });
      
      return new n.FnDef(
      // function name
        Expression([fnName]),
      // function arguments
        fnArgs,
      // function code
        Block(fnCode)
      );
    }
    
    function Return(tokens, pos) {
      tokens = tokens.slice(pos);
      // remove literal return
      tokens.shift();
      return new n.Block(
        Expression(tokens),
        new n.Native('Return')
      );
    }
    
    return Block(tokens, 0, true);
  }
  
  
  var Parser = new Class({
    Implements: Options,
    
    options: {
      modern: true,
      simplify: true,
      target: 'basic',
      dumpUnknown: false
    },
    
    tokens: [],
    pos: 0,
    ast: {},
    
    initialize: function Parser(options) {
      this.setOptions(options);
    },
    
    parse: function parse(tokens) {
      this.tokens = tokens;
      
      // reset nodes
      nodes.init();
      
      // parse stuff
      this.ast = do_parse(this.options, tokens, nodes);
      
      return this;
    },
    
    compile: function compile() {
      // shorthand
      return this.ast.compile(this.options.modern);
    }
  });
  
  return {
    // would love to add individual functions but that would be some major refactoring work...
    Parser: Parser,
    parse: do_parse,
  };
});
