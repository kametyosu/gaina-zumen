let database;
async function db(){if(database)return database;database=await new Promise((ok,no)=>{const q=indexedDB.open('gaina-wiring-assist',1);q.onupgradeneeded=()=>q.result.createObjectStore('sessions');q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});return database;}
export async function saveSession(key,value){const d=await db();return new Promise((ok,no)=>{const tx=d.transaction('sessions','readwrite');tx.objectStore('sessions').put(value,key);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
export async function loadSession(key){const d=await db();return new Promise((ok,no)=>{const q=d.transaction('sessions').objectStore('sessions').get(key);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
