'use strict';

const fs       = require('fs-extra');
const path     = require('path');
const inquirer = require('inquirer');
const chalk    = require('chalk');
const ora      = require('ora');

const { protectFile, obfuscateSource, randomFolderName, randomFileName } = require('../core/obfuscator');
const { buildManifest, buildAntitamperSnippet }  = require('../core/integrity');
const { buildJunkFile }                           = require('../core/junk-injector');
const { findLicenseFile, verifyLicense }          = require('../core/license');
const { encrypt }                                 = require('../core/encryption');
const native                                      = require('../core/native-bridge');

function loadConfig(projectPath) {
  const cfgPath  = path.join(projectPath, 'koala.config.json');
  const defaults = {
    obfuscationLevel: 'high',
    includeTests:     false,
    injectJunkFiles:  true,
    junkFileCount:    3,
    outputSuffix:     '_obfuscated',
    chunkFolders:     3,
    restoreEnabled:   false,
    logFile:          'koala.audit.log',
    excludePatterns:  ['node_modules', '.git', '*.test.js', '*.spec.js', '*.license']
  };
  if (fs.existsSync(cfgPath)) return { ...defaults, ...fs.readJsonSync(cfgPath) };
  return defaults;
}

function collectJsFiles(projectPath, config) {
  const files   = [];
  const exclude = new Set(config.excludePatterns || []);
  const isExcluded = (rel) => {
    for (const p of exclude) {
      if (p.startsWith('*')) { if (rel.endsWith(p.slice(1))) return true; }
      else { if (rel.includes(p)) return true; }
    }
    return false;
  };
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryRel = rel ? rel + '/' + entry.name : entry.name;
      if (isExcluded(entryRel)) continue;
      if (!config.includeTests && entryRel.startsWith('tests')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, entryRel);
      else if (entry.name.endsWith('.js')) files.push({ fullPath: full, relPath: entryRel });
    }
  };
  walk(projectPath);
  return files;
}

function buildOutputPackageJson(originalPkg, entryMap) {
  const out = {
    name:        (originalPkg.name || 'protected') + '-protected',
    version:     originalPkg.version || '1.0.0',
    description: (originalPkg.description || '') + ' [protected]',
    main:        entryMap.main || 'index.js',
    license:     'PROPRIETARY',
    _koala:      { protected: true, buildTime: new Date().toISOString() }
  };
  if (originalPkg.dependencies) out.dependencies = originalPkg.dependencies;
  if (originalPkg.engines)      out.engines      = originalPkg.engines;
  return out;
}

function appendAuditLog(projectPath, config, message) {
  try {
    const logName   = path.basename(config.logFile || 'koala.audit.log');
    const logPath   = path.join(projectPath, logName);
    const sanitized = message.replace(/[\r\n]/g, ' ');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${sanitized}\n`);
  } catch (_) {}
}

function buildObfuscatedProxy(entryPoint, password, level) {
  
  
  const proxySource = `
'use strict';
(function(){
  var _fs   = require('fs');
  var _path = require('path');
  var _cryp = require('crypto');

  var _root = __dirname;
  var _files;
  try { _files = _fs.readdirSync(_root); } catch(_){ return; }
  var _lf = null;
  for (var _i = 0; _i < _files.length; _i++) {
    if (_files[_i].slice(-8) === '.license') { _lf = _path.join(_root, _files[_i]); break; }
  }
  if (!_lf) return;

  var _lc;
  try { _lc = _fs.readFileSync(_lf); } catch(_){ return; }
  if (!_lc || !_lc.length) return;
  var _lh = _cryp.createHash('sha256').update(_lc).digest('hex');

  var _mp = _path.join(_root, '.koala_manifest.json');
  var _me;
  try { _me = JSON.parse(_fs.readFileSync(_mp, 'utf8')); } catch(_){ return; }
  if (!_me || _me.v !== 2 || !_me.data) return;

  var _md = (function(blob, key) {
    try {
      var p = blob.split(':');
      if (p.length !== 4) return null;
      var _ek = _cryp.scryptSync(key, Buffer.from(p[0],'hex'), 32, {N:16384,r:8,p:1});
      var _dc = _cryp.createDecipheriv('aes-256-gcm', _ek, Buffer.from(p[1],'hex'));
      _dc.setAuthTag(Buffer.from(p[2],'hex'));
      var out = Buffer.concat([_dc.update(Buffer.from(p[3],'hex')), _dc.final()]).toString('utf8');
      return JSON.parse(out);
    } catch(_) { return null; }
  })(_me.data, _lh);

  if (!_md || !_md.files) return;

  if (_md.licenseHash !== _lh) return;

  var _ep = require(${JSON.stringify(entryPoint)});
  if (typeof _ep !== 'undefined') module.exports = _ep;
})();
`.trim();

  
  return protectFile(proxySource, password, level);
}

async function buildCommand(projectPath) {
  const absPath = path.resolve(projectPath);
  if (!fs.existsSync(absPath)) {
    console.error(chalk.red(`directory not found: ${absPath}`));
    process.exit(1);
  }

  const config      = loadConfig(absPath);
  const licenseFile = findLicenseFile(absPath);
  if (!licenseFile) {
    console.error(chalk.red('no .license file found. run generate-license first.'));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold.cyan('koala-closing build'));

  const { password } = await inquirer.prompt([{
    type:     'password',
    name:     'password',
    message:  'license password:',
    mask:     '*',
    validate: (v) => v.length >= 10 || 'password must be at least 10 characters'
  }]);

  const licResult = verifyLicense(absPath, password);
  if (!licResult.valid) {
    console.error(chalk.red('license verification failed: ' + licResult.error));
    process.exit(1);
  }
  console.log(chalk.green(`license ok -- ${licResult.owner} / ${licResult.projectName}`));

  const pkg       = fs.readJsonSync(path.join(absPath, 'package.json'));
  const outputDir = path.resolve(absPath + config.outputSuffix);
  fs.removeSync(outputDir);
  fs.mkdirpSync(outputDir);

  const numFolders  = Math.max(1, config.chunkFolders || 3);
  const folderNames = Array.from({ length: numFolders }, () => randomFolderName());
  folderNames.forEach(f => fs.mkdirpSync(path.join(outputDir, f)));

  console.log(chalk.dim(`output:  ${outputDir}`));
  console.log('');

  const sourceFiles = collectJsFiles(absPath, config);
  console.log(chalk.dim(`${sourceFiles.length} file(s) to protect`));

  const spinner = ora('processing...').start();
  const fileMap = {};

  for (let i = 0; i < sourceFiles.length; i++) {
    const { fullPath, relPath } = sourceFiles[i];
    spinner.text = `obfuscating ${relPath}`;

    const source  = fs.readFileSync(fullPath, 'utf8');
    const obfName = randomFileName('.js');
    const folder  = folderNames[i % numFolders];
    const outFile = path.join(outputDir, folder, obfName);

    let protected_src;
    try {
      protected_src = protectFile(source, password, config.obfuscationLevel || 'high');
    } catch (_) {
      const { stripComments, collapseToOneLine } = require('../core/obfuscator');
      protected_src = collapseToOneLine(stripComments(source));
    }

    
    const outRelPath = folder + '/' + obfName;
    const antitamper = buildAntitamperSnippet(
      outRelPath, '', '../.koala_manifest.json'
    );
    fs.writeFileSync(outFile, antitamper + '\n' + protected_src, 'utf8');
    fileMap[relPath] = { folder, obfName, originalHash: native.hashFile(fullPath) };
  }

  if (config.injectJunkFiles) {
    spinner.text = 'injecting junk files';
    const junkCount = config.junkFileCount || 3;
    for (let f = 0; f < numFolders; f++) {
      for (let j = 0; j < junkCount; j++) {
        fs.writeFileSync(
          path.join(outputDir, folderNames[f], randomFileName('.js')),
          buildJunkFile()
        );
      }
    }
  }

  spinner.text = 'copying license';
  fs.copyFileSync(licenseFile, path.join(outputDir, path.basename(licenseFile)));

  
  spinner.text = 'building manifest';
  const sourceManifest  = buildManifest(outputDir);
  const licenseContent  = fs.readFileSync(licenseFile, 'utf8');
  const licenseHash     = native.hashSHA256(licenseContent);

  const manifestData = {
    buildTime:   new Date().toISOString(),
    projectName: pkg.name || path.basename(absPath),
    owner:       licResult.owner,
    licenseHash,
    files:       sourceManifest,
    fileMap
  };

  const encManifest = encrypt(JSON.stringify(manifestData), licenseHash);
  fs.writeFileSync(
    path.join(outputDir, '.koala_manifest.json'),
    JSON.stringify({ v: 2, data: encManifest }, null, 2)
  );

  
  spinner.text = 'generating obfuscated proxy index.js';
  const mainEntry  = fileMap['index.js'] || Object.values(fileMap)[0];
  if (mainEntry) {
    const entryPoint = `./${mainEntry.folder}/${mainEntry.obfName}`;
    const obfLevel   = config.obfuscationLevel || 'high';
    let   proxyCode;

    try {
      proxyCode = buildObfuscatedProxy(entryPoint, password, obfLevel);
    } catch (_) {
      
      proxyCode = `(function(){var _f=require('fs'),_p=require('path');var _lf=_f.readdirSync(__dirname).find(function(n){return n.slice(-8)==='.license';});if(!_lf)return;module.exports=require(${JSON.stringify(entryPoint)});})();`;
    }

    fs.writeFileSync(path.join(outputDir, 'index.js'), proxyCode, 'utf8');
  }

  if (config.restoreEnabled) {
    console.log(chalk.yellow.bold(
      '[security]  restoreEnabled is ON — encrypted original source will be embedded in the ' +
      'output package. Anyone who obtains the license password can recover the plain-text source. ' +
      'Only enable this for internal debug builds that are never distributed.'
    ));
    spinner.text = 'writing restore map';
    const restoreMap = {};
    for (const { fullPath, relPath } of sourceFiles) {
      restoreMap[relPath] = encrypt(fs.readFileSync(fullPath, 'utf8'), password);
    }
    fs.writeFileSync(
      path.join(outputDir, '.koala_restore.enc'),
      encrypt(JSON.stringify(restoreMap), password)
    );
  }

  spinner.text = 'generating package.json';
  fs.writeJsonSync(
    path.join(outputDir, 'package.json'),
    buildOutputPackageJson(pkg, { main: 'index.js' }),
    { spaces: 2 }
  );

  spinner.succeed('build complete');
  console.log('');
  console.log(chalk.green('protected project:'), chalk.bold(outputDir));
  console.log(chalk.dim(`${sourceFiles.length} file(s) | ${numFolders} folder(s) | obfuscated+license-guarded index.js`));

  appendAuditLog(absPath, config,
    `build output="${outputDir}" files=${sourceFiles.length} owner="${licResult.owner}"`
  );
}

module.exports = buildCommand;
