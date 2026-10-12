// Windows QA output adapter only. Preserve original assertions and owner /tmp evidence.
const fs=require('node:fs'),path=require('node:path'),{syncBuiltinESMExports}=require('node:module');
const destination=path.resolve(process.env.DW_QA_TMP);
const allowed=['full-browser','performance-solo'].map(name=>path.resolve(__dirname,'../shots/rider-blender',name));
if(!allowed.some(root=>destination.startsWith(root+path.sep)))throw Error('QA output path outside isolated evidence directory');
fs.mkdirSync(destination,{recursive:true});
const redirect=p=>typeof p==='string'&&(p==='/tmp'||p.startsWith('/tmp/'))?path.join(destination,p.slice(5)):p;
for(const name of ['writeFileSync','appendFileSync','mkdirSync','readFileSync','existsSync']){const original=fs[name];fs[name]=function(p,...args){return original.call(this,redirect(p),...args);};}
for(const name of ['writeFile','appendFile','mkdir','readFile','access']){const original=fs.promises[name];fs.promises[name]=function(p,...args){return original.call(this,redirect(p),...args);};}
syncBuiltinESMExports();
