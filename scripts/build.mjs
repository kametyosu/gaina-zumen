import './render-proposal.mjs';
import {build} from 'esbuild';
import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const f of ['index.html','style.css','app.js'])await copyFile(f,'dist/'+f);
await cp('procurement','dist/procurement',{recursive:true});
await cp('supplier','dist/supplier',{recursive:true});
await cp('proposal','dist/proposal',{recursive:true});
await build({entryPoints:['procurement/imports.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/procurement/imports.bundle.js',platform:'browser'});
