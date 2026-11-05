import {PGlite} from '@electric-sql/pglite';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1)});
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
await db.exec(readFileSync(new URL('../supabase/migrations/202611030001_zy_shared.sql',import.meta.url),'utf8'));
const owner='10000000-0000-0000-0000-000000000001',staff='10000000-0000-0000-0000-000000000002',outsider='10000000-0000-0000-0000-000000000003';
await db.query('insert into auth.users values ($1),($2),($3)',[owner,staff,outsider]);
await db.query("insert into zy_private.members values($1,'owner@example.test','admin',true),($2,'staff@example.test','staff',true)",[owner,staff]);
async function login(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role)}
async function rpc(fn,...args){return (await db.query(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result}
async function rejects(action,pattern){await assert.rejects(action,pattern)}
await login('', 'anon');await rejects(()=>rpc('zy_orders_get'),/permission denied/);
await login(outsider);await rejects(()=>rpc('zy_orders_get'),/账号未获/);
await login(staff);await rejects(()=>db.query('select * from zy_private.members'),/permission denied/);await rejects(()=>rpc('zy_export'),/权限不足/);await rejects(()=>rpc('zy_member_add',outsider,'other@example.test','admin'),/权限不足/);
const order={firstRecognition:JSON.stringify({format:'zy-first-recognition',version:1,source:'测试原单',company:{title:'机器首版职位',salary:'HKD18799'}}),id:'shared-order',code:'ZY-26-1102-01',title:'共享厨师',salary:'HKD 18,799',raw:'【职位】共享厨师\nDJ: 90000\n80000',createdAt:'2026-11-02T15:00:00Z',price:'3.8w',status:'ready'};
assert.deepEqual(await rpc('zy_orders_save',[order],0),{revision:1});
await login(owner);assert.deepEqual((await rpc('zy_orders_get')).orders,[order]);
await rejects(()=>rpc('zy_orders_save',[],0),/其他人已修改/);
await rejects(()=>rpc('zy_orders_save',[{...order,raw:'changed'}],1),/不能更改原单/);
await rejects(()=>rpc('zy_orders_save',[order,{...order,id:'duplicate'}],1),/重复/);
const worker={id:'worker-one',name:'测试劳工',photo:'data:image/jpeg;base64,AA==',sourcePdfData:'data:application/pdf;base64,JVBERg==',sourcePdfDirty:false,createdAt:'2026-11-02T15:00:00Z',updatedAt:'2026-11-02T15:00:00Z',educationHistory:[{period:'2010-2014',school:'测试学校',major:'中文',qualification:'本科'}],workHistory:[{period:'2020-2026',employer:'测试餐厅',position:'厨师',duties:'烹饪'}]};
await login(staff);assert.deepEqual(await rpc('zy_worker_save',worker),{version:1});await rejects(()=>rpc('zy_worker_save',worker),/其他人已修改/);
await login(owner);assert.deepEqual((await rpc('zy_workers_get')).workers,[{...worker,_version:1}]);
const backup=await rpc('zy_export');assert.equal(backup.format,'zy-labour-portable');assert.deepEqual(backup.orders,[order]);assert.deepEqual(backup.workers,[worker]);assert(!('users' in backup));
// Cross-provider roundtrip: real PostgreSQL export -> SQLite -> PostgreSQL import.
const dir=mkdtempSync(join(tmpdir(),'zy-migration-'));
try{
 const input=join(dir,'input.json'),sqlite=join(dir,'target.sqlite3'),output=join(dir,'output.json');
 writeFileSync(input,JSON.stringify(backup),{mode:0o600});
 execFileSync('python3',['scripts/portable.py','import-sqlite','--db',sqlite,'--input',input]);
 execFileSync('python3',['scripts/portable.py','export-sqlite','--db',sqlite,'--output',output]);
 const portable=JSON.parse(readFileSync(output,'utf8'));
 assert.deepEqual(portable.orders,backup.orders);assert.deepEqual(portable.workers,backup.workers);
 backup.orders=portable.orders;backup.workers=portable.workers;
}finally{rmSync(dir,{recursive:true,force:true})}
await rpc('zy_maintenance_set',true);
assert.equal((await rpc('zy_maintenance_get')).readOnly,true);
await login(staff);await rejects(()=>rpc('zy_orders_save',[],1),/暂停写入/);await rejects(()=>rpc('zy_worker_save',{...worker,_version:1}),/暂停写入/);await rejects(()=>rpc('zy_maintenance_set',false),/权限不足/);
await login(owner);assert.deepEqual((await rpc('zy_export')).workers,backup.workers);await rpc('zy_maintenance_set',false);
await rejects(()=>rpc('zy_import',backup,1),/空数据库/);
await rpc('zy_orders_save',[],1);await rpc('zy_worker_delete',worker.id,1);
await rejects(()=>rpc('zy_import',{...backup,workers:[worker,worker]},2),/ID重复/);
assert.equal((await rpc('zy_orders_get')).orders.length,0);assert.equal((await rpc('zy_workers_get')).workers.length,0);
await rejects(()=>rpc('zy_import',backup,1),/已变化/);
assert.deepEqual(await rpc('zy_import',backup,2),{orders:1,workers:1,revision:3});
const restored=await rpc('zy_export');assert.deepEqual(restored.orders,backup.orders);assert.deepEqual(restored.workers,backup.workers);
await rpc('zy_member_disable',staff);await login(staff);await rejects(()=>rpc('zy_orders_get'),/账号未获/);
await login(owner);await rejects(()=>rpc('zy_member_disable',owner),/自己的账号/);
await db.close();console.log('PASS: PostgreSQL SQL, anonymous/outsider/staff/admin permissions, sharing, edit conflicts, immutable raw, snapshot export, atomic empty-target restore, PostgreSQL→SQLite→PostgreSQL images/PDF/history roundtrip, read-only migration mode, disabled membership');
