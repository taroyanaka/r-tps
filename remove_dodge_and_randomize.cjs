const fs = require('fs');

const root = 'C:/Users/taroyanaka/Downloads/r-tps';

function read(p) {
  return fs.readFileSync(`${root}/${p}`, 'utf8');
}

function write(p, text) {
  fs.writeFileSync(`${root}/${p}`, text);
}

let data = read('data.js');
const dodgeStart = data.indexOf(',"dodge":{');
const limitStart = data.indexOf(',"limit":{', dodgeStart);
if (dodgeStart !== -1 && limitStart !== -1) {
  data = data.slice(0, dodgeStart) + data.slice(limitStart);
}
data = data.replace(
  /"initialDeck":\[\{"id":"strike","upgraded":false\},\{"id":"strike","upgraded":false\},\{"id":"strike","upgraded":false\},\{"id":"defend","upgraded":false\},\{"id":"defend","upgraded":false\},\{"id":"defend","upgraded":false\},\{"id":"dodge","upgraded":false\},\{"id":"shotgun","upgraded":false\},\{"id":"limit","upgraded":false\}\]/,
  '"initialDeck":[{"id":"strike","upgraded":false},{"id":"strike","upgraded":false},{"id":"strike","upgraded":false},{"id":"defend","upgraded":false},{"id":"defend","upgraded":false},{"id":"defend","upgraded":false},{"id":"shotgun","upgraded":false},{"id":"limit","upgraded":false}]'
);
data = data.replace(/,"dodge"/g, '');
write('data.js', data);

let ja = read('ja_patch.js');
const dodgePatchStart = ja.indexOf("  dodge: { name: '回避パルス'");
const limitPatchStart = ja.indexOf('  limit:', dodgePatchStart);
if (dodgePatchStart !== -1 && limitPatchStart !== -1) {
  ja = ja.slice(0, dodgePatchStart) + ja.slice(limitPatchStart);
}
write('ja_patch.js', ja);
