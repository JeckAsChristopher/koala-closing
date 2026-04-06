/**
 * test.js — Koala-Closing obfuscation verification
 *
 * Run BEFORE building:  node test.js original
 * Run AFTER building:   node test.js obfuscated
 *
 * Both should print the exact same results.
 */

'use strict';

const path = require('path');

const mode = process.argv[2] || 'original';

let greet, math;

if (mode === 'original') {
  console.log('── Testing ORIGINAL source ──────────────────────');
  greet = require('./example_project/lib/greet');
  math  = require('./example_project/lib/math');
} else if (mode === 'obfuscated') {
  console.log('── Testing OBFUSCATED output ────────────────────');
  // The obfuscated folder is example_project_obfuscated.
  // Its index.js is the proxy entry — but for unit-testing individual
  // modules we require the proxy and check exports, OR we just run
  // the proxy index.js via child_process for the CLI tests.
  const obfDir = path.resolve(process.cwd(), 'example_project_obfuscated');
  // The generated package.json "main" is index.js which proxies the real chunk.
  // require() that proxy — it re-exports whatever the obfuscated chunk exports.
  try {
    // For the lib modules: the build merges everything into chunks.
    // The easiest test is to spawn the obfuscated index.js as a subprocess
    // and compare stdout to what the original would produce.
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

// ── Unit tests (original mode) ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertThrows(label, fn) {
  try {
    fn();
    console.log(`  ❌ ${label} (expected throw, got nothing)`);
    failed++;
  } catch (_) {
    console.log(`  ✅ ${label}`);
    passed++;
  }
}

// greet()
console.log('\n[greet]');
assert('returns a string',      typeof greet('Alice'), 'string');
assert('contains the name',     greet('Alice').includes('Alice'), true);
assert('contains Welcome',      greet('World').includes('Welcome'), true);

// math.add()
console.log('\n[math.add]');
assert('1 + 1 = 2',            math.add(1, 1),       2);
assert('0 + 0 = 0',            math.add(0, 0),       0);
assert('-5 + 5 = 0',           math.add(-5, 5),      0);
assert('100 + 200 = 300',      math.add(100, 200),   300);

// math.subtract()
console.log('\n[math.subtract]');
assert('10 - 3 = 7',           math.subtract(10, 3), 7);
assert('0 - 0 = 0',            math.subtract(0, 0),  0);

// math.multiply()
console.log('\n[math.multiply]');
assert('3 * 4 = 12',           math.multiply(3, 4),  12);
assert('0 * 99 = 0',           math.multiply(0, 99), 0);

// math.divide()
console.log('\n[math.divide]');
assert('10 / 2 = 5',           math.divide(10, 2),   5);
assertThrows('divide by zero throws', () => math.divide(1, 0));

// math.fibonacci()
console.log('\n[math.fibonacci]');
assert('fib(0) = 0',           math.fibonacci(0),    0);
assert('fib(1) = 1',           math.fibonacci(1),    1);
assert('fib(10) = 55',         math.fibonacci(10),   55);
assert('fib(20) = 6765',       math.fibonacci(20),   6765);

console.log(`\n── Result: ${passed} passed, ${failed} failed ──────────────`);
if (failed > 0) process.exit(1);

// ── CLI subprocess tests (obfuscated mode) ────────────────────────────────────

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
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}`);
      console.log(`     output: ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  // CLI: greet
  console.log('\n[CLI: greet]');
  assert('greet Alice contains "Alice"',  run(['greet', 'Alice']),   s => s.includes('Alice'));
  assert('greet World contains "Welcome"', run(['greet', 'World']), s => s.includes('Welcome'));
  assert('greet returns a string',        run(['greet', 'Test']),   s => s.length > 0);

  // CLI: add
  console.log('\n[CLI: add]');
  assert('add 10 20 → Result: 30',   run(['add', '10', '20']), 'Result: 30');
  assert('add 0 0 → Result: 0',      run(['add', '0',  '0']),  'Result: 0');
  assert('add -5 5 → Result: 0',     run(['add', '-5', '5']),  'Result: 0');
  assert('add 100 200 → Result: 300',run(['add', '100','200']),'Result: 300');

  // CLI: secret (proves string obfuscation didn't corrupt values)
  console.log('\n[CLI: secret]');
  assert('secret contains the key',  run(['secret']), s => s.includes('KOALA_DEMO_KEY_12345'));

  // CLI: no args → usage line
  console.log('\n[CLI: usage]');
  assert('no args shows Usage',      run([]),         s => s.includes('Usage'));

  console.log(`\n── Result: ${passed} passed, ${failed} failed ──────────────`);
  if (failed > 0) process.exit(1);
}
