define(['ti-advance/index'], function(lang) {
  window.addEvent('domready', function() {
    $('c').addEvent('click', function() {
      $('b').value = lang.parse($('a').value);
    });
  });
});
