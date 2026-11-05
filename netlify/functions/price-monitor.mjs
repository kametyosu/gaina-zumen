import {store} from '../../lib/storage.mjs';
import {collect} from '../../lib/collect.mjs';
export default async()=>{await collect(store());return new Response('ok')};
export const config={schedule:'0 0,6 * * *'};
