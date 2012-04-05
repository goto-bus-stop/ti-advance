(function() {

function deprecated() { throw Error('deprecated') }

Object.extend({
  copy: function(obj) {
    function f() {};
    f.prototype = obj;
    return new f;
  }
});

String.implement({
  bumpyCase: function() {
    var cameled = this.camelCase();
    return cameled.charAt(0).toUpperCase() + cameled.substr(1);
  },
  
  dedent: function() {
    var line = '', lines = this.replace(/^\n+/, '').split('\n'), i = 0;
    while((line = lines[i]) || true) {
      i++;
      if(line.trim().length > 0) break;
    }
    var level = /^\n?(\s*)/.exec(line)[1].length;
    return lines.each(function(line, i, l) {
      l[i] = line.substr(level);
    }).join('\n');
  },
  
  ClassCase: deprecated
});

Function.implement('partial', function() {
  var self = this, args = Array.from(arguments);
  return function() {
    self.apply(this, args.append(arguments));
  };
});

Array.implement('split', function(on) {
  var splits = [], value = [], isRegex = typeOf(on) == 'regexp', isFn = typeOf(on) == 'function';
  this.each(function(val) {
    if(isRegex ? on.test(val) : (isFn ? on(val) : on == val)) {
      splits.push(value);
      value = [];
    }
    else {
      value.push(val);
    }
  });
  
  splits.push(value);
  
  return splits;
});

})();
