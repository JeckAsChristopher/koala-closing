'use strict';

const math = require('../lib/math');
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

assert(math.add(2, 3) === 5,         'add(2,3) === 5');
assert(math.subtract(10, 4) === 6,   'subtract(10,4) === 6');
assert(math.multiply(3, 4) === 12,   'multiply(3,4) === 12');
assert(math.divide(10, 2) === 5,     'divide(10,2) === 5');
assert(math.fibonacci(7) === 13,     'fibonacci(7) === 13');

let threw = false;
try { math.divide(1, 0); } catch (_) { threw = true; }
assert(threw, 'divide by zero throws');

console.log('All tests passed.');
