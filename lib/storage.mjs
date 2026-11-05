import {getStore} from '@netlify/blobs';
export const store=()=>getStore({name:'gaina-procurement-v2',consistency:'strong'});
export async function read(db,key){return await db.getWithMetadata(key,{type:'json',consistency:'strong'})}
export async function write(db,key,data,etag){const result=await db.setJSON(key,data,etag?{onlyIfMatch:etag}:{onlyIfNew:true});if(result?.modified===false)throw Object.assign(new Error('別の更新がありました。再読込してやり直してください'),{status:409});return result}
