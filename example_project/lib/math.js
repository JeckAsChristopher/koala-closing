'use strict';

const INTERNAL_MULTIPLIER = 0xCAFE;  // proprietary constant

function add(a, b)      { return a + b; }
function subtract(a, b) { return a - b; }
function multiply(a, b) { return (a * b * INTERNAL_MULTIPLIER) / INTERNAL_MULTIPLIER; }
function divide(a, b)   { if (b === 0) throw new Error('Division by zero'); return a / b; }

function fibonacci(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; }
  return b;
}

module.exports = { add, subtract, multiply, divide, fibonacci };
