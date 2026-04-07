'use strict';

const fs     = require('fs-extra');
const path   = require('path');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./encryption');
const native               = require('./native-bridge');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return salt.toString('hex') + '$' + hash.toString('hex');
}

function verifyPassword(password, stored) {
  const sep = stored.indexOf('$');
  if (sep === -1) return false; 
  const salt    = Buffer.from(stored.slice(0, sep), 'hex');
  const expected = Buffer.from(stored.slice(sep + 1), 'hex');
  const derived  = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(derived, expected);
}

const LICENSE_VERSION = '1';

function generateLicense({ projectPath, projectName, ownerName, password }) {
  if (password.length < 10) throw new Error('password must be at least 10 characters');

  const issuedAt  = new Date().toISOString();
  const licenseId = native.generateRandomName(16);
  const payload   = JSON.stringify({
    version:      LICENSE_VERSION,
    licenseId,
    projectName,
    ownerName,
    issuedAt,
    passwordHash: hashPassword(password)   
  });

  const encrypted      = encrypt(payload, password);
  const licenseContent = [
    '# Koala-Closing License File',
    `# Project: ${projectName}`,
    `# Owner:   ${ownerName}`,
    `# Issued:  ${issuedAt}`,
    `# ID:      ${licenseId}`,
    '# do not modify -- integrity protected',
    '',
    'KOALA_LICENSE_V1=' + encrypted
  ].join('\n');

  const licensePath = path.join(projectPath, projectName + '.license');
  fs.writeFileSync(licensePath, licenseContent, 'utf8');
  return licensePath;
}

function readLicense(licensePath, password) {
  if (!fs.existsSync(licensePath)) return null;
  const content = fs.readFileSync(licensePath, 'utf8');
  const match   = content.match(/^KOALA_LICENSE_V1=(.+)$/m);
  if (!match) return null;
  const decrypted = decrypt(match[1], password);
  if (!decrypted) return null;
  try {
    const parsed = JSON.parse(decrypted);
    if (!verifyPassword(password, parsed.passwordHash)) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function readLicenseHeader(content) {
  const get = (key) => {
    const m = content.match(new RegExp(`^# ${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return {
    project: get('Project'),
    owner:   get('Owner'),
    issued:  get('Issued'),
    id:      get('ID')
  };
}

function findLicenseFile(projectPath) {
  const files = fs.readdirSync(projectPath);
  const found = files.find(f => f.endsWith('.license'));
  return found ? path.join(projectPath, found) : null;
}

function verifyLicense(projectPath, password) {
  const lf = findLicenseFile(projectPath);
  if (!lf) return { valid: false, error: 'license file not found' };
  const payload = readLicense(lf, password);
  if (!payload) return { valid: false, error: 'license decryption failed -- wrong password or tampered file' };
  return {
    valid:       true,
    owner:       payload.ownerName,
    projectName: payload.projectName,
    issuedAt:    payload.issuedAt,
    licenseId:   payload.licenseId
  };
}

module.exports = { generateLicense, readLicense, readLicenseHeader, findLicenseFile, verifyLicense };
