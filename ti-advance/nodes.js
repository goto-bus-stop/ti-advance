define(['./function_list'], function(FUNCTION_LIST) {
  // Simple helper to count all occurences of a value in an array
  function countArray(arr) {
    var counts = {};
    arr.each(function(val) {
      if(!counts[val]) {
        counts[val] = 1;
      }
      else {
        counts[val]++;
      }
    });
    var actual = [];
    Object.each(counts, function(val, key) {
      actual.push({name: key, amount: val});
    });
    return actual;
  }
  
  // (re)set variable lists and such
  function init() {
    // (re)set lists
    List.use = 0;
    List.map = {};
    
    // (re)set function maps
    FnDef.paramMap = [];
    FnDef.count = 0;
    
    // (re)set variables
    Variable.list = [];
    Variable.holder = new List('__GLOBALS');
    
    // (re)set function definitions
    Call.FUNCTION_LIST = Object.clone(FUNCTION_LIST);
  }
  
  // A few helpers to wrap 'complex' equations in parens
  function wrap(str) { return '(' + str + ')'; }
  function wrapIf(str, object, useModern) {
    if(typeof object !== 'object') {
      useModern = !!object;
      object = str;
      str = object.compile(useModern);
    }
    return 'Variable Value Call'.contains(object.$node, ' ')
        || object.$node == 'Op' && object.isSimple()
        || object.op == '*' && (object.value1.$node == 'Variable'
                            ||  object.value2.$node == 'Variable')
        ? str
        : wrap(str);
  }
  
  // compilation errors
  function CompilationError(text, line) {
    if(!line) {
      return Error(text);
    }
    else {
      return Error(text + ' on line ' + line);
    }
  }
  
  // Base node class
  var Node = new Class({
    contains: function contains(type, fn) {
      if(!fn) {
        fn = Function.from(true);
      }
      
      // Recurse ALL the nodes!
      var seen = false;
      function check(obj) {
        Object.each(obj, function(sub) {
          if(seen) {
            return;
          }
          
          if(instanceOf(sub, Node) && sub.$node === type && fn(sub)) {
            seen = true;
            return;
          }
          
          if(typeOf(sub) === 'array') {
            check(sub);
          }
        });
      }
      check(this);
      return seen;
    },
    
    isSimple: Function.from(false),
    
    simplify: function simplify() { return this; },
    
    toString: function toString() { return this.compile(); }
  });
  
  // A line holds some useful code and is mainly used for optimization
  var Line = new Class({
    Extends: Node,
    
    $node: 'Line',
    
    code: [],
    
    initialize: function Line(a) {
      this.code = typeOf(a) == 'array' ? a : Array.from(arguments);
    },
    
    compile: function compile(useModern) {
      var c = this.code.invoke('compile', useModern);
      c.each(function(line, k) {
        c[k] = line.replace(/[\)\}\]]*$/, '');
      });
      
      return c.join(':').replace(/"*$/, '');
    }
  });
  
  // A list is just a special type of variable that can hold an array
  var List = new Class({
    Extends: Node,
    
    $node: 'List',
    
    name: null,
    
    initialize: function List(name) {
      this.name = name.toUpperCase();
      console.log(this, List);
      if(!List.map[this.name]) {
        var use = (List.use++).toString(36).toUpperCase();
        List.map[this.name] = 'ARR' + use;
      }
    },
    
    getType: Function.from('array'),
    
    compile: function compile(useModern) {
      return '∟' + List.map[this.name];
    }
  });
  
  // signifies which list should be used
  List.use;
  
  // holds list names
  List.map;
  
  // A variable. Instantiated on every occurence of a variable,
  // most used variables get the letters, less used are put in a list (L1 for now)
  // to allow a relatively huge amount of variables at compile-time.
  // Variable names are case-insensitive.
  var Variable = new Class({
    Extends: Node,
    
    Binds: ['getType'],
    
    $node: 'Variable',
    
    name: null,
    type: 'number',
    amount: 1,
    
    initialize: function Variable(name) {
      this.name = name.toLowerCase();
      if(!Variable.list[this.name]) {
        return Variable.list[this.name] = this;
      }
      Variable.list[this.name].amount++;
      return Variable.list[this.name];
    },
    
    getType: function getType() {
      return this.type;
    },
    
    compile: function compile(useModern, compile) {
      if(this.type == 'array') {
        return new List(this.name).compile(useModern);
      }
      if(this.type == 'string') {
        return new Str(this.name).compile(useModern);
      }
      
      var order = [];
      Object.each(Variable.list, function(obj, name) {
        order.push(Object.merge({name: name}, obj));
      });
      
      order = order.sort(function(one, two) {
        return one.amount > two.amount ? -1 : (one.amount < two.amount ? 1 : 0);
      });
      for(var i = 0, l = order.length; i < l; i++) {
        if(order[i].name == this.name) {
          return Variable.names[i] || new Access(Variable.holder, new Value(i - Variable.names.length + 2)).compile();
        }
      }
      
      return Variable.names[0] || new Access(Variable.holder, new Value(1));
    }
  });
  // Holds all variable names to determine precedence, to assign
  // most-used variables to letters and less-used to a variable list.
  Variable.list;
  Variable.holder;
  // A list of allowed variable names. If this is not
  // enough, the others will be put in a seperate list
  Variable.names = 'ABCDEFGHIJKLMNOPQRSTUVWXYZθ'.split('');
  
  // {G,S}ets temporary variable
  Variable.temporary = function temporary() {
    return new Variable('@' + String.uniqueID());
  };
  
  // A value: number, boolean, string or array (list)
  var Value = new Class({
    Extends: Node,
    
    $node: 'Value',
    
    value: 0,
    // set to original value if this is simplified
    original: false,
    
    initialize: function Value(value) {
      this.value = value || 0;
    },
    
    getType: function getType() {
      return typeOf(this.value);
    },
    
    simplify: function simplify() {
      return this;
    },
    
    isSimple: function isSimple() {
      return true;
    },
    
    compile: function compile(value) {
      switch(this.getType()) {
        case 'number': return this.value + '';
        case 'boolean': return this.value ? '1' : '0';
        case 'string': return '"' + this.value + '"';
        case 'array': return '{' + this.value.invoke('compile').join(',') + '}';
      }
      return '0';
    }
  });
  
  // Merely a list of comma-seperated values
  var Commas = new Class({
    Extends: Node,
    
    $node: 'Commas',
    
    values: [],
    
    initialize: function Commas(values) {
      this.values = Array.from(values);
    },
    
    compile: function compile(useModern) {
      return this.values.invoke('compile', useModern).join(',');
    }
  });
  
  // A range, `begin to end by step`
  var Range = new Class({
    Extends: Node,
    
    $node: 'Range',
    
    start: null,
    end: null,
    step: null,
    inclusive: true,
    array: false,
    
    initialize: function Range(start, end, step, inclusive, standAlone) {
      this.start = start;
      this.end = end;
      this.step = step;
      this.inclusive = inclusive;
      this.array = !!standAlone;
    },
    
    getType: Function.from('array'),
    
    simplify: function simplify() {
      if(this.isSimple()) {
        var values = [],
          from = this.start.simplify().value,
          to = this.end.simplify().value,
          step = this.step.simplify().value;
        
        // bool true = int 1, bool false = int 0
        to += this.inclusive;
        
        for(var i = from; i < to; i += step) {
          values.push(new Value(i));
        }
        return new Commas(values);
      }
      return this;
    },
    
    isSimple: function isSimple() {
      return this.start.isSimple() && this.end.isSimple() && this.step.isSimple();
    },
    
    compile: function compile(useModern) {
      var self = this.simplify();
      if(instanceOf(self, Value) || instanceOf(self, Commas)) {
        return self.compile(useModern);
      }
      var list = Variable.temporary(),
          loop = Variable.temporary(),
          count = Variable.temporary();
      
      var zero = new Value();
      
      return new Line(
        new Assign(
          list,
          '=',
          new Value([zero])
        ),
        new Assign(
          count,
          '=',
          zero
        ),
        new For(
          loop,
          this.start,
          this.end,
          this.step,
          new Block(
            new Assign(
              count,
              '+=',
              new Value(1)
            ),
            new Assign(
              new Access(list, count),
              '=',
              loop
            )
          )
        ),
        list
      ).compile();
    }
  });
  
  // An assign rule: value→variable
  // eg. `someVar = 200` becomes `200→C`
  // eg. `temp = 20; temp *= 1.5;` becomes `20→A:A*1.5→A`
  var Assign = new Class({
    Extends: Node,
    
    $node: 'Assign',
    
    variable: null,
    value: null,
    type: '',
    
    initialize: function Assign(variable, type, value) {
      this.variable = variable;
      this.value = value;
      this.type = type;
    },
    
    compile: function compile(useModern) {
      var variable = this.variable, value = this.value;
      
      if(!'Variable Access List Str'.contains(variable.$node, ' ')) {
        throw new CompilationError('cannot assign to a non-variable');
      }
      
      if(this.type != '=') {
        switch(this.type) {
          case '+=': value = new Op(variable, '+', value); break;
          case '-=': value = new Op(variable, '-', value); break;
          case '*=': value = new Op(variable, '*', value); break;
          case '/=': value = new Op(variable, '/', value); break;
          case '%=': value = new Op(variable, '%', value); break;
          case '^=': value = new Op(variable, '^', value); break;
        }
      }
      
      variable.type = value.getType();
      
      // strip closing parens and the likes
      return value.compile(useModern).replace(/"?[\)\}\]]*$/, '') + '→' + variable.compile(useModern);
    }
  });
  
  // Array access
  // eg. `arr[1]` becomes `∟ARR(1)`
  var Access = new Class({
    Extends: Node,
    
    $node: 'Access',
    
    list: null,
    entry: null,
    
    initialize: function Access(list, entry) {
      this.list = list;
      this.entry = entry;
    },
    
    getType: Function.from('number'),
    
    compile: function compile(useModern) {
      return this.list.compile(useModern) + wrap(this.entry.compile(useModern))
    }
  });
  
  // A code block: rules enclosed in `{` `}`
  var Block = new Class({
    Extends: Node,
    
    $node: 'Block',
    
    rules: [],
    
    initialize: function Block(rules) {
      this.rules = Array.from(arguments.length > 1 ? arguments : rules);
    },
    
    addRules: function addRules() {
      this.rules.append(arguments);
    },
    
    getLength: function getLength() {
      return this.rules.length;
    },
    
    compile: function compile(useModern) {
      var rules = this.rules.map(function(rule) {
        if(!rule) { return new Value() }
        return rule;
      });
      return rules.invoke('compile', useModern).join('\n').replace(/\n{2,}/g, '\n');
    }
  });

  // A mathematical operation: + - * / % ^
  // eg. `aVar % bVar` becomes `B*(A<0)+iPart(B*fPart(A/B))` or `remainder(A,B)` in modern mode
  // eg. `original * multiplier / divider` becomes `AB/C`
  var Op = new Class({
    Extends: Node,
    
    $node: 'Op',
    
    value1: null,
    value2: null,
    op: '',
    makeSimple: true,
    
    initialize: function Op(value1, op, value2, makeSimple) {
      this.value1 = value1 || new Value(); // allow +10 and -10 as standalone values, for now compile unoptimized to `0-10` etc.
      this.value2 = value2;
      this.op = op;
      this.makeSimple = makeSimple !== false;
    },
    
    isSimple: function isSimple() {
      return this.value1.isSimple() && this.value2.isSimple();
    },
    
    getType: function getType() {
      var types = [this.value1, this.value2].invoke('getType');
      if(types.contains('array')) {
        return 'array';
      }
      if(types.contains('string')) {
        return 'string';
      }
      return 'number';
    },
    
    simplify: function simplify(useModern) {
      if(this.isSimple()) try {
        var v1 = wrapIf(this.value1, useModern),
            v2 = wrapIf(this.value2, useModern);
        var origLen = (v1 + '' + v2).length + 1, value,
            vals = [
              this.value1.simplify().value,
              this.value2.simplify().value
            ];
        switch(this.op) {
          case '+': value = vals[0] + vals[1]; break;
          case '-': value = vals[0] - vals[1]; break;
          case '*': value = vals[0] * vals[1]; break;
          case '/': value = vals[0] / vals[1]; break;
          case '^': value = Math.pow(vals[0], vals[1]); break;
          case '%': value = (vals[0] % vals[1] + vals[1]) % vals[1]; break;
        }
        
        if(typeof value === 'number') {
          if((value + '').length <= origLen) {
            return new Value(value);
          }
        }
      } catch(e) { /* silence */ }
      return this;
    },
    
    hasPrecedenceOver: function hasPrecedenceOver(comp) {
      var signs = ['+-', '/*%', '^'],
          ownPrecedence = 0, otherPrecedence = 0,
          i = 0, l = signs.length;
      
      for(; i < l; i++) {
        if(signs[i].contains(this.op)) ownPrecedence = i;
        if(signs[i].contains(comp.op)) otherPrecedence = i;
      }
      
      return otherPrecedence > ownPrecedence;
    },
    
    compile: function compile(useModern) {
      var self = this.makeSimple ? this.simplify(useModern) : this;
      
      if(self.$node === 'Value') {
        return self.compile();
      }
      
      var v1 = self.value1.$node === 'Op' && self.hasPrecedenceOver(self.value1)
             ? self.value1.compile(useModern)
             : wrapIf(self.value1, useModern),
          v2 = self.value2.$node === 'Op' && self.hasPrecedenceOver(self.value2)
             ? self.value2.compile(useModern)
             : wrapIf(self.value2, useModern);
      
      if(this.op === '%') {
        return useModern ? 'remainder(' + v1 + ',' + v2 + ')' : v2 + '*(' + v1 + '<0)+iPart(' + v2 + '*fPart(' + v1 + '/' + v2 + '))';
      }
      
      if(this.op === '*' && (self.value1.$node === 'Variable' || self.value2.$node === 'Variable')) {
        return self.value2.$node == 'Value' ? v2 + v1 : v1 + v2;
      }
      return v1 + this.op + v2;
    }
  });
  
  // An IF statement
  // eg. `if test == 2` becomes `If A=2`
  // eg. `
  //   if test
  //     clrhome()
  //   else
  //     clrdraw()
  // ` becomes `If A:Then:ClrHome:Else:ClrDraw:End`
  var If = new Class({
    Extends: Node,
    
    $node: 'If',
    
    condition: null,
    code: null,
    ifFalse: null,
    
    initialize: function If(condition, code, ifFalse) {
      this.condition = condition;
      this.code = code;
      this.ifFalse = ifFalse ? ifFalse : false;
    },
    
    negate: function negate() {
      if(this.condition.$node == 'Compare') {
        this.condition.negate();
      }
      else {
        this.condition = new Call(
          'not',
          [this.condition]
        );
      }
      return this;
    },
    
    compile: function compile(useModern) {
      var cond = this.condition.simplify();
      if(cond.$node == 'Value') {
        if(cond.value == 1) {
          return this.code.compile(useModern);
        }
        else if(cond.value == 0) {
          return this.ifFalse ? this.ifFalse.compile(useModern) : '';
        }
      }
      
      var ti = 'If ' + this.condition.compile(useModern), needsEnd = !!this.ifFalse;
      if(instanceOf(this.code, Block) && this.code.getLength() > 1 || this.ifFalse) {
        ti += ':Then\n' + this.code.compile(useModern);
        needsEnd = true;
      }
      else {
        ti += '\n' + this.code.compile(useModern);
      }
      if(this.ifFalse) {
        ti += '\nElse\n' + this.ifFalse.compile(useModern);
      }
      
      return ti + (needsEnd ? '\nEnd' : '');
    }
  });
  
  // A FOR loop
  // eg. `for a from b to c / d by d` becomes `For(A,B,C/B,D`
  var For = new Class({
    Extends: Node,
    
    $node: 'For',
    
    variable: null,
    list: null,
    code: null,
    
    initialize: function For(variable, list, code) {
      this.variable = variable;
      this.list = list;
      this.code = code;
    },
    
    compile: function compile(useModern) {
      var list = this.list;
      if(list.$node == 'Range' || list.value && (list = list.value[0]).$node == 'Range') {
        var loop = 'For('
                 + this.variable.compile(useModern) + ','
                 + list.start.compile(useModern) + ','
                 + (list.inclusive ? list.end : new Op(list.end, '-', new Value(1))).compile(useModern)
                 + (list.step ? ',' + list.step.compile(useModern) : '');
        // end paren if an If node is present, see http://goo.gl/VAb6a
        // 6 sloc for 1 byte of optimization...
        function check(node) {
          return !node.ifFalse && (!instanceOf(node.code, Block) || node.code.getLength() < 2);
        };
        if(this.contains('If', check)) {
          loop += ')';
        }
      }
      else {
        var list = Variable.temporary(), len = Variable.temporary(), count = Variable.temporary();
          loop = new Assign(list, '=', this.list).compile(useModern) + '\n'
               + new Assign(len,  '=', new Call('array_length', list)).compile(useModern) + '\n'
               + 'For(' + count + ',1,' + len + '\n'
               + new Assign(this.variable, '=', new Access(list, count)).compile(useModern);
      }
      
      loop += '\n' + this.code.compile(useModern) + '\nEnd';
      
      return loop;
    }
  });
  
  // A WHILE or UNTIL loop
  // eg. `while this < that` becomes `While A<B`
  // eg. `until this >= that` becomes `Repeat A≥B`
  var While = new Class({
    Extends: Node,
    
    $node: 'While',
    
    condition: null,
    code: null,
    type: 'While',
    
    initialize: function While(condition, code, until) {
      this.condition = condition;
      this.code = code;
      if(until) {
        this.type = 'Repeat';
      }
    },
    
    compile: function compile() {
      return this.type + ' ' + this.condition.compile() + '\n' + this.code.compile() + '\nEnd';
    }
  });
  
  // Used to compare two values
  // eg. `huge >= small` becomes `A≥B`
  var Compare = new Class({
    Extends: Op,
    
    $node: 'Compare',
    
    initialize: function Compare(value1, type, value2, makeSimple) {
      this.value1 = value1;
      this.value2 = value2;
      this.type = type;
      this.makeSimple = makeSimple !== false;
    },
    
    isSimple: function isSimple() {
      return this.value1.isSimple() && this.value2.isSimple();
    },
    
    exec: function exec(v1, v2) {
      v1 = v1.value; v2 = v2.value;
      switch(this.type) {
        case '==':  return v1 === v2;
        case '!=':  return v1 !== v2;
        case '<=':  return v1 <=  v2;
        case '>=':  return v1 >=  v2;
        case  '<':  return v1  <  v2;
        case  '>':  return v1  >  v2;
        case '&&':  return !!(v1 && v2);
        case '||':  return !!(v1 || v2);
        case 'xor': return !!(v1 ^  v2);
      }
    },
    
    simplify: function simplify() {
      var v1 = this.value1.simplify(), v2 = this.value2.simplify();
      if(v1.$node == 'Value' && v2.$node == 'Value') {
        var val = this.exec(v1, v2);
        if(typeOf(val) == 'boolean') {
          return new Value(val);
        }
      }
      return this;
    },
    
    negate: function negate() {
      var negatable = {
        '==': '!=',
        '<=': '>',
        '>=': '<',
        '!=': '==',
        '>' : '<=',
        '<' : '>='
      };
      
      if(negatable[this.op]) {
        return new Op(this.value1, negatable[this.op], this.value2);
      }
      else {
        return new Call('not', this);
      }
    },
    
    compile: function compile(useModern) {
      var self = this.makeSimple ? this.simplify() : this;
      
      if(self.$node == 'Value') {
        return self.compile(useModern);
      }
      
      var sign = {
        '==': '=',
        '<=': '\u2264',
        '>=': '\u2265',
        '!=': '\u2260',
        '&&': ' and ',
        '||': ' or ',
        'xor': ' xor '
      }[self.type] || self.type;
      
      return wrapIf(self.value1, useModern) + sign + wrapIf(self.value2, useModern);
    }
  });
  
  // A function call. Function names are case insensitive.
  // eg. `DISP('some string')` becomes `Disp "some string"`
  // eg. `disp('some string')` becomes `Disp "some string"`
  // eg. `line(fromX, y, toX, y)` becomes `Line(B,A,C,A)`
  var Call = new Class({
    Extends: Node,
    
    $node: 'Call',
    
    name: '',
    params: [],
    
    initialize: function Call(name, params) {
      this.name = name.toLowerCase();
      this.params = Array.from(params);
    },
    
    getType: function getType() {
      var fnInfo = Call.FUNCTION_LIST[this.name];
      if(fnInfo && fnInfo.type) {
        return fnInfo.type;
      }
      
      if(/^str_/.test(this.name)) {
        return 'string';
      }
      if(/^array_/.test(this.name)) {
        return 'array';
      }
      
      return 'number';
    },
    
    compile: function compile(useModern) {
      var fnInfo = Call.FUNCTION_LIST[this.name];
      
      var args = fnInfo.args != null ? Array.from(fnInfo.args) : false;
      
      if(typeOf(fnInfo) === 'function') {
        return fnInfo(this.params, nodes);
      }
      
      if(args && !args.contains(this.params.length) && !args.contains(true)) {
        throw Error('Wrong parameter count for `' + this.name + '`, got ' + this.params.length + ', expected ' + args.join(' or '));
      }
      
      if(!this.params.length) {
        return fnInfo.name;
      }
      
      var params = this.params.invoke('compile', useModern).join(',');
      return fnInfo.name + (fnInfo.parens ? wrap(params) : ' ' + params);
    }
  });
  // holds function definitions
  Call.FUNCTION_LIST;
  
  // A literal piece of Basic or Assembly (impossible to use because of variable renaming)
  var Native = new Class({
    Extends: Node,
    
    code: '',
    
    initialize: function Native(code) {
      this.code = code;
    },
    
    compile: function compile() {
      return '\n' + this.code + '\n';
    }
  });
  
  // An `in` expression
  // eg. `a in [1, 2, 3]` => `sum(A={1,2,3`
  // eg. `for a in list` => `For(I,1,dim(∟ARR01)):∟ARR01(I)->A`
  var In = new Class({
    Extends: Node,
    
    $node: 'In',
    
    value: null,
    list: null,
    
    initialize: function In(value, list) {
      this.value = value;
      this.list = list;
    },
    
    getType: function getType() {
      return 'number';
    },
    
    compile: function compile(useModern) {
      return new Call(
        'array_sum',
        new Compare(
          this.value,
          '==',
          this.list
        )
      ).compile(useModern);
    }
  });
  
  // A function definition
  // eg. `function a arg1, arg2 { return arg1 * arg2 }` =>
  //   `If X=1:Then:∟ARG01(1)*∟ARG01(2):Return:End`
  // where X holds the function number, ∟ARGxx holds the argument list, and Ans will hold the return value.
  var FnDef = new Class({
    Extends: Node,
    
    $node: 'Function',
    
    name: null,
    params: null,
    code: null,
    id: 0,
    
    initialize: function FnDef(name, params, code) {
      this.name = name;
      this.params = params;
      this.code = code;
      var id = this.id = FnDef.count++;
      
      FnDef.paramMap[name] = 'ARG' + id.toString(36).toUpperCase();
    },
    
    compile: function compile(useModern) {
      // obviously not what it's going to be like eventually...
      return 'Func ' + this.name + '(' + this.params.invoke('compile').join(',') + ')\n'
           + 'Then\n'
           + this.code.compile(useModern)
           + 'End\n'
    }
  });
  
  // list of parameter lists
  FnDef.paramMap;
  FnDef.count;
  
  var nodes = {
    Block: Block,
    Line: Line,
    
    If: If,
    For: For,
    While: While,
    Native: Native,
    FnDef: FnDef,
    
    Value: Value,
    Variable: Variable,
    Range: Range,
    Commas: Commas,
    
    Op: Op,
    In: In,
    Compare: Compare,
    Assign: Assign,
    Access: Access,
    Call: Call,
    
    init: init
  };
  
  return nodes;
});
