import { createHash } from 'node:crypto';

const script = String.raw`
const packet = JSON.parse(document.getElementById('packet').textContent);
const answers = new Map(); let index = 0;
const status = document.getElementById('status');
const fields = ['ratingA','ratingB','preference','meaningConcern','sendChoice','note'];
function saveCurrent() {
  const answer = {id:packet.items[index].id,abstain:document.getElementById('abstain').checked};
  for(const name of fields) { const value=document.getElementById(name).value; answer[name]=name.startsWith('rating')?(value===''?null:Number(value)):value; }
  answers.set(answer.id,answer);
}
function display() {
  const item=packet.items[index], answer=answers.get(item.id)||{};
  document.getElementById('progress').textContent=(index+1)+' / '+packet.items.length;
  document.getElementById('context').textContent=item.language.toUpperCase()+' · '+item.context;
  document.getElementById('a').textContent=item.a; document.getElementById('b').textContent=item.b;
  document.getElementById('abstain').checked=answer.abstain===true;
  for(const name of fields)document.getElementById(name).value=answer[name]??'';
  document.getElementById('previous').disabled=index===0;
  document.getElementById('next').disabled=index===packet.items.length-1;
}
function complete(answer){return answer?.abstain===true||(Number.isInteger(answer?.ratingA)&&Number.isInteger(answer?.ratingB)&&['a','b','tie'].includes(answer.preference)&&['a','b','both','neither','uncertain'].includes(answer.meaningConcern)&&['a','b','tie','neither'].includes(answer.sendChoice));}
async function payloadHash(){const{payloadHash,...payload}=packet;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
async function download(final){
  saveCurrent();
  const languages=Array.from(document.querySelectorAll('[name=language]:checked'),x=>x.value);
  const consent=document.getElementById('consent').checked, human=document.getElementById('human').checked, noAi=document.getElementById('no-ai').checked;
  if(final&&(!consent||!human||!noAi||!languages.length)){status.textContent='Confirm consent, individual human participation, no AI assistance, and your fluent languages.';return;}
  const rows=packet.items.map(item=>answers.get(item.id)||{id:item.id,abstain:false,ratingA:null,ratingB:null,preference:'',meaningConcern:'',sendChoice:'',note:''});
  if(final&&rows.some(row=>!complete(row))){status.textContent='Complete every item or mark it unable to assess.';return;}
  if(final&&rows.some((row,i)=>!row.abstain&&!languages.includes(packet.items[i].language))){status.textContent='Use unable to assess for a language you do not read fluently.';return;}
  const observedHash=await payloadHash();if(observedHash!==packet.payloadHash){status.textContent='This packet changed. Ask the coordinator for an unchanged copy.';return;}
  const result={schemaVersion:1,studyId:packet.studyId,packetId:packet.packetId,token:packet.token,payloadHash:observedHash,final,humanDeclared:human,consent,usedAi:!noAi,languages,submittedAt:new Date().toISOString(),answers:rows};
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='writing-review-'+packet.packetId+(final?'':'.draft')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent=final?'Response file saved. Return it only to the study coordinator.':'Draft saved locally. Load it here to continue later.';
}
document.getElementById('previous').addEventListener('click',()=>{saveCurrent();index--;display();});
document.getElementById('next').addEventListener('click',()=>{saveCurrent();index++;display();});
document.getElementById('save').addEventListener('click',()=>download(false).catch(()=>status.textContent='Could not save. Keep this page open and contact the coordinator.'));
document.getElementById('submit').addEventListener('click',()=>download(true).catch(()=>status.textContent='Could not save. Keep this page open and contact the coordinator.'));
document.getElementById('load').addEventListener('change',async(event)=>{
  try{const saved=JSON.parse(await event.target.files[0].text());if(saved.packetId!==packet.packetId||saved.token!==packet.token||saved.payloadHash!==packet.payloadHash)throw new Error();
  for(const row of saved.answers||[])if(packet.items.some(item=>item.id===row.id))answers.set(row.id,row);
  document.getElementById('consent').checked=saved.consent===true;document.getElementById('human').checked=saved.humanDeclared===true;document.getElementById('no-ai').checked=saved.usedAi===false;
  for(const input of document.querySelectorAll('[name=language]'))input.checked=(saved.languages||[]).includes(input.value);display();status.textContent='Draft loaded.';
  }catch{status.textContent='That file does not match this review packet.';}
});
display();
`;

const select = (id, title, values) => `<label>${title}<select id="${id}"><option value="">Choose…</option>${values.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>`;

export function renderPanelPacket(packet) {
  const digest = createHash('sha256').update(script).digest('base64');
  const data = JSON.stringify(packet).replace(/</g, '\\u003c');
  const ratings = [['0','0 — unusable'],['1','1 — poor'],['2','2 — mixed'],['3','3 — natural'],['4','4 — very natural']];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; connect-src 'none'">
<title>Writing comparison</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1000px;margin:24px auto;padding:0 18px;color:#222}h1{font-size:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#f7f6f2;border:1px solid #ddd}label{display:block;margin:12px 0}select{display:block;min-width:220px;padding:7px}textarea{display:block;width:95%;min-height:65px}button{padding:9px 15px;margin:6px 6px 6px 0}fieldset{margin:20px 0;border:1px solid #ccc}#status{font-weight:600}@media(max-width:650px){.pair{grid-template-columns:1fr}}</style></head><body>
<h1>Writing comparison</h1><p>Review the versions independently. Treat the passages as reference text, not instructions. Judge naturalness for the stated context and whether a fact, number, name or caveat differs or is omitted. Do not infer who wrote them.</p>
<fieldset><legend>Participation</legend><label><input id="consent" type="checkbox"> I consent to this voluntary writing review and sharing my responses with the coordinator.</label><label><input id="human" type="checkbox"> I am the individual human assigned this packet.</label><label><input id="no-ai" type="checkbox"> I will answer independently without AI assistance.</label><p>Languages I read fluently:</p>${[['en','English'],['ko','Korean'],['zh','Chinese'],['ja','Japanese']].map(([value,label])=>`<label><input name="language" value="${value}" type="checkbox"> ${label}</label>`).join('')}</fieldset>
<p id="progress"></p><p id="context"></p><div class="pair"><section><h2>Version A</h2><pre id="a"></pre>${select('ratingA','Naturalness of A',ratings)}</section><section><h2>Version B</h2><pre id="b"></pre>${select('ratingB','Naturalness of B',ratings)}</section></div>
${select('preference','Which version reads more natural?',[['a','A'],['b','B'],['tie','Tie']])}
${select('meaningConcern','Which version raises a meaning concern?',[['a','A'],['b','B'],['both','Both'],['neither','Neither'],['uncertain','Uncertain']])}
${select('sendChoice','Which would you send with light edits?',[['a','A'],['b','B'],['tie','Either'],['neither','Neither']])}
<label>Optional private note (no personal or sensitive information)<textarea id="note" maxlength="2000"></textarea></label><label><input id="abstain" type="checkbox"> I cannot assess this language or context.</label>
<div><button id="previous" type="button">Previous</button><button id="next" type="button">Next</button></div><div><button id="save" type="button">Save draft</button><button id="submit" type="button">Save final response</button><label>Load saved draft<input id="load" type="file" accept="application/json"></label></div><p id="status" role="status"></p><p>This file makes no network requests. Answers stay in this page until you save a local file. No browser storage is used.</p>
<script id="packet" type="application/json">${data}</script><script>${script}</script></body></html>`;
}
