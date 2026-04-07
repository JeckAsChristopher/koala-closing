

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
  const current  = buildManifest(dir);
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

function buildAntitamperSnippet(fileRelPath, _unused, manifestRelPath) {
  const crypto = require('crypto');
  const rb     = crypto.randomBytes(20);
  const vn     = (i) => '_' + rb.slice(i, i + 3).toString('hex');

  const vC  = vn(0);   
  const vF  = vn(1);   
  const vP  = vn(2);   
  const vMp = vn(3);   
  const vLf = vn(4);   
  const vLh = vn(5);   
  const vMr = vn(6);   
  const vMd = vn(7);   
  const vEh = vn(8);   
  const vAh = vn(9);   
  const vFr = vn(10);  
  const vMe = vn(11);  

  
  const fileKey = JSON.stringify(fileRelPath);

  return (
    `(function(){` +
    `try{` +
    `var ${vC}=require('crypto');` +
    `var ${vF}=require('fs');` +
    `var ${vP}=require('path');` +

    
    `var ${vFr}=${vF}.readdirSync(${vP}.join(__dirname,'..')).filter(function(n){return n.endsWith('.license');});` +
    `if(!${vFr}.length){process.exit(3);}` +
    `var ${vLf}=${vP}.join(__dirname,'..',${vFr}[0]);` +
    `if(!${vF}.existsSync(${vLf})){process.exit(3);}` +
    `var ${vLh}=${vC}.createHash('sha256').update(${vF}.readFileSync(${vLf})).digest('hex');` +

    
    `var ${vMp}=${vP}.join(__dirname,'..','${manifestRelPath.replace(/^\.\.\//, '')}');` +
    `if(!${vF}.existsSync(${vMp})){process.exit(3);}` +
    `var ${vMe}=JSON.parse(${vF}.readFileSync(${vMp},'utf8'));` +
    `if(!${vMe}||${vMe}.v!==2||!${vMe}.data){process.exit(3);}` +

    
    `var ${vMr}=(function(h,k){` +
      `try{var p=h.split(':');if(p.length!==4)return null;` +
      `var _ek=${vC}.scryptSync(k,Buffer.from(p[0],'hex'),32,{N:16384,r:8,p:1});` +
      `var _dc=${vC}.createDecipheriv('aes-256-gcm',_ek,Buffer.from(p[1],'hex'));` +
      `_dc.setAuthTag(Buffer.from(p[2],'hex'));` +
      `return Buffer.concat([_dc.update(Buffer.from(p[3],'hex')),_dc.final()]).toString('utf8');` +
      `}catch(_){return null;}` +
    `})(${vMe}.data,${vLh});` +
    `if(!${vMr}){process.exit(3);}` +

    `var ${vMd}=JSON.parse(${vMr});` +
    `if(!${vMd}||!${vMd}.files){process.exit(3);}` +

    
    `var ${vEh}=${vMd}.files[${fileKey}];` +
    `if(!${vEh}){process.exit(3);}` +
    `var ${vAh}=${vC}.createHash('sha256').update(${vF}.readFileSync(__filename)).digest('hex');` +
    `if(${vAh}!==${vEh}){process.exit(3);}` +

    `}catch(_e){process.exit(3);}` +
    `})();`
  );
}

module.exports = { hashString, hashFile, buildManifest, verifyManifest, buildAntitamperSnippet };
