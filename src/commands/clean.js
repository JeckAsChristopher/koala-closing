

'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');

const TEMP_PATTERNS = [
  '*.tmp', '.koala_restore.enc', 'koala.audit.log'
];

async function cleanCommand(projectPath) {
  const absPath = path.resolve(projectPath);

  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`[error]  Directory not found: ${absPath}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.cyan('---  Koala-Closing Clean  ---'));

  let removed = 0;
  const entries = fs.readdirSync(absPath, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(absPath, entry.name);

    
    if (entry.isFile() && entry.name.endsWith('.tmp')) {
      fs.removeSync(full);
      console.log(chalk.dim(`  Removed: ${entry.name}`));
      removed++;
    }

    
    if (entry.isFile() && entry.name === 'koala.audit.log') {
      fs.removeSync(full);
      console.log(chalk.dim(`  Removed: ${entry.name}`));
      removed++;
    }

    
    if (entry.isFile() && entry.name === '.koala_restore.enc') {
      fs.removeSync(full);
      console.log(chalk.dim(`  Removed: ${entry.name}`));
      removed++;
    }
  }

  if (removed === 0) {
    console.log(chalk.dim('  Nothing to clean.'));
  } else {
    console.log('');
    console.log(chalk.green(`[ok]  Removed ${removed} file(s).`));
  }
  console.log('');
}

module.exports = cleanCommand;
