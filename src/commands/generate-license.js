'use strict';

const fs       = require('fs-extra');
const path     = require('path');
const inquirer = require('inquirer');
const chalk    = require('chalk');
const { generateLicense } = require('../core/license');

async function generateLicenseCommand(projectPath) {
  const absPath = path.resolve(projectPath);

  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`[error]  Directory not found: ${absPath}`));
    process.exit(1);
  }

  const pkgPath = path.join(absPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(chalk.red('[error]  No package.json found.'));
    process.exit(1);
  }

  const pkg         = fs.readJsonSync(pkgPath);
  const projectName = pkg.name || path.basename(absPath);

  console.log('');
  console.log(chalk.bold.cyan('---  Koala-Closing License Generator  ---'));
  console.log(chalk.dim(`Project: ${projectName}`));
  console.log('');

  const answers = await inquirer.prompt([
    {
      type:     'input',
      name:     'ownerName',
      message:  'Company / Person name:',
      validate: (v) => v.trim().length >= 2 || 'Name must be at least 2 characters.'
    },
    {
      type:     'password',
      name:     'password',
      message:  'Secure password (min 10 characters):',
      mask:     '*',
      validate: (v) => v.length >= 10 || 'Password must be at least 10 characters.'
    },
    {
      type:     'password',
      name:     'passwordConfirm',
      message:  'Verify secure password:',
      mask:     '*',
      validate: (v, a) => v === a.password || 'Passwords do not match.'
    }
  ]);

  const { ownerName, password } = answers;

  try {
    const licensePath = generateLicense({
      projectPath: absPath,
      projectName,
      ownerName:   ownerName.trim(),
      password
    });

    console.log('');
    console.log(chalk.green('[ok]  License file generated:'), chalk.bold(path.basename(licensePath)));
    console.log(chalk.dim(`   Path: ${licensePath}`));
    console.log(chalk.yellow('[warn]  Keep your password safe -- it is required to verify and restore this project.'));
    console.log('');
    _appendAuditLog(absPath, `generate-license owner="${ownerName.trim()}" project="${projectName}"`);
  } catch (err) {
    console.error(chalk.red('[error]  License generation failed: ' + err.message));
    process.exit(1);
  }
}

function _appendAuditLog(projectPath, message) {
  try {
    const cfgPath = path.join(projectPath, 'koala.config.json');
    const cfg     = fs.existsSync(cfgPath) ? fs.readJsonSync(cfgPath) : {};
    const logFile = cfg.logFile || 'koala.audit.log';
    const logPath = path.join(projectPath, logFile);
    const entry   = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logPath, entry, 'utf8');
  } catch (_) {}
}

module.exports = generateLicenseCommand;
