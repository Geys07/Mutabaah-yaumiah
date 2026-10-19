import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
const exec=promisify(execFile),bin='C:/Program Files/PostgreSQL/18/bin';
const out=path.join(os.tmpdir(),'CODEX-QA06-20261018');
const connection=db=>{if(!['qa06_fixture','qa06_restore_complete'].includes(db))throw Error('fixture database only');return 'host=127.0.0.1 port=55436 user=qa06 dbname='+db+' connect_timeout=5';};
async function tool(name,args){return exec(path.join(bin,name+'.exe'),args,{windowsHide:true,maxBuffer:8*1024*1024});}
async function sql(db,s){return (await tool('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',connection(db),'-c',s])).stdout.trim();}
async function snapshot(db){
 assert.equal(await sql(db,"select current_database()||':'||current_setting('port')"),db+':55436');
 const tables=JSON.parse(await sql(db,"select json_agg(schemaname||'.'||tablename order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','storage')"));
 const union=tables.map(t=>"select '"+t+"' as table_name,count(*) as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from "+t+" t").join(' union all ');
 const rows=JSON.parse(await sql(db,'select json_agg(x order by table_name) from ('+union+')x'));
 const functions=await sql(db,"select md5(string_agg(p.oid::regprocedure::text||p.prosrc||p.prosecdef::text||coalesce(p.proconfig::text,'')||has_function_privilege('anon',p.oid,'execute')::text||has_function_privilege('authenticated',p.oid,'execute')::text||has_function_privilege('service_role',p.oid,'execute')::text,'' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth')");
 const policies=await sql(db,"select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by schemaname,tablename,policyname),'')) from pg_policies p where schemaname in ('public','auth','storage')");
 return {rows,functions,policies};
}
test('PostgreSQL fixture dump/list/restore preserves table hashes, functions and policies',async()=>{
 const before=await snapshot('qa06_fixture');
 const dump=path.join(out,'qa06-fixture-complete.dump');
 await tool('pg_dump',['-w','-d',connection('qa06_fixture'),'-Fc','-f',dump]);
 const bytes=await readFile(dump);assert.ok(bytes.length>0);
 const list=(await tool('pg_restore',['--list',dump])).stdout;assert.ok(list.includes('TABLE DATA'));
 await tool('createdb',['-h','127.0.0.1','-p','55436','-U','qa06','qa06_restore_complete']);
 await tool('pg_restore',['-w','--exit-on-error','-d',connection('qa06_restore_complete'),dump]);
 const after=await snapshot('qa06_restore_complete');assert.deepEqual(after,before);
 await writeFile(path.join(out,'backup-restore-result.json'),JSON.stringify({fixture_only:true,status:'PASS',tables:before.rows.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),table_hashes_match:true,functions_match:true,policies_match:true,production_backup:false},null,2));
});
