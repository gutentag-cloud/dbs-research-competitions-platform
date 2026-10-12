const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'),{webcrypto}=require('node:crypto');
const saved=new Map();
const localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};
let context;
function load(){const ctx=vm.createContext({console,structuredClone,crypto:webcrypto,TextEncoder,Blob,URL,window:{localStorage}});ctx.RCP=ctx.window.RCP={};for(const file of ['data.js','store.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);context=ctx;return ctx.RCP.store;}
(async()=>{
 let S=load();assert.deepEqual(Array.from(S.db.projects,p=>p.id),['p-disney','p-pwc','p-disney-camera','p-disney-sensors','p-disney-console']);assert.equal(S.db.postings.length,0);assert.equal(S.db.projects.flatMap(p=>p.files).length,8);assert.ok(S.db.projects.flatMap(p=>p.files).every(f=>f.trial));assert.equal(S.db.projects.flatMap(p=>p.logs).length,0);
 await assert.rejects(S.login('Mr. XXX','wrong'));
 assert.throws(()=>S.signIn('pilot-admin','committee'));
 await S.login('Mr. XXX','Mr. XXX');assert.equal(S.role(),'committee');assert.equal(S.me().mustChangePassword,true);
 assert.throws(()=>S.manageAccount({username:'Partner',roles:['partner'],projectIds:['p-disney'],active:true}));
 await S.changePassword('Mr. XXX','a different password 2026');assert.equal(S.role(),'committee');assert.equal(S.me().mustChangePassword,false);
 const partner=S.manageAccount({username:'Mr. Disney',roles:['partner'],projectIds:['p-disney'],active:true});
 const pwc=S.manageAccount({username:'Mr. PwC',roles:['partner'],projectIds:['p-pwc'],active:true});
 const doc=await S.addFile('p-disney',new Blob(['internal brief']),'Proposal',S.me().id);
 S.shareFile('p-disney',doc,[partner.id]);assert.throws(()=>S.shareFile('p-disney',doc,[pwc.id]));
 const evidence=await S.addFile('p-disney',new Blob(['CV']),'Experience evidence',S.me().id);assert.throws(()=>S.shareFile('p-disney',evidence,[partner.id]));
 S.signOut();await S.login('Mr. Disney','Mr. Disney');assert.equal(S.canReadFile(doc),false);
 await S.changePassword('Mr. Disney','disney changed password 2026');assert.equal(S.canReadFile(doc),true);assert.equal(S.canReadFile(evidence),false);assert.throws(()=>S.signIn(partner.id,'committee'));
 S.signOut();await S.login('Mr. PwC','Mr. PwC');await S.changePassword('Mr. PwC','pwc changed password 2026');assert.equal(S.canReadFile(doc),false);await assert.rejects(S.getFile(doc));
 S.signOut();await S.login('Mr. XXX','a different password 2026');S.shareFile('p-disney',doc,[]);S.signOut();await S.login('Mr. Disney','disney changed password 2026');assert.equal(S.canReadFile(doc),false);
 S.signOut();await S.login('Mr. XXX','a different password 2026');S.manageAccount({id:partner.id,username:'Mr. Disney',roles:['partner'],projectIds:['p-disney'],active:false});await assert.rejects(S.login('Mr. Disney','disney changed password 2026'));
 assert.equal(S.db.audit.some(a=>/^signed in as /.test(a.text)),false);
 S.db.projects.push({...S.db.projects[0],id:'p-custom',title:'User-created project',files:[],logs:[]});S.save();S=load();assert.equal(S.db.projects.length,6);await S.login('Mr. XXX','a different password 2026');assert.equal(S.me().mustChangePassword,false);
 S.signOut();await S.login('Trevor Chak','Trevor Chak');S.skipPasswordChange();assert.equal(S.me().mustChangePassword,false);assert.equal(S.me().passwordHash,undefined);assert.equal(S.canReadFile(doc),true);S.signOut();await S.login('Trevor Chak','Trevor Chak');assert.equal(S.role(),'student');assert.throws(()=>S.setProjectLinks('p-pwc',{github:'https://github.com/example/repo',drive:''}));assert.throws(()=>S.setProjectLinks('p-disney',{github:'https://evil.test/repo',drive:''}));S.setProjectLinks('p-disney',{github:'https://github.com/gutentag-cloud/Disney-Railway-Tracker',drive:''});assert.ok(S.project('p-disney').links.github.includes('Disney-Railway-Tracker'));S.signOut();await S.login('Mr. XXX','a different password 2026');
 const root={innerHTML:''};context.document={getElementById:()=>root,addEventListener:()=>{}};context.location={hash:'#/'};context.window.scrollTo=()=>{};context.window.addEventListener=()=>{};
 for (const hash of ['#/','#/workspaces','#/accounts','#/calendar','#/register','#/project/p-disney','#/project/p-pwc']) {context.location.hash=hash;vm.runInContext(fs.readFileSync('app.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));assert.ok(root.innerHTML.length>100);assert.ok(!root.innerHTML.includes('Water quality logger'));}
 context.location.hash='#/';vm.runInContext(fs.readFileSync('app.js','utf8'),context);await new Promise(resolve=>setImmediate(resolve));assert.ok(root.innerHTML.includes('PwC Dark Lab'));assert.ok(root.innerHTML.includes('Disney'));
 console.log('Passed: clean seed, login, default-password change, roles, account suspension, evidence restrictions, document grants, revocation, cross-partner separation and reload persistence.');
})().catch(e=>{console.error(e);process.exit(1)});
