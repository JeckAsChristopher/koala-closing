

'use strict';

const native = require('./native-bridge');

const JUNK_TEMPLATES = [
  (n) => `function ${n}(){var _x=Math.random()*1e6|0;for(var _i=0;_i<_x%17;_i++){_x^=_i<<3;}_x&=0xFFFF;return _x;}`,
  (n) => `function ${n}(a,b){if(typeof a==='undefined')return null;var _r=[];for(var _k in a){if(a.hasOwnProperty(_k))_r.push(_k+':'+b);}return _r.join(',');}`,
  (n) => `function ${n}(){var _d=new Date();return (_d.getTime()^0xDEAD)>>>2;}`,
  (n) => `function ${n}(x){var _t=x||0;while(_t>1){_t=_t%2===0?_t/2:_t*3+1;}return _t;}`,
  (n) => `function ${n}(){var _s='';var _c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';for(var _i=0;_i<8;_i++){_s+=_c[Math.floor(Math.random()*_c.length)];}return _s;}`,
  (n) => `function ${n}(a){if(!Array.isArray(a))return [];return a.slice().sort(function(x,y){return x>y?1:-1;});}`,
  (n) => `var ${n}=(function(){var _m={};return{get:function(k){return _m[k];},set:function(k,v){_m[k]=v;}};})();`,
  (n) => `function ${n}(){var _p=process.env['_'+Math.random().toString(36).slice(2)];return _p?_p.charCodeAt(0)&0xFF:0;}`,
];

const JUNK_EXPORTS = [
  (n) => `module.exports.${n}=${n};`,
  (n) => `exports.${n}=${n};`,
];

function generateJunkBlock(count = 5) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const name = '_k' + native.generateRandomName(6);
    const tpl  = JUNK_TEMPLATES[i % JUNK_TEMPLATES.length];
    lines.push(tpl(name));
    if (Math.random() > 0.5) {
      const expTpl = JUNK_EXPORTS[i % JUNK_EXPORTS.length];
      lines.push(expTpl(name));
    }
  }
  return lines.join('\n');
}

function injectDecoyVars(source) {
  const vars = [];
  for (let i = 0; i < 4; i++) {
    const name = '_' + native.generateRandomName(5);
    const val  = Math.floor(Math.random() * 0xFFFFFF);
    vars.push(`var ${name}=${val};`);
  }
  return vars.join('') + source;
}

function buildJunkFile() {
  return generateJunkBlock(8 + Math.floor(Math.random() * 6));
}

module.exports = { generateJunkBlock, injectDecoyVars, buildJunkFile };
