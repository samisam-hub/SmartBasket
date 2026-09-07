import type {LocalStorage} from './preference-store';
/** Adopt an unowned offline cache once; never copy another identity's private cache. */
export async function migrateOwnedCache(storage:LocalStorage,source:string,target:string,owner:string,anonymous:boolean,ownerField:'userId'|'id'){
 if(await storage.getItem(target))return;
 const raw=await storage.getItem(source);if(!raw)return;
 const value=JSON.parse(raw),savedOwner=value.saved?.[ownerField];
 if(savedOwner===owner){await storage.setItem(target,raw);return;}
 if(savedOwner||!anonymous)return;
 const claimKey=`${source}:claimed-by`,claim=await storage.getItem(claimKey);if(claim&&claim!==owner)return;
 await storage.setItem(claimKey,owner);await storage.setItem(target,raw);
}
