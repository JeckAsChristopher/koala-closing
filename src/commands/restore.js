'use strict';

const fs       = require('fs-extra');
const path     = require('path');
const inquirer = require('inquirer');
const chalk    = require('chalk');
const ora      = require('ora');
const { decrypt }    = require('../core/encryption');
const { findLicenseFile, verifyLicense } = require('../core/license');

async function restoreCommand(obfuscatedPath) {
  const absPath = path.resolve(obfuscatedPath);

  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`[error]  Directory not found: ${absPath}`));
    process.exit(1);
  }

  const restorePath = path.join(absPath, '.koala_restore.enc');
  if (!fs.existsSync(restorePath)) {
    console.error(chalk.red('[error]  No restore map found. Build must have been run with restoreEnabled: true.'));
    process.exit(1);
  }

  const licenseFile = findLicenseFile(absPath);
  if (!licenseFile) {
    console.error(chalk.red('[error]  No license file found.'));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.cyan('---  Koala-Closing Restore  ---'));
  console.log(chalk.yellow('[warn]  Restore is intended for authorized internal debugging only.'));
  console.log('');

  const { password } = await inquirer.prompt([
    {
      type:    'password',
      name:    'password',
      message: 'Enter license password:',
      mask:    '*',
      validate: (v) => v.length >= 10 || 'Password must be at least 10 characters.'
    }
  ]);

  
  const licResult = verifyLicense(absPath, password);
  if (!licResult.valid) {
    console.error(chalk.red('[error]  License verification failed: ' + licResult.error));
    process.exit(1);
  }

  const spinner = ora('Restoring files').start();

  let restoreMap;
  try {
    const encData   = fs.readFileSync(restorePath, 'utf8');
    const decrypted = decrypt(encData, password);
    if (!decrypted) throw new Error('Decryption failed -- wrong password.');
    restoreMap = JSON.parse(decrypted);
  } catch (err) {
    spinner.fail('Restore failed.');
    console.error(chalk.red('[error]  ' + err.message));
    process.exit(1);
  }

  
  const restoreDir = absPath.replace(/_obfuscated$/, '') + '_restored';
  fs.mkdirpSync(restoreDir);

  let count = 0;
  for (const [relPath, encSource] of Object.entries(restoreMap)) {
    const source = decrypt(encSource, password);
    if (!source) {
      spinner.warn(`Could not restore: ${relPath}`);
      continue;
    }
    const outFile = path.join(restoreDir, relPath);
    fs.mkdirpSync(path.dirname(outFile));
    fs.writeFileSync(outFile, source, 'utf8');
    count++;
  }

  
  const origPkg = path.join(absPath, 'package.json');
  if (fs.existsSync(origPkg)) {
    const pkg = fs.readJsonSync(origPkg);
    delete pkg._koala;
    pkg.name = (pkg.name || '').replace(/-protected$/, '');
    fs.writeJsonSync(path.join(restoreDir, 'package.json'), pkg, { spaces: 2 });
  }

  spinner.succeed(`Restored ${count} file(s).`);
  console.log('');
  console.log(chalk.green('[ok]  Restored to:'), chalk.bold(restoreDir));
  console.log(chalk.dim(`   Owner: ${licResult.owner} | Project: ${licResult.projectName}`));
  console.log('');
}

module.exports = restoreCommand;
