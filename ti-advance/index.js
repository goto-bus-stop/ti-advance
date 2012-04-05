define(function(require) {
  var lang = {};
  Object.merge(lang, {
    Lexer: require('./lexer'),
    Parser: require('./parser').Parser,
    nodes: require('./nodes')
  });
  
  lang.snippet = "a = 1;\nb = 2;\nif a + b < 4 {\n  print 'we are the champions';\n}\nelse\n{\n  b -= 2;\n  print 'b = 0 now!';\n}";
  
  lang.lex = function lex(code, opts) { return lang.Lexer.getTokens(code, opts); }
  lang.parse = function parse(code, opts) {
    try {
      if(typeOf(code) == 'string') {
        code = lang.lex(code, opts ? opts.lex : {});
      }
      return new lang.Parser(opts).parse(code).compile();
    } catch(e) {
      console.error(e.message);
      console.warn('stack trace:');
      console.info(e.stack.replace('Error: ' + e.message, ''));
    }
  }
  
  return lang;
});
