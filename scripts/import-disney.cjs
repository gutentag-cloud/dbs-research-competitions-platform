// Copies selected project documentation into private storage; never into docs/.
const fs=require('node:fs'),path=require('node:path');
const source=process.argv[2];if(!source)throw new Error('Usage: node scripts/import-disney.cjs /absolute/path/to/Software');
const {read,write,sql,DATA,hash}=require('../server.cjs');const data=read();
const files=[
 ['p-disney','RPi5/README.md','Proposal','text/markdown'],
 ['p-disney','RPi5/samples/replay_scan.csv','Other','text/csv'],
 ['p-disney','Railroad Drawings/Clearance Envelope.pdf','Other','application/pdf'],
 ['p-disney','Railroad Drawings/Maintenance Vehicle.pdf','Other','application/pdf'],
 ['p-disney-camera','Camera Detection/README.md','Proposal','text/markdown'],
 ['p-disney-sensors','RPi5/D6_PROTOCOL_NOTES.md','Other','text/markdown'],
 ['p-disney-sensors','RPi5/hardware/GAUGE_MOUNT_DEFAULTS.md','Other','text/markdown'],
 ['p-disney-console','RPi5/SYSTEM_CONSOLE.md','Proposal','text/markdown'],
 ['p-disney-console','RPi5/PRE_HARDWARE.md','Other','text/markdown']
];
let count=0;for(const [phaseId,relative,category,type] of files){const location=path.resolve(source,relative);if(!fs.existsSync(location))throw new Error('Required source file missing: '+relative);const p=data.projects.find(p=>p.id==='p-disney');if(!p)throw new Error('Workspace missing: '+phaseId);const bytes=fs.readFileSync(location),id='disney-source-'+hash(phaseId+'/'+relative).slice(0,24),name=relative.replaceAll('/',' — ');fs.writeFileSync(path.join(DATA,'files',hash(id)),bytes,{mode:0o600});const meta={id,name,phaseId,type,category,size:bytes.length,by:'pilot-admin',at:new Date().toISOString(),sourceReference:'Software/'+relative,privateSource:true,partnerIds:[]};const index=p.files.findIndex(f=>f.id===id);if(index<0)p.files.push(meta);else p.files[index]={...meta,partnerIds:p.files[index].partnerIds||[]};count++;}
write(data);sql.close();console.log('Imported '+count+' original documents into private local storage. No source files were added to the public site.');
