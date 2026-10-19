import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fixtureSql as sql} from './postqa06-pg.mjs';
const {ids}=JSON.parse(await readFile(path.join(os.tmpdir(),'CODEX-PASCA-QA06-20261018','implementation-fixture-manifest.json'),'utf8'));

test('local installed gates: Admin, Principal, assigned Teacher, owning/other Parent, disabled account',async()=>{
  for(const [key,role,visible,staff] of [
    ['admin','admin',true,true],['principal','principal',true,true],
    ['teacher','homeroom_teacher',true,true],['parent','parent',true,false],
    ['other','parent',false,false],['disabled','homeroom_teacher',false,false],
  ]){
    const result=JSON.parse(await sql(`set role authenticated;set request.jwt.claim.sub='${ids[key]}';select jsonb_build_object('role',has_role('${role}'),'staff',is_staff(),'child',(select exists(select 1 from students where id='${ids.child}')))`));
    assert.equal(result.role,key!=='disabled',key+' role');
    assert.equal(result.staff,staff,key+' staff');
    assert.equal(result.child,visible,key+' RLS');
  }
  // These hashes were read from the authorized cloud project in this stage.
  const hashes=JSON.parse(await sql("select jsonb_object_agg(proname,md5(prosrc)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('has_role','is_staff','qa06_account_active')"));
  assert.deepEqual(hashes,{has_role:'2bb8b11609d8253fe36745c43f54075b',is_staff:'5995e709b4de46a5e1a41ac9b084a866',qa06_account_active:'05213ca642e3d895e04224dc6f186587'});
});
