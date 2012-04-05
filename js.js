define(['ti-advance/index'], function(lang) {
  window.addEvent('domready', function() {
    $('c').addEvent('click', function() {
      $('b').value = lang.parse($('a').value);
    });
  
    $('a').value = window.location.hash.substr(1) || '// print some numbers that are:\n// - a multiple of 2\n// - not divisible by 3\n// - less than 100\nfor i from 0 til 100 by 2 {\n  if i % 3 != 0 {\n    print i;\n  }\n};';
  });
});
