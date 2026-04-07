

'use strict';

const native = require('./native-bridge');

function encrypt(data, password) {
  if (typeof data !== 'string') data = JSON.stringify(data);
  return native.encryptData(data, password);
}

function decrypt(hexData, password) {
  return native.decryptData(hexData, password);
}

function wrapInDecryptionEnvelope(sourceCode, password) {
  const crypto    = require('crypto');
  const encrypted = encrypt(sourceCode, password);   

  
  const ephSalt  = crypto.randomBytes(32);
  const wrapKey  = crypto.hkdfSync('sha256', ephSalt, Buffer.alloc(0), Buffer.from('koala-env-seed'), 32);
  const pwIv     = crypto.randomBytes(12);
  const pwCipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(wrapKey), pwIv);
  const pwEnc    = Buffer.concat([pwCipher.update(password, 'utf8'), pwCipher.final()]);
  const pwTag    = pwCipher.getAuthTag();

  const ephSaltHex = ephSalt.toString('hex');
  const pwIvHex    = pwIv.toString('hex');
  const pwTagHex   = pwTag.toString('hex');
  const pwEncHex   = pwEnc.toString('hex');

  
  const rb = crypto.randomBytes(16);
  const vn = (i) => '_' + rb.slice(i, i + 4).toString('hex');
  const vC = vn(0), vD = vn(1), vF = vn(2), vH = vn(3);
  const vI = vn(4), vL = vn(5), vR = vn(6), vS = vn(7);
  const vT = vn(8), vW = vn(9);

  return (
    `(function(){` +

    
    `var ${vT}=Date.now();for(var ${vI}=0;${vI}<1e5;${vI}++);` +
    `if(Date.now()-${vT}>2000){process.exit(1);}` +

    
    `var ${vR}=global.eval;` +
    `global.eval=Object.freeze(function(){throw new Error();});` +

    
    `var ${vC}=require('crypto');` +

    
    `var ${vL}=(function(){` +
      `try{` +
      `var _s=Buffer.from(${JSON.stringify(ephSaltHex)},'hex');` +
      `var _wk=${vC}.hkdfSync('sha256',_s,Buffer.alloc(0),Buffer.from('koala-env-seed'),32);` +
      `var _dc=${vC}.createDecipheriv('aes-256-gcm',Buffer.from(_wk),Buffer.from(${JSON.stringify(pwIvHex)},'hex'));` +
      `_dc.setAuthTag(Buffer.from(${JSON.stringify(pwTagHex)},'hex'));` +
      `return Buffer.concat([_dc.update(Buffer.from(${JSON.stringify(pwEncHex)},'hex')),_dc.final()]).toString('utf8');` +
      `}catch(_){return null;}` +
    `})();` +
    `if(!${vL}){process.exit(1);}` +

    
    `var ${vD}=${JSON.stringify(encrypted)};` +
    `function ${vF}(h,k){` +
      `try{` +
      `var p=h.split(':');if(p.length!==4)return null;` +
      `var _salt=Buffer.from(p[0],'hex');` +
      `var _iv=Buffer.from(p[1],'hex');` +
      `var _tg=Buffer.from(p[2],'hex');` +
      `var _ek=${vC}.scryptSync(k,_salt,32,{N:16384,r:8,p:1});` +
      `var _dc=${vC}.createDecipheriv('aes-256-gcm',_ek,_iv);` +
      `_dc.setAuthTag(_tg);` +
      `return Buffer.concat([_dc.update(Buffer.from(p[3],'hex')),_dc.final()]).toString('utf8');` +
      `}catch(e){return null;}}` +

    `var ${vS}=${vF}(${vD},${vL});` +
    `if(!${vS}){process.exit(2);}` +

    
    `var ${vH}=new Function('module','exports','require','__dirname','__filename',${vS});` +
    `global.eval=${vR};` +
    `${vH}.call(module.exports,module,module.exports,require,__dirname,__filename);` +
    `})();`
  );
}

module.exports = { encrypt, decrypt, wrapInDecryptionEnvelope };
