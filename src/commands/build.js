'use strict';

const fs       = require('fs-extra');
const path     = require('path');
const inquirer = require('inquirer');
const chalk    = require('chalk');
const ora      = require('ora');

const { protectFile, randomFolderName, randomFileName } = require('../core/obfuscator');
const { buildManifest, buildAntitamperSnippet }         = require('../core/integrity');
const { buildJunkFile }                                  = require('../core/junk-injector');
const { findLicenseFile, verifyLicense }                 = require('../core/license');
const { encrypt }                                        = require('../core/encryption');
const native                                             = require('../core/native-bridge');

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
    
    
    const logName = path.basename(config.logFile || 'koala.audit.log');
    const logPath = path.join(projectPath, logName);
    
    const sanitized = message.replace(/[\r\n]/g, ' ');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${sanitized}\n`);
  } catch (_) {}
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

    const source    = fs.readFileSync(fullPath, 'utf8');
    const obfName   = randomFileName('.js');
    const folder    = folderNames[i % numFolders];
    const outFile   = path.join(outputDir, folder, obfName);

    let protected_src;
    try {
      protected_src = protectFile(source, password, config.obfuscationLevel || 'high');
    } catch (_) {
      const { stripComments, collapseToOneLine } = require('../core/obfuscator');
      protected_src = collapseToOneLine(stripComments(source));
    }

    const antitamper = buildAntitamperSnippet(
      path.join(folder, obfName), '', '../.koala_manifest.json'
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

  
  spinner.text = 'generating proxy index.js';
  const mainEntry  = fileMap['index.js'] || Object.values(fileMap)[0];
  const entryPoint = mainEntry ? `./${mainEntry.folder}/${mainEntry.obfName}` : null;
  if (entryPoint) {
    const proxyIndex = `'use strict';module.exports=require(${JSON.stringify(entryPoint)});`;
    fs.writeFileSync(path.join(outputDir, 'index.js'), proxyIndex, 'utf8');
  }

  spinner.text = 'building manifest';
  const manifest = buildManifest(outputDir);

  
  const licenseContent = fs.readFileSync(licenseFile, 'utf8');
  const licenseHash    = native.hashSHA256(licenseContent);

  const manifestData = {
    buildTime:   new Date().toISOString(),
    projectName: pkg.name || path.basename(absPath),
    owner:       licResult.owner,
    licenseHash,
    files:       manifest,
    fileMap
  };

  const encManifest = encrypt(JSON.stringify(manifestData), licenseHash);
  fs.writeFileSync(
    path.join(outputDir, '.koala_manifest.json'),
    JSON.stringify({ v: 2, data: encManifest }, null, 2)
  );

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
  console.log(chalk.dim(`${sourceFiles.length} file(s) | ${numFolders} folder(s) | proxy index.js included in manifest`));

  appendAuditLog(absPath, config,
    `build output="${outputDir}" files=${sourceFiles.length} owner="${licResult.owner}"`
  );
}

module.exports = buildCommand;
