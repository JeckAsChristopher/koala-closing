

'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');

const ALLOWED_KEYS = new Set([
  'obfuscationLevel', 'includeTests', 'injectJunkFiles', 'junkFileCount',
  'outputSuffix', 'chunkFolders', 'restoreEnabled', 'logFile', 'excludePatterns'
]);

async function configCommand(action, key, value, projectPath = '.') {
  const absPath = path.resolve(projectPath);
  const cfgPath = path.join(absPath, 'koala.config.json');

  if (!fs.existsSync(cfgPath)) {
    console.error(chalk.red('[error]  koala.config.json not found. Run `koala-closing init` first.'));
    process.exit(1);
  }

  const cfg = fs.readJsonSync(cfgPath);

  if (!action || action === 'get') {
    if (key) {
      if (!ALLOWED_KEYS.has(key)) {
        console.error(chalk.red(`[error]  Unknown config key: "${key}"`));
        process.exit(1);
      }
      if (!(key in cfg)) {
        console.error(chalk.red(`[error]  Key "${key}" not found in config.`));
        process.exit(1);
      }
      console.log(chalk.cyan(key + ':'), JSON.stringify(cfg[key]));
    } else {
      
      console.log(chalk.bold('koala.config.json:'));
      for (const k of ALLOWED_KEYS) {
        if (k in cfg) console.log('  ' + chalk.cyan(k) + ': ' + JSON.stringify(cfg[k]));
      }
    }
    return;
  }

  if (action === 'set') {
    if (!key || value === undefined) {
      console.error(chalk.red('[error]  Usage: config set <key> <value>'));
      process.exit(1);
    }
    if (!ALLOWED_KEYS.has(key)) {
      console.error(chalk.red(`[error]  Unknown config key: "${key}". Allowed keys: ${[...ALLOWED_KEYS].join(', ')}`));
      process.exit(1);
    }
    
    let parsed;
    if (value === 'true')       parsed = true;
    else if (value === 'false') parsed = false;
    else if (!isNaN(Number(value)) && value !== '') parsed = Number(value);
    else parsed = value;

    cfg[key] = parsed;
    fs.writeJsonSync(cfgPath, cfg, { spaces: 2 });
    console.log(chalk.green(`[ok]  Set ${key} = ${JSON.stringify(parsed)}`));
    return;
  }

  console.error(chalk.red(`[error]  Unknown action: ${action}. Use 'get' or 'set'.`));
  process.exit(1);
}

module.exports = configCommand;
