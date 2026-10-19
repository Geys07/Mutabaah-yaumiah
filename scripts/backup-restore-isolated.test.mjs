import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

// Fixed loopback source; no remote URL, password, clean or database deletion.
const bin='C:/Program Files/PostgreSQL/18/bin';
const destination='qa25_restore_'+randomUUID().replaceAll('-','').slice(0,12);
const directory=path.join(os.tmpdir(),'CODEX-QA-2-5-20261019',destination);
const run=promisify(execFile);
const sha=data=>createHash('sha256').update(data).digest('hex');
const connection=db=>{
  if(db!=='postqa06_fixture'&&db!==destination)throw Error('Isolated fixture only');
  return `host=127.0.0.1 port=55436 user=qa06 dbname=${db} connect_timeout=5`;
};
async function tool(name,args){return run(path.join(bin,name+'.exe'),args,{windowsHide:true,maxBuffer:32*1024*1024,timeout:60000});}
async function sql(db,query){return (await tool('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',connection(db),'-c',query])).stdout.trim();}
const qi=name=>'"'+name.replaceAll('"','""')+'"';
async function fingerprint(db){
  assert.equal(await sql(db,"select current_database()||':'||current_setting('port')"),db+':55436');
  const tables=JSON.parse(await sql(db,"select jsonb_agg(jsonb_build_object('schema',schemaname,'name',tablename) order by schemaname,tablename) from pg_tables where schemaname not in ('pg_catalog','information_schema') and schemaname not like 'pg_toast%';"));
  const rows=[];
  for(const t of tables){
    const r=JSON.parse(await sql(db,`select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from ${qi(t.schema)}.${qi(t.name)} t`));
    rows.push({...t,...r});
  }
  const definitions=await sql(db,"select coalesce(string_agg(pg_get_functiondef(p.oid),E'\\n' order by n.nspname,p.oid::regprocedure::text),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema') and p.prokind in ('f','p')");
  const policies=await sql(db,"select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]') from pg_policies p");
  const constraints=await sql(db,"select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',t.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) order by n.nspname,t.relname,c.conname),'[]') from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname not in ('pg_catalog','information_schema')");
  return {rows,definitions:sha(definitions),policies:sha(policies),constraints:sha(constraints)};
}

test('isolated current backend dump restores rows, function definitions, RLS and constraints',async()=>{
  await mkdir(directory,{recursive:true});
  const before=await fingerprint('postqa06_fixture');
  const dump=path.join(directory,'synthetic-backend.dump');
  await tool('pg_dump',['-w','-Fc','-d',connection('postqa06_fixture'),'-f',dump]);
  const bytes=await readFile(dump);
  assert.ok((await tool('pg_restore',['--list',dump])).stdout.includes('TABLE DATA'));
  await tool('createdb',['-h','127.0.0.1','-p','55436','-U','qa06',destination]);
  const start=performance.now();
  await tool('pg_restore',['-w','--exit-on-error','-d',connection(destination),dump]);
  const restoreMs=Math.round(performance.now()-start);
  assert.deepEqual(await fingerprint(destination),before);
  assert.deepEqual(await fingerprint('postqa06_fixture'),before);
  const result={fixture_only:true,production_backup:false,destination,retained:true,tables:before.rows.length,bytes:bytes.length,sha256:sha(bytes),restore_ms:restoreMs,rows_match:true,functions_match:true,policies_match:true,constraints_match:true,supabase_auth_login_tested:false};
  await writeFile(path.join(directory,'database-result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
});

test('separate synthetic object backup detects corruption and preserves bytes on restore',async()=>{
  await mkdir(path.join(directory,'objects'),{recursive:true});
  await mkdir(path.join(directory,'restored-objects'),{recursive:true});
  const data=Buffer.from('CODEX-UJI-20261016 synthetic private archive, no student data');
  const source=path.join(directory,'objects','fixture.txt');
  const target=path.join(directory,'restored-objects','fixture.txt');
  await writeFile(source,data);await copyFile(source,target);
  const expected=sha(data);
  assert.equal(sha(await readFile(target)),expected);
  await writeFile(target,Buffer.from('corrupted fixture'));
  assert.notEqual(sha(await readFile(target)),expected);
  await copyFile(source,target);assert.equal(sha(await readFile(target)),expected);
  await writeFile(path.join(directory,'object-result.json'),JSON.stringify({fixture_only:true,bytes:data.length,sha256:expected,tamper_detected:true,restored:true,supabase_storage_api_tested:false},null,2));
});
