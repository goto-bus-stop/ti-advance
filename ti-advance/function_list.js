define({
  // "Flow control"
  pause: {name: 'Pause', parens: false, args: [0, 1]},
  goto: {name: 'Goto', parens: false, args: 1},
  label: {name: 'Lbl', parens: false, args: 1},
  menu: {name: 'Menu', parens: true, args: [3, 5, 7, 9, 11, 13, 15]},
  exit: {name: 'Stop', parens: false, args: 0},
  die: {name: 'Stop', parens: false, args: 0},
  setgraphstyle: {name: 'GraphStyle', parens: true, args: 1},
  
  // In/Output
  disp: {name: 'Disp', parens: false},
  echo: {name: 'Disp', parens: false},
  print: {name: 'Disp', parens: false},
  clrhome: {name: 'ClrHome', parens: false, args: 0},
  clrscreen: {name: 'ClrHome:ClrDraw', parens: false, args: 0},
  output: {name: 'Output', parens: true, args: 3},
  getkey: {name: 'getKey', parens: false, args: 0},
  prompt: {name: 'Prompt', parens: false},
  
  // Drawing / Graphing
  draw_line: {name: 'Line', parens: true, args: [4, 5]},
  clrdraw: {name: 'ClrDraw', parens: false, args: 0},
  text: {name: 'Text', parens: true, args: [3, true]},
  circle: {name: 'Circle', parens: true, args: 3},
  shade: {name: 'Shade', parens: true, args: [2, 3, 4, 5, 6]},
  // Pt-Stuff
  pton: {name: 'Pt-On', parens: true, args: [2, 3]},
  pt_on: {name: 'Pt-On', parens: true, args: [2, 3]},
  ptoff: {name: 'Pt-Off', parens: true, args: [2, 3]},
  pt_off: {name: 'Pt-Off', parens: true, args: [2, 3]},
  ptchange: {name: 'Pt-Change', parens: true, args: 2},
  pt_change: {name: 'Pt-Change', parens: true, args: 2},
  pttoggle: {name: 'Pt-Change', parens: true, args: 2},
  pt_toggle: {name: 'Pt-Change', parens: true, args: 2},
  // Pxl-Stuff
  pxlon: {name: 'Pxl-On', parens: true, args: 2},
  pxl_on: {name: 'Pxl-On', parens: true, args: 2},
  pxloff: {name: 'Pxl-Off', parens: true, args: 2},
  pxl_off: {name: 'Pxl-Off', parens: true, args: 2},
  pxlchange: {name: 'Pxl-Change', parens: true, args: 2},
  pxl_change: {name: 'Pxl-Change', parens: true, args: 2},
  pxltoggle: {name: 'Pxl-Change', parens: true, args: 2},
  pxl_toggle: {name: 'Pxl-Change', parens: true, args: 2},
  pxltest: {name: 'pxl-Test', parens: true, args: 2},
  
  // Math
  abs: {name: 'abs', parens: true, args: 1},
  round: {name: 'round', parens: true, args: [1, 2]},
  rand_int: {name: 'randInt', parens: true, args: 2},
  random: {name: 'rand', parens: false, args: 0},
  
  // Timing
  gettime: {name: 'getTime', parens: false, args: 0},
  
  // Arrays
  array_sum: {name: 'sum', parens: true, args: 1, type: 'number'},
  array_count: {name: 'dim', parens: true, args: 1, type: 'number'},
  array_length: {name: 'dim', parens: true, args: 1, type: 'number'},
  
  // Strings
  str_length: {name: 'length', parens: true, args: 1, type: 'number'},
  str_sub: {name: 'sub', parens: true, args: [2, 3], type: 'number'},
  
  // Bools
  not: {name: 'not', parens: true, args: 1, type: 'boolean'},
  
  //- Customs
  
  // Path drawing
  draw_path: function(path, n) {
    var rules = [];
    for(var i = 0, l = path.length - 2; i < l; i += 2) {
      rules.push(new n.Call('draw_line', path.slice(i, i + 4)));
    }
    return new n.Line(rules).compile();
  },
  // Connected path
  draw_shape: function(path, n) {
    var code = new n.Line(
      new n.Call('draw_path', path),
      new n.Call('draw_line', path.slice(-2).concat(path.slice(0, 2)))
    );
    return code.compile();
  },
  // random number
  rand: function(extremes, n) {
    var min = extremes[0] || new Value(), max = extremes[1] || new Value(1);
    return new n.Op(
      min,
      '+',
      new n.Op(
        new n.Call('rand'),
        '*',
        new n.Op(
          max,
          '-',
          min
        )
      )
    ).compile();
  },
  // wrapping function for aesthetical reasons
  do: function(ast, n) {
    return new n.Line(ast).compile();
  }
});
