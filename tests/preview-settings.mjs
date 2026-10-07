import assert from 'node:assert/strict';
import {SETTINGS_KEY,defaultSettings,readPreviewSettings,savePreviewSettings,subscribePreviewSettings} from '../src/preview-settings.js';

const data=new Map();
const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
assert.deepEqual(readPreviewSettings(storage),defaultSettings);
const saved=savePreviewSettings({...defaultSettings,supportPhone:'07712345678',supportEmail:'support@example.test',name:'Test store'},storage);
assert.equal(saved.supportPhone,'07712345678');
assert.deepEqual(readPreviewSettings(storage),saved,'New page loads recover saved support contacts');

const events=new Map();
const target={addEventListener:(type,handler)=>events.set(type,handler),removeEventListener:type=>events.delete(type)};
let otherTab=readPreviewSettings(storage);
const unsubscribe=subscribePreviewSettings(storage,target,next=>otherTab=next);
savePreviewSettings({...saved,supportPhone:'07787654321'},storage);
events.get('storage')({key:SETTINGS_KEY,storageArea:storage});
assert.equal(otherTab.supportPhone,'07787654321','An open storefront receives dashboard contact updates');
savePreviewSettings({...saved,supportPhone:''},storage);
events.get('storage')({key:SETTINGS_KEY,storageArea:storage});
assert.equal(otherTab.supportPhone,'','Clearing the contact propagates to open pages');
savePreviewSettings(saved,storage);
events.get('storage')({key:'other-key'});
assert.equal(otherTab.supportPhone,'','Unrelated storage changes are ignored');
data.clear();events.get('storage')({key:null,storageArea:storage});
assert.deepEqual(otherTab,defaultSettings,'Clearing browser storage restores empty contact defaults');
unsubscribe();assert.equal(events.size,0);

data.set(SETTINGS_KEY,'invalid JSON');assert.deepEqual(readPreviewSettings(storage),defaultSettings);
data.set(SETTINGS_KEY,JSON.stringify({supportPhone:42,lowStock:-1,name:''}));assert.deepEqual(readPreviewSettings(storage),defaultSettings);
const before=storage.getItem(SETTINGS_KEY);
assert.throws(()=>savePreviewSettings(saved,{setItem(){throw Error('quota');}}),/تعذّر حفظ/);
assert.equal(storage.getItem(SETTINGS_KEY),before,'Failed persistence does not change saved settings');
assert.deepEqual(readPreviewSettings({getItem(){throw Error('blocked');}}),defaultSettings);
console.log('Preview support contacts persist across loads and synchronize across tabs, with explicit storage failures.');
