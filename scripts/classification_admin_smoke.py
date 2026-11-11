"""Synthetic local admin workflow; mock classification transport, never real model calls."""
import sys,secrets,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import make_server,create_user
with tempfile.TemporaryDirectory() as tmp:
 server=make_server(Path(tmp)/'taxonomy.sqlite3',port=0,secure=False);url=f'http://127.0.0.1:{server.server_port}';server.public_origin=url
 password=secrets.token_urlsafe(24);create_user(server.db_path,'synthetic-admin',password,'admin');threading.Thread(target=server.serve_forever,daemon=True).start()
 try:
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
   page.goto(url);page.locator('[name=username]').fill('synthetic-admin');page.locator('[name=password]').fill(password);page.locator('#loginForm button').click();page.wait_for_selector('#syncStatus')
   page.evaluate(r'''async()=>{
    const make=(i)=>{const title=i===23?'合成罕见协调专岗':'家电维修技工 '+i,raw='岗位：'+title+'\n性别：男\n工资：HKD18000\n工作内容：'+(i===23?'另议':'设备检修');const o={...ZYOrderParser.analyze(raw,'ZY-26-1110-'+String(i+1).padStart(2,'0'),{explicitBoundary:true}).order,id:'tax-'+i,title,price:'3.8w',createdAt:new Date().toISOString(),status:'ready'};return {...o,...ZYOrderParser.humanReviewMetadata(o,'synthetic-admin')}};
    orders=Array.from({length:24},(_,i)=>make(i));const r=await api('/api/orders',{method:'PUT',body:{orders,revision}});revision=r.revision;
    await dbWrite('put',{id:'tax-worker',name:'合成维修工',age:'26',gender:'男',certificates:'电工证',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),workHistory:[{position:'维修工',duties:'',employer:'某家电维修公司',period:'2021-至今'}]});
    go('match');
   }''');page.wait_for_selector('#match-workspace')
   page.locator('.classification-manager-button').click();page.wait_for_selector('.classification-table');assert page.locator('#job-backfill-start').is_disabled()
   assert '尚未部署' in page.locator('#modal').inner_text();page.evaluate("$('#modal').close()")
   page.evaluate(r'''()=>{
    window.nativeTaxAPI=api;window.taxMock={subcategories:ZYJobCategories.subcategories.map(s=>({...s})),cache:[],remaining:50};window.taxCalls=0;window.taxFailOnce=true;
    api=async(path,options={})=>{
     if(path==='/api/job-taxonomy')return JSON.parse(JSON.stringify(taxMock));
     if(path==='/api/job-classification-batch'){
      taxCalls++;if(taxCalls===2&&taxFailOnce){taxFailOnce=false;throw Error('合成额度中断')}
      const items=[];for(const [index,x] of options.body.items.entries()){const hash=await ZYClassification.textHash(x.kind,x.input),c=x.kind==='history'?ZYClassification.classify(x.input.position,x.input.duties,x.input.employer,'history'):ZYClassification.classify(x.input.title||x.input.text,x.input.workContent),row={...c,text_hash:hash,kind:x.kind,by:'ai',evidence:x.input.title||x.input.position||x.input.text};taxMock.cache.push(row);items.push({index,result:row})}taxMock.remaining--;return {items,taxonomy:taxMock};
     }
     if(path==='/api/job-profile-backfill'){
      const r=await nativeTaxAPI('/api/orders');if(r.revision!==options.body.revision)throw Error('revision');const patch=new Map(options.body.orders.map(x=>[x.id,x.profile]));if(patch.size)await nativeTaxAPI('/api/orders',{method:'PUT',body:{orders:r.orders.map(o=>patch.has(o.id)?{...o,matchProfile:patch.get(o.id)}:o),revision:r.revision}});
      const w=(await nativeTaxAPI('/api/workers')).workers;for(const x of options.body.workers)await nativeTaxAPI('/api/workers',{method:'PUT',body:{worker:{...w.find(y=>y.id===x.id),matchProfile:x.profile}}});return {ok:true};
     }
     if(path==='/api/job-classification-admin'){
      const {operation,data}=options.body;if(operation==='update')Object.assign(taxMock.subcategories.find(s=>s.id===data.id),data);if(operation==='assign'){taxMock.cache=taxMock.cache.filter(c=>c.text_hash!==data.text_hash);const s=taxMock.subcategories.find(s=>s.id===data.subcategory_id);taxMock.cache.push({...data,major:s.major,by:'user'})}return taxMock;
     }
     return nativeTaxAPI(path,options);
    };
   }''')
   page.locator('.classification-manager-button').click();page.wait_for_function("()=>document.querySelector('#modal').open&&!document.querySelector('#job-backfill-start').disabled")
   before=page.evaluate("orders.map(({matchProfile,...business})=>business)")
   page.evaluate('backfillClassifications()');assert page.evaluate('taxCalls')==2 and page.evaluate('taxMock.cache.length')==20
   assert '20' in page.locator('#job-backfill-progress').inner_text()
   page.evaluate('backfillClassifications()');assert page.evaluate('taxCalls')==3
   backend=page.evaluate("api('/api/orders').then(r=>r.orders)");assert all(o.get('matchProfile',{}).get('version')==2 for o in backend)
   assert [{k:v for k,v in o.items() if k!='matchProfile'} for o in backend]==before
   # Repeat uses the shared cache, so no extra model batch.
   page.evaluate('backfillClassifications()');assert page.evaluate('taxCalls')==3
   assert page.locator('#job-assign-0').count()==1
   page.locator('#job-assign-0').select_option('seed:electrician');page.evaluate('assignJobClassification(0)')
   assert page.evaluate("taxMock.cache.some(c=>c.by==='user'&&c.subcategory_id==='seed:electrician')")
   assert page.locator('#job-assign-0').count()==0
   row=page.locator('[data-subcategory="seed:appliance"]');row.locator('[data-name]').fill('合成家电维修细类');row.locator('button').first.click();page.wait_for_timeout(100)
   assert page.evaluate("taxMock.subcategories.find(s=>s.id==='seed:appliance').name")=='合成家电维修细类'
   page.locator('#modal [data-language-toggle]').click();assert 'Classification' in page.locator('#modal h2').inner_text();page.locator('#modal [data-language-toggle]').click()
   page.set_viewport_size({'width':375,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.evaluate("$('#modal').close();sessionUser.role='staff';renderMatchPage()");assert page.locator('.classification-manager-button').count()==0
   assert not errors,errors;browser.close();print('PASS: admin UI, undeployed fallback, 20-item dedup/backfill resume, metadata-only saves, dictionary edit, language/375px and staff control hiding; synthetic mocked AI only')
 finally:server.shutdown();server.server_close()
