'use strict';

const fs    = require('fs-extra');
const path  = require('path');
const chalk = require('chalk');
const ora   = require('ora');

const { decrypt }       = require('../core/encryption');
const { buildManifest } = require('../core/integrity');
const { findLicenseFile, readLicenseHeader } = require('../core/license');
const native            = require('../core/native-bridge');

async function verifyCommand(obfuscatedPath) {
  const absPath = path.resolve(obfuscatedPath);
  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`directory not found: ${absPath}`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.cyan('koala-closing verify'));

  const manifestPath = path.join(absPath, '.koala_manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(chalk.red('no .koala_manifest.json found -- not a koala-protected package'));
    process.exit(1);
  }

  const licenseFile = findLicenseFile(absPath);
  if (!licenseFile) {
    console.error(chalk.red('no .license file found'));
    process.exit(1);
  }

  const spinner = ora('verifying...').start();

  
  const licenseContent = fs.readFileSync(licenseFile, 'utf8');
  const licenseHash    = native.hashSHA256(licenseContent);

  let manifestData;
  try {
    const raw       = fs.readJsonSync(manifestPath);
    const decrypted = decrypt(raw.data, licenseHash);
    if (!decrypted) throw new Error('manifest decryption failed');
    manifestData = JSON.parse(decrypted);
  } catch (err) {
    spinner.fail('manifest could not be decrypted');
    console.error(chalk.red(err.message));
    await triggerTamperResponse(absPath, 'manifest tampered or wrong license file');
    process.exit(1);
  }

  
  if (manifestData.licenseHash !== licenseHash) {
    spinner.fail('license file mismatch');
    await triggerTamperResponse(absPath, 'license file does not match build');
    process.exit(1);
  }

  spinner.text = 'checking file hashes';

  const currentManifest = buildManifest(absPath);
  const savedFiles      = manifestData.files || {};
  const IGNORED         = new Set(['.koala_manifest.json', '.koala_restore.enc']);
  const tampered        = [];

  for (const [rel, expectedHash] of Object.entries(savedFiles)) {
    if (IGNORED.has(rel)) continue;
    const full = path.join(absPath, rel);
    if (!fs.existsSync(full)) {
      tampered.push(rel + ' [missing]');
      continue;
    }
    if (native.hashFile(full) !== expectedHash) {
      tampered.push(rel + ' [modified]');
    }
  }

  for (const rel of Object.keys(currentManifest)) {
    if (IGNORED.has(rel)) continue;
    if (!(rel in savedFiles)) {
      tampered.push(rel + ' [injected]');
    }
  }

  if (tampered.length > 0) {
    spinner.fail('tampering detected');
    console.log('');
    tampered.forEach(t => console.error(chalk.red('  ' + t)));
    await triggerTamperResponse(absPath, `tampered: ${tampered.join(', ')}`);
    process.exit(1);
  }

  spinner.succeed('all checks passed');
  console.log('');

  
  const header = readLicenseHeader(licenseContent);
  console.log(chalk.bold.green('package is intact'));
  console.log('');
  console.log(chalk.dim(`  owner:      ${manifestData.owner || header.owner || 'unknown'}`));
  console.log(chalk.dim(`  project:    ${manifestData.projectName || header.project || 'unknown'}`));
  console.log(chalk.dim(`  issued:     ${header.issued || 'unknown'}`));
  console.log(chalk.dim(`  build time: ${manifestData.buildTime}`));
  console.log('');
}

async function triggerTamperResponse(dirPath, reason) {
  console.log('');
  console.error(chalk.red.bold('TAMPERING DETECTED -- self-deletion triggered'));
  console.error(chalk.red(`reason: ${reason}`));
  console.error(chalk.red(`removing: ${dirPath}`));

  
  
  
  const manifestCheck = path.join(dirPath, '.koala_manifest.json');
  if (!fs.existsSync(manifestCheck)) {
    console.error(chalk.red('self-deletion refused: target does not contain a koala manifest'));
    return;
  }

  try {
    const logPath = path.join(dirPath, 'koala.audit.log');
    const sanitizedReason = reason.replace(/[\r\n]/g, ' ');
    fs.appendFileSync(logPath,
      `[${new Date().toISOString()}] TAMPER_DETECTED reason="${sanitizedReason}"\n`
    );
  } catch (_) {}
  const ok = native.selfDelete(dirPath);
  console.error(chalk.red(ok ? 'deleted.' : 'deletion failed -- remove manually.'));
}

module.exports = verifyCommand;
