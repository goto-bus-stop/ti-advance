TI+Advance
==========

TI+Advance is a tiny language that compiles down to TI-Basic. It has some nice higher-level structures and other useful utilities.
It's nowhere near done, (for example, it's impossible to use anything more than one control structure per block), but it's a work in progress.

In development for an informatics class project.

What we have
============

Well, some nice things, like *variable naming*:

    factor   = 10;
    base     = 11;
    multiple = factor * base;

\>>

    10→A
    11→B
    AB→C

Or *compound assignment*:

    amount  = 10;
    amount += 5;
    amount /= 10;
    amount *= 2;
    amount ^= 0.5;

\>>

    10→A
    A+5→A
    A/10→A
    2A→A
    A^0.5→A

And *ranges*:

    inclusive = [0 to  35 by 5];
    exclusive = [0 til 35 by 5];

\>>

    {0,5,10,15,20,25,30,35→∟ARR1
    {0,5,10,15,20,25,30→∟ARR2

Arrays are enclosed in `[` `]`, not `{` `}`. They cannot (yet??) be nested, and may only contain numbers.

Ranges can be used perfectly in *for loops*: (a bit like Coffeescript)

    for i in [0 to 100] {
      print i;
    }

\>>

    For(A,0,100,1
    Disp A
    End

Or, nicer, like this, which is exactly the same:

    for i from 0 to 100 {
      print i;
    }

\>>

    For(A,0,100,1
    Disp A
    End

There's some sort of *if statement*s as well,

    if a == true {
      print 'a is true!';
    }
    else {
      print 'a is not true :(';
    }

\>>

    If A=1:Then
    Disp "a is true!"
    Else
    Disp "a is not true :("
    End

`true` and `false` are converted to `1` and `0`, respectively. This means that `false == 0`, but there's not often need to distingiush.

Oh! And these can be easily *negated* as well:

    unless a == true {
      print 'a is not true :(';
    }
    else {
      print 'a is true!';
    }

\>>

    If not(A=1):Then
    Disp "a is not true :("
    Else
    Disp "a is true!"
    End

As can a *while* loop:

    while a {
      a--;
    }

\>>

    While A
    A-1→A
    End

or:

    until a {
      a++;
    }

\>>

    Repeat A
    A+1→A
    End

But there's more! Numbers can be specified with *different radices*, in a similar fashion to Coffeescript and Coco:

    normal      = 123;
    hexadecimal = 0x7b;
    octal       = 0o173;
    binary      = 0b1111011;
    variable    = 5r443;
    variable_2  = 25r4n;
    ti_advance  = 36radvance;

\>>

    123→A
    123→B
    123→C
    123→D
    123→E
    123→F
    22606448558→G

We also do some simple *optimalisations*:

    a = 200 * 2 * 3.4;
    if false {
      // do ten-thousand interesting things, and then
      print the_result;
    }
    else {
      print 'There\'s not much to do :)';
    }

\>>

    1360→A
    Disp "There's not much to do :)"

Hey! *Comments*! Well-spotted ;).

Oh, and there's a nice *modulo* operator too.

    a % b;
    c %= d;

\>>

    remainder(A,B)
    remainder(C,D→C

And a sort-of *foreach* loop!

    list = [0 til 100 by 7];
    for var in list {
      print var;
    }

\>>

    {0,7,14,21,28,35,42,49,56,63,70,77,84,91,98→∟ARR1
    ∟ARR1→∟ARR2
    dim(∟ARR2→D
    For(E,1,D
    ∟ARR2(E→B
    Disp B
    End

(note: this is indeed not very optimized.)

IMPORTANT(?) NOTE
=================

This is under heavy development. Nothing works, but some things act like they do. No code optimization has been done. Some parts are over-commented, while others lack comments at all.  
Very few areas of the language are covered so far. The compiler is **extremely** buggy. Please, do not rely on anything in here.  
It also does not throw sensible errors, if at all.
