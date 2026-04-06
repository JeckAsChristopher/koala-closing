'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');


let native = null;
try {
  native = require('../../build/Release/koala_native.node');
} catch (_) {
  try {
    native = require('../../build/Debug/koala_native.node');
  } catch (__) {
    
  }
}



function _hashSHA256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function _hashFile(filePath) {
  
  if (!fs.existsSync(filePath)) throw new Error(`hashFile: file not found: ${filePath}`);
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}



function _deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}




function _encryptData(data, password) {
  const salt      = crypto.randomBytes(16);
  const iv        = crypto.randomBytes(12);          
  const key       = _deriveKey(password, salt);
  const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();             
  return [salt, iv, authTag, encrypted].map(b => b.toString('hex')).join(':');
}

function _decryptData(hexData, password) {
  try {
    const parts = hexData.split(':');
    if (parts.length !== 4) return undefined;
    const [saltHex, ivHex, tagHex, encHex] = parts;
    const key      = _deriveKey(password, Buffer.from(saltHex, 'hex'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex')); 
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final()
    ]).toString('utf8');
    return decrypted;
  } catch (_) {
    return undefined;
  }
}

function _generateRandomName(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let name = '';
  const buf = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) name += chars[buf[i] % chars.length];
  return name;
}

function _verifyFileIntegrity(filePath, expectedHash) {
  if (!fs.existsSync(filePath)) return false;
  return _hashFile(filePath) === expectedHash;
}

function _selfDelete(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  } catch (_) {
    return false;
  }
}

function _detectDebugger() {
  const start = process.hrtime.bigint();
  let sum = 0n;
  for (let i = 0; i < 100000; i++) sum += BigInt(i);
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
  return elapsed > 200;
}

function _obfuscateString(s) {
  const bytes = Buffer.from(s, 'utf8');
  return '[' + Array.from(bytes).join(',') + ']';
}



module.exports = {
  usingNative: !!native,

  hashSHA256(data) {
    return native ? native.hashSHA256(data) : _hashSHA256(data);
  },
  hashFile(filePath) {
    return native ? native.hashFile(filePath) : _hashFile(filePath);
  },
  encryptData(data, key) {
    return native ? native.encryptData(data, key) : _encryptData(data, key);
  },
  decryptData(hexData, key) {
    return native ? native.decryptData(hexData, key) : _decryptData(hexData, key);
  },
  generateRandomName(length = 8) {
    return native ? native.generateRandomName(length) : _generateRandomName(length);
  },
  verifyFileIntegrity(filePath, expectedHash) {
    return native ? native.verifyFileIntegrity(filePath, expectedHash) : _verifyFileIntegrity(filePath, expectedHash);
  },
  selfDelete(dirPath) {
    return native ? native.selfDelete(dirPath) : _selfDelete(dirPath);
  },
  detectDebugger() {
    return native ? native.detectDebugger() : _detectDebugger();
  },
  obfuscateString(s) {
    return native ? native.obfuscateString(s) : _obfuscateString(s);
  }
};
