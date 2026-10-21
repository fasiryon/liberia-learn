import fs from 'fs';
import path from 'path';
import pins from '@/curriculum/factory-v2/authoring/first-three/runtime-source-pins.json';
import {bytesHash} from './batchContract';

/** Local factory boundary. Refuse stale source pins rather than reuse an immutable package after code changes. */
export function verifyFirstThreeRuntimeSources(){
 if(pins.pins.length<21||new Set(pins.pins.map(pin=>pin.path)).size!==pins.pins.length)throw new Error('partial_runtime_source_manifest_invalid');
 for(const pin of pins.pins){const file=path.resolve(process.cwd(),pin.path);if(fs.lstatSync(file).isSymbolicLink()||bytesHash(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'))!==pin.sha256)throw new Error(`partial_runtime_source_pin_mismatch:${pin.path}`);}
 return pins;
}
