// Development only: loopback servers and a local Blobs emulator. Never deployed.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {BlobsServer} from '@netlify/blobs/server';
import {getStore} from '@netlify/blobs';
import {handler} from '../netlify/functions/procurement.mjs';
const dir=process.env.GAINA_DEV_DATA_DIR||'/tmp/gaina-local-blobs';await mkdir(dir,{recursive:true});
const blobServer=new BlobsServer({directory:dir,token:'local-emulator-only',logger:()=>{}});const address=await blobServer.start();
const db=getStore({name:'gaina-procurement-v2',siteID:'local-site',token:'local-emulator-only',apiURL:`http://127.0.0.1:${address.port}`,consistency:'strong'});
process.env.GAINA_ADMIN_KEY='local-development-only-administrator';
// The official emulator omits ETags on GET. Obtain its ETag through LIST,
// preserving conditional-write checks instead of disabling them in production.
const localDB={get:(...args)=>db.get(...args),setJSON:(...args)=>db.setJSON(...args),list:(...args)=>db.list(...args),async getWithMetadata(key,options){const r=await db.getWithMetadata(key,options);if(r&&!r.etag){const result=await db.list();r.etag=result.blobs.find(b=>b.key===key)?.etag;if(!r.etag)throw Error('Local emulator ETag missing')}return r}};
const api=handler(()=>localDB),root=resolve('dist');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:3001');if(url.pathname.startsWith('/api/procurement/')){let raw='';for await(const c of req)raw+=c;const response=await api(new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:raw}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return}const path=resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return}const content=await readFile(path);const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(content)}catch{res.writeHead(404);res.end('Not found')}});
server.listen(3001,'127.0.0.1',()=>console.log('Local development server running on port 3001. See README for the local-only test key.'));
const close=()=>server.close(()=>blobServer.stop().then(()=>process.exit()));process.on('SIGTERM',close);process.on('SIGINT',close);
