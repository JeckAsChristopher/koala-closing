'use strict';

const fs     = require('fs-extra');
const path   = require('path');
const native = require('./native-bridge');


function hashString(str) {
  return native.hashSHA256(str);
}


function hashFile(filePath) {
  return native.hashFile(filePath);
}


function buildManifest(dir) {
  const manifest = {};
  const walk = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const rel = path.relative(dir, full);
        manifest[rel] = hashFile(full);
      }
    }
  };
  walk(dir);
  return manifest;
}


function verifyManifest(dir, savedManifest) {
  const current = buildManifest(dir);
  const tampered = [];

  for (const [rel, expectedHash] of Object.entries(savedManifest)) {
    const full = path.join(dir, rel);
    if (!fs.existsSync(full)) {
      tampered.push(rel + ' (MISSING)');
    } else if (current[rel] !== expectedHash) {
      tampered.push(rel + ' (MODIFIED)');
    }
  }

  
  for (const rel of Object.keys(current)) {
    if (!(rel in savedManifest)) {
      tampered.push(rel + ' (INJECTED)');
    }
  }

  return { valid: tampered.length === 0, tampered };
}


function buildAntitamperSnippet(fileRelPath, expectedHash, manifestPath) {
  
  return `(function(){var _p=require('path'),_f=require('fs'),_c=require('crypto');var _mf=_p.join(__dirname,${JSON.stringify(manifestPath)});function _h(s){return _c.createHash('sha256').update(s).digest('hex');}try{if(!_f.existsSync(_mf)){process.exit(3);}var _mn=JSON.parse(_f.readFileSync(_mf,'utf8'));if(!_mn||!_mn.v){process.exit(3);}}catch(e){process.exit(3);}})();`;
}

module.exports = { hashString, hashFile, buildManifest, verifyManifest, buildAntitamperSnippet };
