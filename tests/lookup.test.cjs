const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/script.js'),'utf8');
const id='d136fa27-8883-4bf0-a9d2-c126cc7e3990';
function setup(handler) {
 const els={};const context={URL,AbortController,setTimeout,clearTimeout,fetch:handler,document:{addEventListener(){},getElementById(key){return els[key]??={value:'',style:{},setAttribute(){}};}}};
 vm.createContext(context);vm.runInContext(source,context);return {context,els,run:code=>vm.runInContext(code,context)};
}
const response=data=>({ok:true,json:async()=>data});
const tenant=tid=>response({issuer:`https://login.microsoftonline.com/${tid}/v2.0`,tenant_region_scope:'EU'});
const dns=()=>response({Status:0,Answer:[{type:5,data:'alias.example.com'},{type:15,data:'20 second.example.com.',TTL:60},{type:15,data:'10 first.example.com.',TTL:120}]});
test('domain validation, IDN, escaping',()=>{const {run}=setup();assert.equal(run("normalizeDomain(' EXAMPLE.com. ')"),'example.com');assert.equal(run("normalizeDomain('bücher.de')"),'xn--bcher-kva.de');for(const bad of ['https://example.com','a..com','-a.com','127.0.0.1','x@y.com','<script>'])assert.throws(()=>run(`normalizeDomain(${JSON.stringify(bad)})`));assert.equal(run("escapeHtml('<img>')"),'&lt;img&gt;');});
test('MX filters CNAME and sorts priority',async()=>{const {context}=setup(async()=>dns());const result=await context.getMx('example.com');assert.equal(result.records.length,2);assert.equal(result.records[0].host,'first.example.com');});
test('DNS empty, null MX, NXDOMAIN and SERVFAIL',async()=>{for(const [payload,expected] of [[{Status:0},'No MX'],[{Status:3},'does not exist']]){const {context}=setup(async()=>response(payload));assert.match((await context.getMx('example.com')).message,new RegExp(expected));}let app=setup(async()=>response({Status:2}));await assert.rejects(app.context.getMx('example.com'));app=setup(async()=>response({Status:0,Answer:[{type:15,data:'0 .',TTL:30}]}));assert.equal((await app.context.getMx('example.com')).records[0].host,'.');});
test('Tenant ID search performs no DNS query without a domain',async()=>{let calls=0;const {context,els}=setup(async()=>{calls++;return tenant(id);});context.document.getElementById('input').value=id;await context.lookupFromCustomDomain();assert.equal(calls,1);assert.match(els.resultsSection.innerHTML,/Tenant region/);assert.match(els.resultsSection.innerHTML,/optional MX/);assert.equal(els.lookupBtn.disabled,false);});
test('matching domain returns MX, mismatching domain blocks DNS',async()=>{for(const matches of [true,false]){let dnsCalls=0;const {context,els}=setup(async url=>{if(url.includes('dns.google')){dnsCalls++;return dns();}return tenant(url.includes(id)||matches?id:'11111111-1111-1111-1111-111111111111');});context.document.getElementById('input').value=id;context.document.getElementById('mxDomain').value='example.com';await context.lookupFromCustomDomain();assert.equal(dnsCalls,matches?1:0);assert.match(els.resultsSection.innerHTML,matches?/first.example.com/:/different tenant/);}});
test('DNS survives tenant failure; tenant survives DNS failure',async()=>{for(const failDns of [true,false]){const {context,els}=setup(async url=>{const isDns=url.includes('dns.google');if(isDns===failDns)throw new Error('Offline');return isDns?dns():tenant(id);});context.document.getElementById('input').value='example.com';await context.lookupFromCustomDomain();assert.match(els.resultsSection.innerHTML,failDns?/Tenant ID/:/first.example.com/);assert.match(els.resultsSection.innerHTML,/Offline/);assert.equal(els.spinner.style.display,'none');}});
