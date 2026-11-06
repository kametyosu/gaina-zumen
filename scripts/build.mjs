import './render-proposal.mjs';
import {build} from 'esbuild';
import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const f of ['index.html','style.css','app.js'])await copyFile(f,'dist/'+f);
await cp('procurement','dist/procurement',{recursive:true});
await cp('supplier','dist/supplier',{recursive:true});
await cp('proposal','dist/proposal',{recursive:true});
await build({entryPoints:['procurement/imports.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/procurement/imports.bundle.js',platform:'browser'});

await build({entryPoints:['procurement/exports.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/procurement/exports.bundle.js',platform:'browser'});

await build({entryPoints:['procurement/rfq-export.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/procurement/rfq-export.bundle.js',platform:'browser'});
await cp('docs','dist/docs',{recursive:true});

await cp('wiring','dist/wiring',{recursive:true});
await build({entryPoints:['wiring/io.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/wiring/io.bundle.js',platform:'browser'});
await build({entryPoints:['wiring/pdf.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/wiring/pdf.bundle.js',platform:'browser'});
await build({entryPoints:['wiring/ocr.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/wiring/ocr.bundle.js',platform:'browser'});
await mkdir('dist/wiring/pdf',{recursive:true});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','dist/wiring/pdf/pdf.worker.min.mjs');
await cp('node_modules/pdfjs-dist/cmaps','dist/wiring/pdf/cmaps',{recursive:true});
await cp('node_modules/pdfjs-dist/standard_fonts','dist/wiring/pdf/standard_fonts',{recursive:true});
await mkdir('dist/wiring/ocr',{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js','dist/wiring/ocr/worker.min.js');
for(const name of ['tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm','tesseract-core-simd-lstm.wasm.js','tesseract-core-simd-lstm.wasm'])await copyFile('node_modules/tesseract.js-core/'+name,'dist/wiring/ocr/'+name);
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz','dist/wiring/ocr/eng.traineddata.gz');

await build({entryPoints:['wiring/reader.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/wiring/reader.bundle.js',platform:'browser'});
await build({entryPoints:['wiring/generator-export.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/wiring/generator-export.bundle.js',platform:'browser'});
await build({entryPoints:['wiring/template-export.mjs'],bundle:true,minify:true,format:'esm',outfile:'dist/wiring/template-export.bundle.js',platform:'browser'});
