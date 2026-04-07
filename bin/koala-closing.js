#!/usr/bin/env node

'use strict';

const { program } = require('../src/cli');
program.parseAsync(process.argv).catch((err) => {
  const chalk = require('chalk');
  console.error(chalk.red('[error]  Fatal: ' + (err && err.message ? err.message : err)));
  process.exit(1);
});
