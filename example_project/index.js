#!/usr/bin/env node
/**
 * example_project/index.js
 * A minimal Node.js CLI used to demonstrate Koala-Closing.
 */

'use strict';

const greet = require('./lib/greet');
const math  = require('./lib/math');

const args = process.argv.slice(2);

if (args[0] === 'greet') {
  console.log(greet(args[1] || 'World'));
} else if (args[0] === 'add') {
  const result = math.add(Number(args[1]), Number(args[2]));
  console.log(`Result: ${result}`);
} else if (args[0] === 'secret') {
  console.log('The secret key is: KOALA_DEMO_KEY_12345');
} else {
  console.log('Usage: node index.js [greet|add|secret] [args...]');
}
