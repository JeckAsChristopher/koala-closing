'use strict';

const fs   = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const DEFAULT_CONFIG = {
  obfuscationLevel:   'high',       
  includeTests:       false,        
  injectJunkFiles:    true,         
  junkFileCount:      3,            
  outputSuffix:       '_obfuscated',
  chunkFolders:       3,            
  restoreEnabled:     false,        
  logFile:            'koala.audit.log',
  excludePatterns:    ['node_modules', '.git', '*.test.js', '*.spec.js', '*.license']
};

async function initCommand(projectPath) {
  const absPath = path.resolve(projectPath);

  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`[error]  Directory not found: ${absPath}`));
    process.exit(1);
  }

  const pkgPath = path.join(absPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(chalk.red('[error]  No package.json found. Is this a Node.js project?'));
    process.exit(1);
  }

  const cfgPath = path.join(absPath, 'koala.config.json');
  if (fs.existsSync(cfgPath)) {
    console.log(chalk.yellow('[warn]  koala.config.json already exists. Skipping.'));
  } else {
    fs.writeJsonSync(cfgPath, DEFAULT_CONFIG, { spaces: 2 });
    console.log(chalk.green('[ok]  Created koala.config.json'));
  }

  
  const pkg    = fs.readJsonSync(pkgPath);
  const jsFiles = countJsFiles(absPath);

  console.log('');
  console.log(chalk.bold('Project Summary'));
  console.log(chalk.cyan('  Name:    ') + (pkg.name || '(unnamed)'));
  console.log(chalk.cyan('  Version: ') + (pkg.version || 'N/A'));
  console.log(chalk.cyan('  JS Files:') + ' ' + jsFiles);
  console.log('');
  console.log(chalk.green('[ok]  Project initialized. Run `koala-closing generate-license` then `koala-closing build`.'));
}

function countJsFiles(dir) {
  let count = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) count++;
    }
  };
  walk(dir);
  return count;
}

module.exports = initCommand;
