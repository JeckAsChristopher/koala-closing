

'use strict';

const path   = require('path');
const assert = (cond, msg) => { if (!cond) throw new Error('[fail] FAIL: ' + msg); };

function pass(msg) { console.log('  [ok] ' + msg); }

console.log('\n[1/5] native-bridge');
const nb = require('../src/core/native-bridge');

const hash1 = nb.hashSHA256('hello');
assert(hash1 === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', 'SHA-256 of "hello"');
pass('hashSHA256 correct');

const rn = nb.generateRandomName(10);
assert(typeof rn === 'string' && rn.length === 10, 'generateRandomName(10) length');
assert(/^[a-z0-9]+$/.test(rn), 'generateRandomName chars');
pass('generateRandomName correct');

const obs = nb.obfuscateString('ABC');
assert(obs === '[65,66,67]', 'obfuscateString("ABC")');
pass('obfuscateString correct');

console.log('\n[2/5] encryption');
const { encrypt, decrypt, wrapInDecryptionEnvelope } = require('../src/core/encryption');

const plaintext = 'Hello, Koala!  Secret payload.';
const password  = 'StrongPass123!';
const ct        = encrypt(plaintext, password);
assert(typeof ct === 'string' && ct.length > 0, 'encrypt returns string');
pass('encrypt produces output');

const decrypted = decrypt(ct, password);
assert(decrypted === plaintext, 'decrypt round-trip');
pass('decrypt round-trip correct');

const badDecrypt = decrypt(ct, 'wrongpassword!');
assert(badDecrypt === undefined, 'decrypt with wrong key returns undefined');
pass('decrypt with wrong key returns undefined');

const envelope = wrapInDecryptionEnvelope('console.log("hi")', password);
assert(typeof envelope === 'string' && envelope.includes('aes-256-gcm'), 'envelope contains AES');
pass('wrapInDecryptionEnvelope produces valid envelope');

console.log('\n[3/5] integrity');
const { hashString, buildManifest, verifyManifest } = require('../src/core/integrity');

const hs = hashString('koala');
assert(typeof hs === 'string' && hs.length === 64, 'hashString returns 64-char hex');
pass('hashString correct');

const fs   = require('fs-extra');
const os   = require('os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-test-'));
fs.writeFileSync(path.join(tmpDir, 'a.js'), 'var x=1;');
fs.writeFileSync(path.join(tmpDir, 'b.js'), 'var y=2;');

const manifest = buildManifest(tmpDir);
assert('a.js' in manifest && 'b.js' in manifest, 'buildManifest lists files');
pass('buildManifest correct');

const vr = verifyManifest(tmpDir, manifest);
assert(vr.valid === true && vr.tampered.length === 0, 'verifyManifest on untouched dir');
pass('verifyManifest on clean dir returns valid');

fs.writeFileSync(path.join(tmpDir, 'a.js'), 'var x=999;');
const vr2 = verifyManifest(tmpDir, manifest);
assert(vr2.valid === false, 'verifyManifest detects modification');
assert(vr2.tampered.some(t => t.includes('a.js')), 'tampered list includes a.js');
pass('verifyManifest detects tampered file');

fs.removeSync(tmpDir);

console.log('\n[4/5] license');
const { generateLicense, readLicense, verifyLicense } = require('../src/core/license');

const licTmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-lic-'));
const licPwd     = 'SecureLicense99!';
const licPath    = generateLicense({
  projectPath: licTmpDir,
  projectName: 'test-project',
  ownerName:   'Acme Corp',
  password:    licPwd
});

assert(fs.existsSync(licPath), 'license file created');
pass('generateLicense creates file');

const payload = readLicense(licPath, licPwd);
assert(payload !== null, 'readLicense decrypts');
assert(payload.ownerName === 'Acme Corp', 'ownerName preserved');
assert(payload.projectName === 'test-project', 'projectName preserved');
pass('readLicense round-trip correct');

const badRead = readLicense(licPath, 'wrongpassword!');
assert(badRead === null, 'readLicense with wrong password returns null');
pass('readLicense rejects wrong password');

const vl = verifyLicense(licTmpDir, licPwd);
assert(vl.valid === true, 'verifyLicense valid');
assert(vl.owner === 'Acme Corp', 'owner correct');
pass('verifyLicense correct');

const vl2 = verifyLicense(licTmpDir, 'wrongpassword!');
assert(vl2.valid === false, 'verifyLicense invalid with wrong password');
pass('verifyLicense rejects wrong password');

fs.removeSync(licTmpDir);

console.log('\n[5/5] junk-injector + obfuscator utils');
const { generateJunkBlock, injectDecoyVars, buildJunkFile } = require('../src/core/junk-injector');
const { stripComments, collapseToOneLine } = require('../src/core/obfuscator');

const junk = generateJunkBlock(4);
assert(typeof junk === 'string' && junk.includes('function'), 'generateJunkBlock produces functions');
assert(!junk.includes('/*') && !junk.includes('//'), 'generateJunkBlock has no comments');
pass('generateJunkBlock correct and comment-free');

const withDecoys = injectDecoyVars('var x = 1;');
assert(withDecoys.includes('var x = 1;'), 'injectDecoyVars preserves source');
assert(!withDecoys.includes('/*'), 'injectDecoyVars has no comments');
pass('injectDecoyVars correct');

const junkFile = buildJunkFile();
assert(typeof junkFile === 'string' && junkFile.length > 50, 'buildJunkFile produces content');
assert(!junkFile.includes('/*') && !junkFile.includes('//'), 'buildJunkFile has no comments');
pass('buildJunkFile comment-free');

const stripped = stripComments('var x=1; /* block */ var y=2; // line\nvar z=3;');
assert(!stripped.includes('/*') && !stripped.includes('//'), 'stripComments removes all comments');
assert(stripped.includes('var x=1;') && stripped.includes('var z=3;'), 'stripComments preserves code');
pass('stripComments correct');

const oneline = collapseToOneLine('var a = 1;\nvar b = 2;\n  var c   =   3;');
assert(!oneline.includes('\n'), 'collapseToOneLine removes newlines');
pass('collapseToOneLine correct');

console.log('\n' + '─'.repeat(50));
console.log('[ok]  All tests passed.\n');
