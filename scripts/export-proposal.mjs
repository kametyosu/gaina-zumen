import './render-proposal.mjs';
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('proposal');
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/')path='/index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error();const data=await readFile(file);const type={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'}[extname(file)]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(data)}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 await page.emulateMedia({media:'print'});
 const layout=await page.locator('.sheet').evaluateAll(pages=>pages.map((page,index)=>({page:index+1,overflow:page.querySelector('.page-body').getBoundingClientRect().bottom>page.querySelector('.page-footer').getBoundingClientRect().top-7})));
 const overflow=layout.filter(p=>p.overflow);if(overflow.length)throw Error('Proposal page content overlaps footer: '+overflow.map(p=>p.page).join(','));
 if(layout.length!==6)throw Error('Expected 6 proposal pages');
 await page.pdf({path:'proposal/gaina-proposal.pdf',format:'A4',landscape:true,preferCSSPageSize:true,printBackground:true,tagged:true,outline:true});
 await page.emulateMedia({media:'screen'});
 for(const number of [1,2,3,4])await page.locator('#page'+number).screenshot({path:'/tmp/gaina-proposal-page'+number+'.png'});
 console.log('Generated proposal/gaina-proposal.pdf — 6 pages; no footer overlaps.');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
