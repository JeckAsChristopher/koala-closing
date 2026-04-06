'use strict';

const JavaScriptObfuscator = require('javascript-obfuscator');
const { wrapInDecryptionEnvelope } = require('./encryption');
const { injectDecoyVars }          = require('./junk-injector');
const native                        = require('./native-bridge');



function stripComments(src) {
  let out = '';
  let i = 0;
  const len = src.length;
  while (i < len) {
    
    if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
      const q = src[i];
      out += src[i++];
      while (i < len) {
        if (src[i] === '\\') { out += src[i] + src[i+1]; i += 2; continue; }
        out += src[i];
        if (src[i++] === q) break;
      }
      continue;
    }
    
    if (src[i] === '/' && i > 0 && /[=(,\[!&|?:~^]/.test(src[i-1].trim() || '(')) {
      if (src[i+1] !== '/' && src[i+1] !== '*') {
        out += src[i++];
        while (i < len && src[i] !== '\n') {
          if (src[i] === '\\') { out += src[i] + src[i+1]; i += 2; continue; }
          out += src[i];
          if (src[i++] === '/') break;
        }
        continue;
      }
    }
    
    if (src[i] === '/' && src[i+1] === '/') {
      while (i < len && src[i] !== '\n') i++;
      continue;
    }
    
    if (src[i] === '/' && src[i+1] === '*') {
      i += 2;
      while (i < len && !(src[i] === '*' && src[i+1] === '/')) i++;
      i += 2;
      continue;
    }
    out += src[i++];
  }
  return out;
}


function collapseToOneLine(src) {
  return src
    .replace(/\r\n|\r|\n/g, ' ')   
    .replace(/\s{2,}/g, ' ')        
    .replace(/\s*([{};,=+\-*/%&|^~<>!?:()\[\]])\s*/g, '$1') 
    .trim();
}


const OBFUSCATION_PRESETS = {
  high: {
    
    target:                           'node',
    compact:                          true,
    
    controlFlowFlattening:            true,
    controlFlowFlatteningThreshold:   0.9,   
    
    deadCodeInjection:                true,
    deadCodeInjectionThreshold:       0.5,   
    
    debugProtection:                  false,  
    debugProtectionInterval:          0,
    disableConsoleOutput:             false, 
    selfDefending:                    true,
    
    identifierNamesGenerator:         'hexadecimal',
    identifiersDictionary:            [],
    renameGlobals:                    false, 
    reservedNames:                    ['^require$', '^module$', '^exports$', '^__dirname$', '^__filename$'],
    
    numbersToExpressions:             true,
    
    simplify:                         true,
    
    splitStrings:                     true,
    splitStringsChunkLength:          3,     
    
    stringArray:                      true,
    stringArrayCallsTransform:        true,
    stringArrayCallsTransformThreshold: 1,  
    stringArrayEncoding:              ['base64', 'rc4'],
    stringArrayIndexShift:            true,
    stringArrayRotate:                true,
    stringArrayShuffle:               true,
    stringArrayWrappersCount:         5,    
    stringArrayWrappersChainedCalls:  true,
    stringArrayWrappersParametersMaxCount: 8, 
    stringArrayWrappersType:          'function',
    stringArrayThreshold:             1,    
    
    transformObjectKeys:              true,
    
    unicodeEscapeSequence:            true, 
    log:                              false
  },
  medium: {
    target:                           'node',
    compact:                          true,
    controlFlowFlattening:            true,
    controlFlowFlatteningThreshold:   0.5,
    deadCodeInjection:                true,
    deadCodeInjectionThreshold:       0.25,
    debugProtection:                  false,
    disableConsoleOutput:             false, 
    selfDefending:                    true,
    identifierNamesGenerator:         'hexadecimal',
    reservedNames:                    ['^require$', '^module$', '^exports$', '^__dirname$', '^__filename$'],
    renameGlobals:                    false,
    numbersToExpressions:             true,
    simplify:                         true,
    splitStrings:                     true,
    splitStringsChunkLength:          6,
    stringArray:                      true,
    stringArrayCallsTransform:        true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding:              ['base64'],
    stringArrayIndexShift:            true,
    stringArrayRotate:                true,
    stringArrayShuffle:               true,
    stringArrayWrappersCount:         3,    
    stringArrayWrappersChainedCalls:  true,
    stringArrayWrappersParametersMaxCount: 5,
    stringArrayWrappersType:          'function',
    stringArrayThreshold:             0.75,
    transformObjectKeys:              true,
    unicodeEscapeSequence:            false, 
    log:                              false
  }
};


const SECOND_PASS_OPTS = {
  target:                         'node',
  compact:                        true,
  controlFlowFlattening:          false,
  deadCodeInjection:              false,
  debugProtection:                false,
  disableConsoleOutput:           false,
  selfDefending:                  false,
  identifierNamesGenerator:       'mangled', 
  renameGlobals:                  false,
  reservedNames:                  ['^require$', '^module$', '^exports$', '^__dirname$', '^__filename$'],
  numbersToExpressions:           true,
  simplify:                       true,
  splitStrings:                   true,
  splitStringsChunkLength:        4,
  stringArray:                    true,
  stringArrayCallsTransform:      true,
  stringArrayCallsTransformThreshold: 0.85,
  stringArrayEncoding:            ['base64'],
  stringArrayRotate:              true,
  stringArrayShuffle:             true,
  stringArrayWrappersCount:       2,
  stringArrayWrappersChainedCalls:true,
  stringArrayThreshold:           0.6,
  transformObjectKeys:            true,
  unicodeEscapeSequence:          false, 
  log:                            false
};

function obfuscateSource(source, level = 'high', seed = null) {
  const opts = { ...OBFUSCATION_PRESETS[level] || OBFUSCATION_PRESETS.high };
  if (seed) opts.seed = parseInt(seed, 16) % 2147483647;
  const clean = collapseToOneLine(stripComments(source));

  let pass1;
  try {
    pass1 = JavaScriptObfuscator.obfuscate(clean, opts).getObfuscatedCode();
  } catch (_) {
    pass1 = clean; 
  }

  
  if (level === 'high') {
    try {
      return JavaScriptObfuscator.obfuscate(pass1, SECOND_PASS_OPTS).getObfuscatedCode();
    } catch (_) {
      return pass1; 
    }
  }
  return pass1;
}


function protectFile(source, password, level = 'high') {
  const stripped    = stripComments(source);
  const withDecoys  = injectDecoyVars(stripped);
  const obfuscated  = obfuscateSource(withDecoys, level);
  
  return wrapInDecryptionEnvelope(obfuscated, password);
}

function randomFileName(ext = '.js') {
  return native.generateRandomName(8) + ext;
}

function randomFolderName() {
  return native.generateRandomName(8);
}

module.exports = { obfuscateSource, protectFile, stripComments, collapseToOneLine, randomFileName, randomFolderName };

