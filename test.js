

'use strict';

const path = require('path');

const mode = process.argv[2] || 'original';

let greet, math;

if (mode === 'original') {
  console.log('--- Testing ORIGINAL source ---');
  greet = require('./example_project/lib/greet');
  math  = require('./example_project/lib/math');
} else if (mode === 'obfuscated') {
  console.log('--- Testing OBFUSCATED output ---');
  
  
  
  
  const obfDir = path.resolve(process.cwd(), 'example_project_obfuscated');
  
  
  try {
    
    
    
    runCLITests(obfDir);
    return;
  } catch (e) {
    console.error('Failed to load obfuscated output:', e.message);
    process.exit(1);
  }
} else {
  console.error('Usage: node test.js [original|obfuscated]');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  [pass] ${label}`);
    passed++;
  } else {
    console.log(`  [fail] ${label}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertThrows(label, fn) {
  try {
    fn();
    console.log(`  [fail] ${label} (expected throw, got nothing)`);
    failed++;
  } catch (_) {
    console.log(`  [pass] ${label}`);
    passed++;
  }
}

console.log('\n[greet]');
assert('returns a string',      typeof greet('Alice'), 'string');
assert('contains the name',     greet('Alice').includes('Alice'), true);
assert('contains Welcome',      greet('World').includes('Welcome'), true);

console.log('\n[math.add]');
assert('1 + 1 = 2',            math.add(1, 1),       2);
assert('0 + 0 = 0',            math.add(0, 0),       0);
assert('-5 + 5 = 0',           math.add(-5, 5),      0);
assert('100 + 200 = 300',      math.add(100, 200),   300);

console.log('\n[math.subtract]');
assert('10 - 3 = 7',           math.subtract(10, 3), 7);
assert('0 - 0 = 0',            math.subtract(0, 0),  0);

console.log('\n[math.multiply]');
assert('3 * 4 = 12',           math.multiply(3, 4),  12);
assert('0 * 99 = 0',           math.multiply(0, 99), 0);

console.log('\n[math.divide]');
assert('10 / 2 = 5',           math.divide(10, 2),   5);
assertThrows('divide by zero throws', () => math.divide(1, 0));

console.log('\n[math.fibonacci]');
assert('fib(0) = 0',           math.fibonacci(0),    0);
assert('fib(1) = 1',           math.fibonacci(1),    1);
assert('fib(10) = 55',         math.fibonacci(10),   55);
assert('fib(20) = 6765',       math.fibonacci(20),   6765);

console.log(`\n--- Result: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);

function runCLITests(obfDir) {
  const { execFileSync } = require('child_process');

  function run(args) {
    try {
      return execFileSync(process.execPath, [path.join(obfDir, 'index.js'), ...args], {
        encoding: 'utf8',
        timeout: 10000
      }).trim();
    } catch (e) {
      const stderr = (e.stderr || '').trim();
      const stdout = (e.stdout || '').trim();
      return ('ERROR: ' + (stderr || stdout || e.message)).trim();
    }
  }

  let passed = 0;
  let failed = 0;

  function assert(label, actual, check) {
    const ok = typeof check === 'function' ? check(actual) : actual === check;
    if (ok) {
      console.log(`  [pass] ${label}`);
      passed++;
    } else {
      console.log(`  [fail] ${label}`);
      console.log(`     output: ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  
  console.log('\n[CLI: greet]');
  assert('greet Alice contains "Alice"',  run(['greet', 'Alice']),   s => s.includes('Alice'));
  assert('greet World contains "Welcome"', run(['greet', 'World']), s => s.includes('Welcome'));
  assert('greet returns a string',        run(['greet', 'Test']),   s => s.length > 0);

  
  console.log('\n[CLI: add]');
  assert('add 10 20 → Result: 30',   run(['add', '10', '20']), 'Result: 30');
  assert('add 0 0 → Result: 0',      run(['add', '0',  '0']),  'Result: 0');
  assert('add -5 5 → Result: 0',     run(['add', '-5', '5']),  'Result: 0');
  assert('add 100 200 → Result: 300',run(['add', '100','200']),'Result: 300');

  
  console.log('\n[CLI: secret]');
  assert('secret contains the key',  run(['secret']), s => s.includes('KOALA_DEMO_KEY_12345'));

  
  console.log('\n[CLI: usage]');
  assert('no args shows Usage',      run([]),         s => s.includes('Usage'));

  console.log(`\n--- Result: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) process.exit(1);
}
