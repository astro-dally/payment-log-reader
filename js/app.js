var $=function(s){return document.querySelector(s)};
var wb=null,rows=[];
var MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var KL={setup:'Setup',pull:'Pull',push:'Push',internal:'Internal'};
function p2(n){return n<10?'0'+n:''+n}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function pick(h,names){for(var i=0;i<names.length;i++){for(var j=0;j<h.length;j++){if(h[j].toLowerCase().replace(/[\s_-]/g,'').indexOf(names[i])>-1)return h[j]}}return null}
function cl(v){if(v==null)return '';var s=typeof v==='string'?v.trim():String(v);return /^(null|na|none|nan)$/i.test(s)?'':s}
function J(s){try{var o=JSON.parse(s);return o&&typeof o==='object'?o:null}catch(e){return null}}
function toMs(v){
  if(v instanceof Date)return Date.UTC(v.getFullYear(),v.getMonth(),v.getDate(),v.getHours(),v.getMinutes(),v.getSeconds(),v.getMilliseconds());
  if(typeof v==='number')return Math.round((v-25569)*864e5);
  var s=String(v).trim(),m=s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if(m)return Date.UTC(+m[3],+m[2]-1,+m[1],+m[4],+m[5],+m[6],m[7]?+(m[7]+'00').slice(0,3):0);
  m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T_](\d{1,2}):(\d{2}):(\d{2})/);
  return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6]):null;
}
function fmt(ms){if(ms==null)return '';var d=new Date(ms);return d.getUTCDate()+' '+MO[d.getUTCMonth()]+' '+p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())+':'+p2(d.getUTCSeconds())+'.'+('00'+d.getUTCMilliseconds()).slice(-3)}
function gapText(ms){var m=Math.floor(ms/6e4),h=Math.floor(m/60),d=Math.floor(h/24);return d>0?d+'d '+(h%24)+'h':h>0?h+'h '+(m%60)+'m':m+' min'}
function cls(s){return /SUCC|CHARGED/.test(s)?'ok':/FAIL|DECLIN|ERROR/.test(s)?'bad':'pen'}
function chip(s){return el('span','chip '+cls(s),s)}

function classify(x){
  var u=x.url,m=x.m,o=J(x.res),q=J(x.req),c={k:'setup',p:'',ti:'',tx:'',st:'',rep:0,sig:''},out=/OUT/i.test(x.a);
  if(!/INCOMING|OUTGOING/i.test(x.a)){c.k='internal';c.p='Inside Juspay';c.ti='Internal log: '+(x.lbl||x.a||'entry');c.tx='Not an API call. This is Juspay\u2019s own logging for the order'+(x.host?' (service: '+x.host+')':'')+'. Hidden by default.';return c}
  if(/decide-gateway/.test(u)){var g=o&&o.decided_gateway;c.p='Juspay \u2192 Juspay decider';c.ti='Juspay picks the gateway'+(g?': '+g:'');c.tx='A lookup inside Juspay\u2019s decider service that chooses which gateway handles this payment. It is not polling and nothing leaves Juspay.';return c}
  if(/\/transactions\/status/.test(u)){
    c.k='pull';c.rep=1;c.p='Juspay \u2192 Gateway';var s=o&&o.status,r=(o&&o.remarks)||'';
    if(x.code==504||/timeout/i.test(x.res)){c.st='TIMEOUT';c.sig='timeout';c.ti='Juspay polls the gateway: no answer (timeout)';c.tx='Pull. Juspay asked the gateway for the status and it did not answer in time (HTTP '+(x.code||'504')+'). The outcome is unknown, so the order should stay pending, not failed.'}
    else if(s){c.st=s;c.sig=s+'|'+r;c.ti='Juspay polls the gateway: '+s+(r?' ('+r+')':'');c.tx='Pull. Juspay asks the gateway \u201Cwhat is the status of this transaction?\u201D and the gateway answers '+s+'.'+(/not available/i.test(r)?' \u201CMerchant TranId is not available\u201D means the gateway cannot find the transaction yet. It returned status FAILURE although this is not a genuine decline.':'')+(s==='SUCCESS'?' This is the real confirmation that the customer\u2019s money was debited.':'')}
    else{c.st='NO STATUS';c.sig='nostatus';c.ti='Juspay polls the gateway: reply has no status';c.tx='Pull. The gateway replied with only an id and no status, so Juspay learned nothing. An incomplete reply like this should be treated as unknown.'}
    return c}
  if(/\/api\/m1\/transactions$/.test(u)){var s2=o&&o.status;c.p='Juspay \u2192 Gateway';c.st=s2||'';c.ti='Juspay asks the gateway to create the UPI transaction';c.tx='Juspay calls the gateway to start the payment'+(o&&o.amount?' of INR '+o.amount:'')+'. The gateway replies '+(s2||'(no status)')+', meaning created and waiting for the customer to approve in the UPI app.';return c}
  if(/notifications/.test(u)&&out){
    c.k='push';c.p='Juspay \u2192 Merchant';var ev=(q&&q.event_name)||'event';c.st=ev;c.ti='Juspay sends a webhook to the merchant: '+ev;
    var M={TXN_CREATED:'tells the merchant the transaction was created and is still pending.',ORDER_FAILED:'tells the merchant the order FAILED. The merchant may now show failure, cancel the order, and cannot use the Refund API. If the gateway later confirms success, the merchant must be told again.',ORDER_SUCCEEDED:'tells the merchant the payment SUCCEEDED, so the order can be fulfilled or refunded through the API.'};
    c.tx='Push. Juspay sends an HTTP POST to the merchant\u2019s notification URL that '+(M[ev]||'reports this event.')+' The merchant answered HTTP '+(x.code||'?')+(o&&o.message?' \u201C'+o.message+'\u201D':'')+(x.code==200?', so it received the webhook.':'. Check why it did not answer 200.');return c}
  if(/\/txns$/.test(u)&&m==='POST'){var pm=q&&q.payment_method;c.p='Customer app \u2192 Juspay';c.st=(o&&o.status)||'';c.ti='Payment starts'+(pm?' with '+pm:'')+(c.st?': '+c.st:'');c.tx='The checkout calls Juspay\u2019s /txns API when the customer picks a payment method'+(pm?' ('+pm+')':'')+'. Juspay replies '+(c.st||'with no status')+(c.st==='PENDING_VBV'?', which means waiting for the customer to approve the payment.':'.');return c}
  if(/\/ecr\/orders$/.test(u)&&m==='POST'){c.p='Merchant \u2192 Juspay';c.st=(o&&o.status)||'';c.ti='Merchant creates the order'+(c.st?': '+c.st:'');c.tx='The merchant\u2019s server tells Juspay a new order exists (order id, amount). Juspay stores it with status '+(c.st||'NEW')+'. No payment has been tried yet.';return c}
  if(/syncGatewayStatus/.test(u)){var mm=u.match(/inf=([^&]+)/),inf=mm?mm[1]:'';c.k='pull';c.rep=1;c.sig='sync';c.p='Juspay scheduler \u2192 Juspay';c.ti='Scheduled status re-check'+(inf?' ('+inf+')':'');c.n=(inf.match(/hs(\d+)/)||[])[1];c.tx='Juspay\u2019s own retry job calls this route to re-check the transaction with the gateway'+(inf?'. The tag '+inf+' looks like the retry stage, and later stages run further apart':'')+'. A gateway poll follows. It is not a customer or merchant call.';return c}
  if(m==='GET'&&/\/ecr\/orders\/|payment-status/.test(u)){var s3=(o&&o.status)||'';c.k='pull';c.p='Merchant \u2192 Juspay';c.st=s3;c.ti='Merchant checks the order status: '+(s3||'no status');c.tx='Pull. The merchant (or its app) asks Juspay for the order status and Juspay answers from its own record. This is what the merchant sees at that moment, even if the gateway holds a different status.';return c}
  c.p=out?'Juspay \u2192 outside':'Outside \u2192 Juspay';c.ti=m+' '+u.slice(0,70);c.tx='This tool does not recognise this call. Read the request and response below.';return c;
}

function loadFile(f){
  if(typeof XLSX==='undefined'){alert('The Excel reader did not load. Make sure the vendor folder is uploaded next to index.html.');return}
  var r=new FileReader();
  r.onload=function(e){
    try{
      wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      var s=$('#sheet');s.textContent='';
      wb.SheetNames.forEach(function(n){var o=el('option','',n);o.value=n;s.appendChild(o)});
      s.style.display=wb.SheetNames.length>1?'':'none';
      loadSheet(wb.SheetNames[0]);$('#tools').style.display='block';var dz0=$('#drop');dz0.classList.add('mini');dz0.textContent='Opened '+f.name+'. Click to choose another file.';
    }catch(err){alert('Could not read this file. Save it as .xlsx or .csv and open it again.')}
  };
  r.readAsArrayBuffer(f);
}
function loadSheet(name){
  var j=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:true});
  var h=j.length?Object.keys(j[0]):[];
  var C={ts:pick(h,['timestamp','time']),a:pick(h,['action']),m:pick(h,['method']),u:pick(h,['url']),res:pick(h,['resbody']),req:pick(h,['reqbody']),code:pick(h,['rescode']),lat:pick(h,['latency']),lbl:pick(h,['label']),host:pick(h,['hostname'])};
  function g(r,k){return k?cl(r[k]):''}
  rows=[];
  j.forEach(function(r,i){
    var x={i:i,ms:C.ts?toMs(r[C.ts]):null,a:g(r,C.a),m:g(r,C.m).toUpperCase(),url:g(r,C.u),res:g(r,C.res),req:g(r,C.req),code:g(r,C.code).replace(/\.0$/,''),lat:g(r,C.lat),lbl:g(r,C.lbl),host:g(r,C.host)};
    if(x.ms==null&&!x.url)return;
    x.c=classify(x);x.hay=(x.c.ti+' '+x.c.tx+' '+x.url+' '+x.res+' '+x.req).toLowerCase();rows.push(x);
  });
  rows.sort(function(a,b){return (a.ms==null)-(b.ms==null)||a.ms-b.ms||a.i-b.i});
  var sts=[];rows.forEach(function(x){if(x.c.st&&sts.indexOf(x.c.st)<0)sts.push(x.c.st)});
  var s=$('#fs');s.textContent='';var o=el('option','','All statuses');o.value='';s.appendChild(o);
  sts.sort().forEach(function(v){var e=el('option','',v);e.value=v;s.appendChild(e)});
  summary();render();
}

function summary(){
  var S=$('#sum');S.textContent='';
  var R=rows.filter(function(x){return x.c.k!=='internal'&&x.ms!=null});
  if(!R.length){S.style.display='none';return}
  S.style.display='';
  var f=R[0],l=R[R.length-1];
  var dec=R.filter(function(x){return /decide-gateway/.test(x.url)})[0],gw=dec&&J(dec.res)&&J(dec.res).decided_gateway;
  var polls=R.filter(function(x){return x.c.p==='Juspay \u2192 Gateway'&&x.c.sig&&x.c.k==='pull'});
  var na=polls.filter(function(x){return /not available/i.test(x.c.sig)}).length,to=polls.filter(function(x){return x.c.st==='TIMEOUT'}).length,ok=polls.filter(function(x){return x.c.st==='SUCCESS'}).length;
  var hooks=R.filter(function(x){return x.c.k==='push'}),cnt={};hooks.forEach(function(x){cnt[x.c.st]=(cnt[x.c.st]||0)+1});
  var gwh=R.filter(function(x){return /INCOMING/i.test(x.a)&&/webhook|callback/i.test(x.url)}).length;
  var ff=hooks.filter(function(x){return x.c.st==='ORDER_FAILED'})[0],ss=hooks.filter(function(x){return x.c.st==='ORDER_SUCCEEDED'})[0];
  var win=ff&&ss&&ss.ms>ff.ms?gapText(ss.ms-ff.ms):ff?'Never fixed':'None';
  var T=el('div','stats');
  [[gw||'Not found','Gateway chosen'],[polls.length,'Gateway polls, '+na+' said not available'],[hooks.length,'Webhooks sent to the merchant'],[win,ff?'Order shown as failed':'Order was never marked failed']].forEach(function(a){var t=el('div','stat');t.appendChild(el('b','',String(a[0])));t.appendChild(el('span','',a[1]));T.appendChild(t)});
  S.appendChild(T);
  if(ff&&ss&&ss.ms>ff.ms)S.appendChild(el('div','verdict','Juspay told the merchant ORDER_FAILED at '+fmt(ff.ms)+', but the gateway confirmed SUCCESS at '+fmt(ss.ms)+'. The merchant saw a failed order for '+gapText(ss.ms-ff.ms)+' although the customer had paid.'));
  else if(ff)S.appendChild(el('div','verdict','Juspay told the merchant ORDER_FAILED '+cnt.ORDER_FAILED+' time(s) and no success appears by the last log line.'));
  var L=el('div','lines');
  function A(t){L.appendChild(el('div','',t))}
  A('The log runs from '+fmt(f.ms)+' to '+fmt(l.ms)+' ('+gapText(l.ms-f.ms)+').');
  A('Gateway polls: '+na+' said \u201CMerchant TranId is not available\u201D, '+to+' timed out, '+ok+' said SUCCESS.');
  A('Webhooks to the merchant: '+Object.keys(cnt).map(function(k){return cnt[k]+' \u00D7 '+k}).join(', ')+'.');
  if(!gwh)A('No webhook from the gateway to Juspay appears in these logs, so Juspay relied on polling.');
  S.appendChild(L);
}

function rowEl(x){
  var c=x.c,d=el('div','row k-'+c.k+(c.k==='push'||c.st==='SUCCESS'?(cls(c.st)==='bad'?' hl-bad':cls(c.st)==='ok'?' hl-ok':''):'')),h=el('div','head'),mid=el('div','mid'),meta=el('div','meta');
  h.tabIndex=0;h.setAttribute('role','button');
  h.appendChild(el('div','t',fmt(x.ms)));
  mid.appendChild(el('div','ti',c.ti));
  meta.appendChild(el('span','tag',KL[c.k]));meta.appendChild(el('span','',c.p));
  if(x.code)meta.appendChild(el('span','','HTTP '+x.code));
  if(Number(x.lat)>0)meta.appendChild(el('span','',x.lat+' ms'));
  mid.appendChild(meta);h.appendChild(mid);
  if(c.st)h.appendChild(chip(c.st));
  var dt=el('div','detail'),built=false;
  function toggle(){
    if(!built){built=true;
      dt.appendChild(el('p','',c.tx));
      if(x.url){dt.appendChild(el('h4','','Route'));dt.appendChild(el('pre','',(x.m?x.m+' ':'')+x.url))}
      [['Request',x.req],['Response',x.res]].forEach(function(a){if(!a[1]||a[1]==='{}'||a[1]==='""')return;var o=J(a[1]);dt.appendChild(el('h4','',a[0]));dt.appendChild(el('pre','',o?JSON.stringify(o,null,2):a[1]))});
    }
    d.classList.toggle('open');
  }
  h.addEventListener('click',toggle);
  h.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
  d.appendChild(h);d.appendChild(dt);return d;
}

function render(){
  var q=$('#q').value.toLowerCase().trim(),ft=$('#ft').value,fs=$('#fs').value,col=$('#col').checked,intl=$('#int').checked;
  var v=rows.filter(function(x){return (intl||x.c.k!=='internal')&&(!ft||x.c.k===ft)&&(!fs||x.c.st===fs)&&(!q||x.hay.indexOf(q)>-1)});
  $('#count').textContent='Showing '+v.length+' of '+rows.length+' log lines. Click a line to see what it means and the raw request and response.';
  var L=$('#list');L.textContent='';
  if(!v.length){L.appendChild(el('div','empty','No log lines match. Clear the search or choose All.'));return}
  var prev=null,B=null,last='';
  function flush(){
    if(!B)return;
    var p=[];if(B.n)p.push(B.n+' repeated gateway polls');if(B.s)p.push(B.s+' scheduler triggers'+(B.mn!=null?(B.mn===B.mx?' (stage hs'+B.mn+')':' (stages hs'+B.mn+' to hs'+B.mx+')'):''));
    L.appendChild(el('div','rep','\u21BB '+p.join(' and ')+', same answer as before'+(B.sig&&B.sig!=='sync'?': '+B.sig.replace(/\|$/,'').replace('|',': '):'')+'. '+fmt(B.b)+' to '+fmt(B.e)+'. Untick \u201CCollapse repeats\u201D to see each one.'));
    prev={ms:B.e};B=null;
  }
  v.forEach(function(x){
    var c=x.c;
    if(col&&c.rep&&(c.sig==='sync'||c.sig===last)){
      if(!B)B={n:0,s:0,b:x.ms,e:x.ms,sig:last,mn:null,mx:null};
      if(c.sig==='sync'){B.s++;if(c.n!=null){var k=+c.n;B.mn=B.mn==null?k:Math.min(B.mn,k);B.mx=B.mx==null?k:Math.max(B.mx,k)}}else B.n++;
      B.e=x.ms;return;
    }
    flush();
    if(c.rep&&c.sig!=='sync')last=c.sig;
    if(prev&&x.ms!=null&&prev.ms!=null&&x.ms-prev.ms>=6e5)L.appendChild(el('div','gap',gapText(x.ms-prev.ms)+' later'));
    L.appendChild(rowEl(x));prev=x;
  });
  flush();
}
$('#file').addEventListener('change',function(e){if(e.target.files[0])loadFile(e.target.files[0])});
['q','ft','fs','col','int'].forEach(function(id){$('#'+id).addEventListener('input',render)});
$('#sheet').addEventListener('change',function(e){loadSheet(e.target.value)});
$('#seg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;$('#ft').value=b.dataset.v;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});render()});
var dz=$('#drop');
dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('over')});
dz.addEventListener('dragleave',function(){dz.classList.remove('over')});
dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0])});
