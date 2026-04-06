'use strict';

const native = require('./native-bridge');
const crypto = require('crypto');


function encrypt(data, password) {
  if (typeof data !== 'string') data = JSON.stringify(data);
  return native.encryptData(data, password);
}


function decrypt(hexData, password) {
  return native.decryptData(hexData, password);
}


function wrapInDecryptionEnvelope(sourceCode, password) {
  const encrypted = encrypt(sourceCode, password);

  
  const fragA = crypto.randomBytes(16).toString('hex');

  
  
  const fingerprint = [process.version, process.arch, process.platform].join('|');
  const fragB = crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);

  
  
  const fragC = crypto.createHash('sha256').update(password).digest('hex').slice(0, 16);

  
  const rb = crypto.randomBytes(12);
  const vn = (i) => '_' + rb.slice(i, i+4).toString('hex');
  const vC = vn(0), vD = vn(1), vE = vn(2), vF = vn(3);
  const vI = vn(4), vL = vn(5), vO = vn(6), vP = vn(7);
  const vR = vn(8), vS = vn(9), vT = vn(10), vX = vn(11);
  const vA = vn(1), vB = vn(2), vK = vn(3), vM = vn(4);

  
  return (
    `(function(){` +
    
    `var ${vT}=Date.now();for(var ${vI}=0;${vI}<1e5;${vI}++);` +
    `if(Date.now()-${vT}>2000){process.exit(1);}` +
    
    `var ${vE}=global.eval;` +
    `global.eval=function(x){if(typeof x==='string'&&x.indexOf('${vR}')===-1)throw new Error('');return ${vE}.apply(this,arguments);};` +
    
    `var ${vA}='${fragA}';` +
    `var ${vB}=(function(){var p=process;return require('crypto').createHash('sha256').update([p.version,p.arch,p.platform].join('|')).digest('hex').slice(0,16);})();` +
    
    
    `var ${vM}=require('crypto').createHash('sha256').update(${vA}+${vB}).digest();` +
    `var ${vX}=Buffer.from('${crypto.createHash('sha256').update(fragA+fragB).digest().map((b, i) => b ^ Buffer.from(fragC, 'hex')[i % 8]).toString('hex')}','hex');` +
    `var ${vL}=(function(m,x){var r='';for(var i=0;i<x.length;i++){r+=String.fromCharCode(x[i]^(m[i%m.length]));}return r;})(${vM},${vX});` +
    
    
    `var ${vP}=(function(p,k){` +
      `var r='';for(var i=0;i<p.length;i++){r+=String.fromCharCode(p[i]^(k[i%k.length].charCodeAt(0)));}` +
      `return r;` +
    `})(${JSON.stringify(Buffer.from(password).map((b, i) => b ^ fragA.charCodeAt(i % fragA.length) ^ fragB.charCodeAt(i % fragB.length)))},${vA}+${vB});` +
    
    `var ${vC}=require('crypto');` +
    `var ${vD}=${JSON.stringify(encrypted)};` +
    `function ${vF}(h,k){` +
      `try{var p=h.split(':');if(p.length!==3)return null;` +
      `var dk=${vC}.createHash('sha256').update(k).digest();` +
      `var iv=Buffer.from(p[0],'hex');` +
      `var dc=${vC}.createDecipheriv('aes-256-cbc',dk,iv);` +
      `var o=Buffer.concat([dc.update(Buffer.from(p[2],'hex')),dc.final()]).toString('utf8');` +
      `var tg=${vC}.createHash('sha256').update(o).digest('hex').slice(0,8);` +
      `if(p[1]!==tg)return null;return o;}catch(e){return null;}}` +
    `var ${vS}=${vF}(${vD},${vP});` +
    `if(!${vS}){process.exit(2);}` +
    
    `var ${vP}=${vE}('"${vR}";(function(module,exports,require,__dirname,__filename){'+${vS}+'})');` +
    `global.eval=${vE};` +
    `${vP}.call(module.exports,module,module.exports,require,__dirname,__filename);` +
    `})();`
  );
}

module.exports = { encrypt, decrypt, wrapInDecryptionEnvelope };

