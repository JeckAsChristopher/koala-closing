'use strict';

function greet(name) {
  const hour = new Date().getHours();
  let prefix;
  if (hour < 12)       prefix = 'Good morning';
  else if (hour < 18)  prefix = 'Good afternoon';
  else                 prefix = 'Good evening';
  return `${prefix}, ${name}! Welcome to the example project.`;
}

module.exports = greet;
