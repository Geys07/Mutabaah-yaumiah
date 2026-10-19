import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const exec=promisify(execFile);
const conn='host=127.0.0.1 port=55436 user=qa06 dbname=qa06_fixture connect_timeout=5';
async function sql(s){return (await exec('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-qAt','-v','ON_ERROR_STOP=1','-d',conn,'-c',s],{windowsHide:true})).stdout.trim();}
test('local readonly burst: 32 report requests, concurrency four, no real users',async()=>{
 assert.equal(await sql("select current_database()||':'||current_setting('port')"),'qa06_fixture:55436');
 const classId=await sql("select id from classes where name like 'CODEX-SCORE-%' limit 1");assert.match(classId,/^[0-9a-f-]{36}$/);
 const timings=[];let cursor=0;
 const worker=async()=>{while(cursor<32){cursor++;const start=performance.now();const result=await sql("set statement_timeout='5s';set role authenticated;set request.jwt.claim.sub='10000000-0000-4000-8000-000000000005';select get_mutabaah_semester_report('"+classId+"','70000000-0000-4000-8000-000000000001')");assert.equal(JSON.parse(result).length,4);timings.push(performance.now()-start);}};
 await Promise.all(Array.from({length:4},worker));timings.sort((a,b)=>a-b);
 const result={fixture_only:true,requests:32,concurrency:4,failed:0,p50_ms:Math.round(timings[15]),p95_ms:Math.round(timings[30]),includes_psql_process_startup:true,production_load_test:false};
 await writeFile(path.join(os.tmpdir(),'CODEX-QA06-20261018','load-result.json'),JSON.stringify(result,null,2));
});
