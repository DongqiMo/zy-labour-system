"""Real two-browser sharing test; temporary database/accounts, no public deployment."""
from pathlib import Path
import sys
import tempfile
import threading
import secrets
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import make_server,create_user
from playwright.sync_api import sync_playwright

with tempfile.TemporaryDirectory() as tmp:
    path=Path(tmp)/'test.sqlite3';server=make_server(path,port=0,secure=False)
    url='http://127.0.0.1:'+str(server.server_address[1]);server.public_origin=url
    password=secrets.token_urlsafe(24);create_user(path,'owner',password,'admin')
    create_user(path,'colleague',password,'staff')
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            contexts=[browser.new_context(viewport={'width':1440,'height':1000},color_scheme='dark') for _ in range(2)]
            admin,staff=[c.new_page() for c in contexts];errors=[]
            for page,username in [(admin,'owner'),(staff,'colleague')]:
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(url);page.wait_for_selector('#loginForm')
                page.locator('[name=username]').fill(username);page.locator('[name=password]').fill(password)
                page.locator('#login-language [data-language-toggle]').click()
                assert page.locator('[name=username]').input_value()==username
                assert page.locator('[name=password]').input_value()==password
                assert page.locator('#loginForm button').inner_text()=='Sign In'
                page.locator('#login-language [data-language-toggle]').click()
                page.locator('#loginForm button').click();page.wait_for_selector('#syncStatus')
                assert page.locator('.card').count()==0,'Shared mode must not create seed orders'
                for selector in ['html','body','main','#content']:
                    assert page.locator(selector).evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)'
            staff.evaluate("go('new')")
            staff.locator('#raw').fill('【职位】共享厨师\n【月薪】HKD 18,799\n【工作时间】每天9小时\nDJ: 90000\n80000')
            staff.evaluate("const x=parse(document.querySelector('#raw').value);for(const k of Object.keys(orderFields))document.querySelector('#o-'+k).value=x[k]||''")
            assert staff.locator('#o-title').input_value()=='共享厨师'
            assert staff.locator('#o-salary').input_value()=='HKD 18,799'
            assert staff.evaluate("suggestion('HKD 18,799')")=='3.8w'
            assert staff.locator('#o-gender').evaluate('(e)=>e.tagName')=='SELECT'
            assert staff.locator('#o-gender option').all_text_contents()==['请选择招聘性别','男','女','男女不限']
            staff.locator('#o-price').fill('3.8w');staff.evaluate('saveOrder()')
            assert '请选择招聘性别' in staff.locator('.toast').inner_text()
            assert staff.evaluate('orders.length')==0
            staff.locator('#o-gender').select_option('男女不限');staff.evaluate('saveOrder()');staff.wait_for_selector('.card',state='attached')
            admin.evaluate('syncShared()');admin.wait_for_selector('.card',state='attached');assert '共享厨师' in admin.locator('.card').inner_text()
            # Two editors started from the same revision: second save must not overwrite.
            for page in [admin,staff]:page.evaluate('editOrder(orders[0].id)')
            staff.locator('#o-title').fill('同事已修订');staff.evaluate('saveOrder()');staff.wait_for_selector('.card',state='attached')
            admin.locator('#o-title').fill('过期修改');admin.evaluate('saveOrder()')
            assert admin.locator('#o-title').input_value()=='过期修改'
            assert '其他人已修改' in admin.locator('.toast').inner_text()
            assert staff.evaluate('orders[0].raw.includes("共享厨师")')
            admin.evaluate("go('orders');syncShared()")
            admin.wait_for_function("orders[0].title==='同事已修订'")
            # A poll that started on the list must not advance the version after an editor opens.
            admin.evaluate("""async()=>{const original=api;const before=revision;let release;api=async(path,opts)=>path==='/api/orders'?new Promise(resolve=>release=resolve):original(path,opts);const poll=performSync();if(!release)throw new Error('Poll did not start');editOrder(orders[0].id);release({orders:[{...orders[0],title:'unseen external edit'}],revision:before+1});await poll;api=original;if(revision!==before)throw new Error('Poll advanced editor version');go('orders')}""")
            # Worker created by staff is visible to owner, including after reload/login session restore.
            staff.evaluate("worker={};go('workers')");staff.locator('#w-name').fill('共享劳工');staff.locator('#w-desiredJob1').fill('厨师')
            staff.evaluate('saveWorker()');staff.wait_for_selector('.workerrow')
            admin.evaluate("go('workerRecords')");admin.wait_for_selector('.workerrow');assert '共享劳工' in admin.locator('.workerrow').inner_text()
            admin.reload();admin.wait_for_selector('#syncStatus');admin.evaluate("go('workerRecords')");admin.wait_for_selector('.workerrow')
            admin.evaluate('previewWorker(workers[0])');assert admin.locator('dialog[open]').count()==1
            admin.evaluate("document.querySelector('#modal').close()")
            # Every operation page translates, while entered business values remain untouched.
            admin.locator('header [data-language-toggle]').click()
            for target,heading in [('dashboard','Today’s Orders'),('orders','Order Database'),('workers','Worker Registration'),('workerRecords','Registered Workers')]:
                admin.evaluate('(target)=>go(target)',target)
                admin.wait_for_function('(heading)=>document.querySelector("h1")?.textContent===heading',arg=heading)
                untranslated=admin.evaluate("""()=>{const found=[];const w=document.createTreeWalker(document.querySelector('#content'),NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!n.parentElement.closest('[data-user-content],pre,textarea,input,script,style')&&/[\u3400-\u9fff]/.test(n.nodeValue))found.push(n.nodeValue.trim())}return found}""")
                assert not untranslated,(target,untranslated)
            admin.evaluate("worker={};go('workers')")
            admin.locator('#w-name').fill('未保存姓名：工作要求');admin.locator('#w-phone').fill('12345678')
            admin.locator('header [data-language-toggle]').click()
            assert admin.locator('#w-name').input_value()=='未保存姓名：工作要求'
            admin.locator('header [data-language-toggle]').click()
            assert admin.locator('#w-name').input_value()=='未保存姓名：工作要求'
            admin.locator('header [data-language-toggle]').click()
            # Account management UI and staff restrictions.
            admin.evaluate('accountDialog()');admin.wait_for_selector('#userForm')
            assert 'colleague' in admin.locator('#teamUsers').inner_text()
            admin.locator('#passwordForm [name=current]').fill('unsaved-test-value')
            admin.locator('#modal [data-language-toggle]').click()
            assert admin.locator('#modal h2').inner_text()=='Account Settings'
            assert admin.locator('#passwordForm [name=current]').input_value()=='unsaved-test-value'
            assert admin.locator('#userForm select').input_value()=='staff'
            admin.locator('#modal [data-language-toggle]').click()
            assert admin.locator('#passwordForm [name=current]').input_value()=='unsaved-test-value'
            admin.evaluate("document.querySelector('#modal').close()")
            staff.evaluate('accountDialog()');assert staff.locator('#userForm').count()==0
            staff.evaluate("document.querySelector('#modal').close()")
            admin.set_viewport_size({'width':390,'height':844})
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth'),admin.evaluate("Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.id,Math.round(e.getBoundingClientRect().width)]).slice(0,15)")
            admin.set_viewport_size({'width':1440,'height':1000})
            admin.evaluate("editing=null;mode='single';go('new');converter=x=>x")
            admin.locator('#raw').fill('【更新】XR80080香港某公司招聘：\n招聘岗位：铲车/叉车起重车驾驶员（货仓）：8名\n薪金待遇：HKD17118（底15500+1618津贴）\n工作时间：每天9小时\n基本要求：男女不限，30~48岁\n备注：铲车津贴（HKD500）需考证；雇主提供宿舍扣租金2500/月\n费用：23800全包\nDJ: 90000\n80000')
            admin.evaluate('autoParse()')
            assert admin.locator('#o-title').input_value()=='铲车/叉车起重车驾驶员（货仓）'
            assert admin.locator('#o-employer').input_value()=='香港某公司'
            assert admin.locator('#o-salary').input_value().startswith('HKD17118；')
            assert 'XR80080' not in admin.locator('#raw').input_value()
            notes=admin.locator('#o-notes').input_value()
            assert not any(token in notes for token in ['23800','全包'])
            assert 'HKD500' in admin.locator('#o-salary').input_value()
            assert '底15500+1618津贴' in admin.locator('#o-salary').input_value();assert '2500' in notes
            assert admin.locator('#o-code').input_value().endswith(' XR')
            assert admin.locator('.recognition-review').count()==1
            admin.locator('.recognition-review > summary').click()
            assert 'HKD17118' in admin.locator('.source-table').first.inner_text()
            admin.locator('#o-price').fill('3.7w')
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card',state='attached')
            company=admin.evaluate('publish(orders[0])')
            assert '工资待遇：HKD17118' in company
            assert '底15500+1618津贴' in company
            assert '卓亚全包价：3.7w' in company
            assert not any(token in company for token in ['23800'])
            assert admin.evaluate("orders[0].raw.includes('23800全包')")
            assert 'XR80080' not in admin.evaluate('orders[0].raw')
            assert admin.evaluate('orders[0].title')=='铲车/叉车起重车驾驶员（货仓）'
            admin.evaluate("editing=null;mode='batch';go('new')")
            admin.locator('#batchraw').fill('AT-1234\n招聘岗位：厨师：2名\n月薪：HKD 18,000\n---\nAT-5678\n招聘岗位：司机：3名\n月薪：HKD 17,000')
            admin.evaluate('previewBatch()');assert admin.evaluate('batch.length')==2
            assert admin.evaluate('batch.map(o=>o.title)')==['厨师','司机']
            assert admin.evaluate("batch.every(o=>!o.raw.includes('AT-'))")
            admin.evaluate('saveBatch()');assert '请选择' in admin.locator('.toast').inner_text() or '选择招聘性别' in admin.locator('.toast').inner_text()
            assert admin.locator('#batch-fields input,#batch-fields textarea,#batch-fields select').count()==admin.evaluate('Object.keys(orderFields).length')
            assert admin.locator('#batch-fields [id]').evaluate_all('(elements)=>elements.map(e=>e.id.slice(4)).sort()')==admin.evaluate('Object.keys(orderFields).sort()')
            admin.locator('#b-0-gender').select_option('女')
            admin.locator('#b-0-requirements').fill('批量备注：工作要求')
            admin.locator('#b-0-language').fill('粤语、英语')
            admin.locator('#b-0-interview').fill('现场面试')
            admin.locator('#b-0-rest').fill('每月4天')
            admin.locator('#b-0-price').fill('3.9w')
            admin.locator('#b-0-salary').fill('HKD 20,000')
            assert admin.locator('#b-0-price').input_value()=='3.9w'
            admin.locator('#b-0-price').fill('')
            before=admin.evaluate('JSON.stringify(batch)')
            source=admin.locator('#batch-item-raw').input_value()
            admin.locator('header [data-language-toggle]').click()
            assert admin.locator('h1').inner_text()=='Prepare New Order'
            assert admin.locator('#b-0-requirements').input_value()=='批量备注：工作要求'
            assert admin.locator('#batch-item-raw').input_value()==source
            assert admin.evaluate('JSON.stringify(batch)')==before
            assert admin.locator('#b-0-gender').input_value()=='女'
            assert admin.locator('#b-0-gender option').all_text_contents()==['Select recruitment gender','男','女','男女不限']
            # Both columns use the same layout as single entry.
            assert admin.locator('#batch-source').bounding_box()['x']<admin.locator('#batch-review').bounding_box()['x']
            admin.evaluate('selectBatchItem(1)')
            admin.locator('#b-1-gender').select_option('男');admin.locator('#b-1-price').fill('4.6w')
            admin.evaluate('selectBatchItem(0)')
            assert admin.locator('#b-0-requirements').input_value()=='批量备注：工作要求'
            assert admin.locator('#b-0-language').input_value()=='粤语、英语'
            admin.locator('header [data-language-toggle]').click()
            admin.evaluate('saveBatch()');admin.wait_for_selector('.card',state='attached')
            assert admin.evaluate("orders.slice(0,2).map(o=>o.gender)")==['女','男']
            assert admin.evaluate('orders.slice(0,2).map(o=>o.status)')==['draft','ready']
            assert admin.evaluate('orders[0].requirements')=='批量备注：工作要求'
            assert admin.evaluate('orders[0].interview')=='现场面试'
            assert admin.evaluate('orders[1].price')=='4.6w'
            assert admin.evaluate("orders.every(o=>['男','女','男女不限'].includes(o.gender))")
            # Reload repairs only known legacy parser artifacts and V-date codes, preserving raw.
            admin.evaluate("""async()=>{const old={...orders[0],id:'legacy-kitchen',code:'V-11.3-01',title:'西餐帮厨',gender:'要求】 男',salary:'薪酬】 16310/月',createdAt:'2026-11-03T08:00:00Z',raw:'【岗位】西餐帮厨\\n【性别要求】男\\n【工资薪酬】16310/月'};const result=await api('/api/orders',{method:'PUT',body:{orders:[old,...orders],revision}});revision=result.revision}""")
            admin.locator('header [data-language-toggle]').click()
            admin.reload();admin.wait_for_selector('#syncStatus')
            assert admin.evaluate('ZYI18n.language')=='en'
            admin.set_viewport_size({'width':390,'height':844})
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth'),admin.evaluate("Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.id,Math.round(e.getBoundingClientRect().width)]).slice(0,15)")
            admin.locator('header [data-language-toggle]').click()
            fixed=admin.evaluate("orders.find(o=>o.id==='legacy-kitchen')")
            assert fixed['code'].startswith('ZY-26-1103-')
            assert fixed['gender']=='男' and fixed['salary']=='16310/月'
            assert fixed['raw']=='【岗位】西餐帮厨\n【性别要求】男\n【工资薪酬】16310/月'
            remote=staff.evaluate("api('/api/orders').then(x=>x.orders.find(o=>o.id==='legacy-kitchen'))")
            assert remote['code']==fixed['code'] and remote['gender']=='男' and remote['salary']=='16310/月'
            # Whole-document multi-order guard, automatic segmentation and full supplier suffix.
            admin.set_viewport_size({'width':1440,'height':1000})
            multiple='侍应生 男女不限 35岁以下 粤语\n工资待遇：17500HKD 有工作餐 住宿扣2500\n工作时间：每周6天*10小时班\n总价30500元含劳务办证，保险另计\n\n粤菜厨师 男 45岁以下 粤语\n工资待遇：21000HKD 有工作餐 住宿扣2500\n工作时间：每周6天*10小时班\n要求：会海鲜类的中餐，有管理经验优先'
            admin.evaluate("editing=null;mode='single';go('new');converter=x=>x")
            admin.locator('#raw').fill(multiple);count=admin.evaluate('orders.length')
            admin.evaluate('autoParse()');assert '多份原单' in admin.locator('#recognition-feedback').inner_text()
            assert admin.locator('#o-title').input_value()==''
            admin.locator('#o-title').fill('人工输入');admin.locator('#o-code').fill('ZY-26-1103-80');admin.locator('#o-gender').select_option('男')
            admin.evaluate('saveOrder()');assert admin.evaluate('orders.length')==count
            admin.evaluate('moveSourceToBatch()');assert admin.evaluate('batch.length')==2
            assert admin.evaluate('batch.map(o=>o.title)')==['侍应生','粤菜厨师']
            assert admin.evaluate('batch.map(o=>o.salary)')==['HKD17500','HKD21000']
            # Existing company orders are re-recognised only after preview and explicit Save.
            source='需过港面试，附刀工视频\n岗位【SUPPLIER-20991234砧板师傅】\n（批文厨房帮工）\n工作要求：\n1.男性，30-40岁，有经验\n2.粤语流利\n3.工作时间：10.5小时，上6休1\n4.薪资待遇：$19000，包吃2餐，住宿扣2500\n津贴：HKD500\n31000'
            admin.evaluate("""async(raw)=>{const record={id:'recognition-preview',code:'ZY-26-1103-81',title:'（批文厨房帮工）',gender:'男',salary:'$19000，包吃2餐，住宿扣2500',price:'4.8w',status:'ready',createdAt:new Date().toISOString(),raw};const result=await api('/api/orders',{method:'PUT',body:{orders:[record,...orders],revision}});revision=result.revision;orders=[record,...orders]}""",source)
            admin.evaluate("editOrder('recognition-preview')")
            admin.evaluate('reparseExistingOrder()')
            assert admin.locator('#o-title').input_value()=='砧板师傅'
            assert admin.locator('#o-code').input_value()=='ZY-26-1103-81'
            admin.locator('#o-code').fill('ZY-26-1103-81 SUPPLIER')
            assert admin.locator('#o-gender').input_value()=='男'
            assert admin.locator('#o-rest').input_value()=='上6休1'
            assert admin.locator('#o-salary').input_value()=='HKD19000；津贴：HKD500'
            assert admin.locator('#o-price').input_value()=='4.8w'
            assert 'HKD500' in admin.locator('#o-salary').input_value()
            assert '2500' in admin.locator('#o-notes').input_value()
            unchanged=admin.evaluate("api('/api/orders').then(x=>x.orders.find(o=>o.id==='recognition-preview'))")
            assert unchanged['title']=='（批文厨房帮工）'
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card',state='attached')
            saved=admin.evaluate("api('/api/orders').then(x=>x.orders.find(o=>o.id==='recognition-preview'))")
            assert saved['code']=='ZY-26-1103-81 SUPPLIER' and saved['sourcePrefix']=='SUPPLIER'
            assert saved['title']=='砧板师傅' and saved['salary']=='HKD19000；津贴：HKD500' and saved['raw']==source
            assert isinstance(saved['parsedSnapshot'],str) and isinstance(saved['manualFields'],str)
            # Manual removal/replacement of supplier suffix survives save, reload, and re-recognition.
            admin.evaluate("editOrder(orders.find(o=>o.code==='ZY-26-1103-81 SUPPLIER').id)")
            admin.locator('#o-code').fill('ZY-26-1103-81')
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card',state='attached')
            saved=admin.evaluate("api('/api/orders').then(r=>r.orders.find(o=>o.code==='ZY-26-1103-81'))")
            assert saved and saved['sourcePrefix']=='SUPPLIER'
            assert admin.evaluate('o=>publish(o)',saved).startswith('ZY-26-1103-81｜')
            admin.evaluate("editOrder(orders.find(o=>o.code==='ZY-26-1103-81').id);reparseExistingOrder()")
            assert admin.locator('#o-code').input_value()=='ZY-26-1103-81'
            admin.locator('#o-code').fill('ZY-26-1103-81 OTHER');admin.evaluate('saveOrder()')
            admin.wait_for_selector('.card',state='attached')
            assert admin.evaluate("api('/api/orders').then(r=>r.orders.some(o=>o.code==='ZY-26-1103-81 OTHER'))")
            # Shared v8 mechanism: whole-source review, internal exclusions and explicit publication acknowledgement.
            import json
            mechanism_cases=json.loads((Path(__file__).resolve().parents[1]/'tests/fixtures/recognition-errors.json').read_text())['cases']
            office=mechanism_cases[0]['source']
            admin.evaluate("editing=null;mode='single';go('new');converter=x=>x")
            admin.locator('#raw').fill(office);admin.evaluate('autoParse()')
            assert admin.locator('#o-title').input_value()=='人力资源文员'
            assert admin.locator('#o-salary').input_value()=='HKD17770+'
            assert admin.locator('#o-gender').input_value()=='男女不限'
            assert '出报价单' in admin.locator('#o-workContent').input_value()
            admin.locator('.recognition-review > summary').click()
            assert '住扣封顶20%' in admin.locator('.source-table').first.inner_text()
            assert admin.locator('.recognition-review details').count()==1
            admin.locator('#o-price').fill('4.2w');admin.evaluate('saveOrder()');admin.wait_for_selector('.card',state='attached')
            released=admin.evaluate("publish(orders[0])")
            assert 'HKD17770+' in released and '出报价单' in released
            assert not any(value in released for value in ['2K','2.82','劳务费900','recognitionAudit'])
            unknown=next(case['source'] for case in mechanism_cases if case['id']=='REC-005')
            admin.evaluate("editing=null;mode='single';go('new')")
            admin.locator('#raw').fill(unknown);admin.evaluate('autoParse()');admin.locator('#o-price').fill('4w')
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card',state='attached')
            pending=admin.evaluate('orders[0].id')
            assert admin.evaluate("ZYOrderParser.validateCompany(orders[0],true).includes('请先核对未分类或冲突内容并确认')")
            admin.evaluate('editOrder(orders[0].id)')
            admin.locator('#o-notes').fill('附加条件已核实')
            admin.locator('.recognition-review > summary').click()
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card',state='attached')
            reviewed=admin.evaluate("id=>api('/api/orders').then(result=>result.orders.find(o=>o.id===id))",pending)
            assert reviewed['raw']==unknown and reviewed['parserVersion']=='13'
            assert isinstance(reviewed['recognitionAudit'],str) and reviewed['reviewConfirmation'] and reviewed['humanReviewedSource']
            assert '这份原单需要重新核对，暂不能生成发布稿' not in admin.locator('.card').first.inner_text()
            assert admin.evaluate('o=>publish(o)',reviewed).startswith(reviewed['code'])
            assert admin.evaluate('o=>ZYOrderAudit.inspect(o).needsReview',reviewed) is False
            assert admin.evaluate('o=>ZYOrderParser.validateCompany(o,true)',reviewed)==[]
            # Historical acknowledgements survive parser upgrades; one-click review changes metadata only.
            legacy=admin.evaluate("""async(record)=>{const copy={...record,id:'legacy-reviewed-token',code:'ZY-26-1103-97',humanReviewedSource:'',humanReviewedAt:'',humanReviewedBy:'',manualFields:'[]',reviewConfirmation:ZYOrderParser.reviewSignature(record.raw).replace(/^S1-/,'8-')};const result=await api('/api/orders',{method:'PUT',body:{orders:[copy,...orders],revision}});orders=[copy,...orders];revision=result.revision;go('orders');return copy}""",reviewed)
            assert admin.evaluate('o=>ZYOrderParser.validateCompany(o,true)',legacy)==[]
            assert '这份原单需要重新核对，暂不能生成发布稿' not in admin.locator('.card').first.inner_text()
            unmarked=admin.evaluate("""async(record)=>{const copy={...record,id:'unmarked-reviewed-order',code:'ZY-26-1103-98',reviewConfirmation:''};const result=await api('/api/orders',{method:'PUT',body:{orders:[copy,...orders],revision}});orders=[copy,...orders];revision=result.revision;go('orders');return copy}""",legacy)
            assert admin.evaluate('o=>ZYOrderParser.validateCompany(o,true).length>0',unmarked)
            admin.evaluate("markOrderReviewed('unmarked-reviewed-order')")
            marked=admin.evaluate("api('/api/orders').then(result=>result.orders.find(o=>o.id==='unmarked-reviewed-order'))")
            assert marked['humanReviewedSource']
            assert all(marked[key]==unmarked[key] for key in ['raw','title','salary','gender','price'])
            assert admin.evaluate('o=>ZYOrderParser.validateCompany(o,true)',marked)==[]
            # Batch uses the same classifier, and raw changes invalidate a prior confirmation.
            admin.evaluate("editing=null;mode='batch';batch=[];go('new')")
            admin.locator('#batchraw').fill(unknown);admin.evaluate('previewBatch()')
            admin.locator('.recognition-review > summary').click();admin.locator('.review-confirm input').check()
            assert admin.evaluate('!!batch[0].reviewConfirmation')
            admin.locator('#batch-item-raw').fill('新增未知条件\n'+unknown)
            assert admin.evaluate("batch[0].reviewConfirmation==='' ")
            admin.evaluate("batch=[];editing=null;go('orders')")
            # New identities use literal source evidence in both entry modes, without title vocabulary gates.
            identity_source=next(case['source'] for case in mechanism_cases if case['id']=='REC-018')
            admin.evaluate("editing=null;mode='single';go('new')")
            admin.locator('#raw').fill(identity_source);admin.evaluate('autoParse()')
            assert admin.locator('#o-title').input_value()=='场务协调专岗'
            assert admin.locator('#o-employer').input_value()=='香港某物流公司'
            assert admin.locator('#o-salary').input_value()=='HKD21890+'
            assert admin.locator('#o-gender').input_value()=='男'
            assert admin.locator('#o-age').input_value()=='43岁以下'
            admin.evaluate("mode='batch';batch=[];newView()")
            admin.locator('#batchraw').fill(identity_source+'\n---\n布草统筹专岗HK22000+\n女，42岁以下')
            admin.evaluate('previewBatch()')
            assert admin.evaluate('batch.map(o=>o.title)')==['场务协调专岗','布草统筹专岗']
            assert admin.evaluate('batch[0].employer')=='香港某物流公司'
            assert admin.evaluate('batch[1].employer')==''
            admin.evaluate("batch=[];editing=null;go('orders')")
            # Database date groups start collapsed, toggle independently, and retain open state on rerender.
            admin.evaluate("expandedOrderDates.clear();go('orders')")
            assert admin.locator('.order-date-group').count()>0
            assert admin.locator('.order-date-group[open]').count()==0
            assert not admin.locator('.order-date-group .card').first.is_visible()
            admin.locator('.order-date-group > summary').first.click()
            assert admin.locator('.order-date-group .card').first.is_visible()
            admin.evaluate('listRender()')
            assert admin.locator('.order-date-group[open]').count()==1
            admin.locator('.order-date-group > summary').first.click()
            assert admin.locator('.order-date-group[open]').count()==0
            # Calendar date/code/status filters compose; navigation has two non-collapsible groups.
            checks=admin.evaluate("""()=>{const saved=orders;const f={...filters.orders};
              orders=[{...saved[0],id:'cal-a',code:'ZY-26-1101-01 QY',createdAt:'2026-11-01T12:00:00',title:'日历司机',status:'ready'},
                      {...saved[0],id:'cal-b',code:'ZY-26-1102-02 CV',createdAt:'2026-11-02T12:00:00',title:'日历厨师',status:'draft'}];
              filters.orders={q:'',s:'',date:''};go('orders');
              const groups=document.querySelectorAll('.nav-group').length;
              selectOrderDate('2026-11-01');const first=document.querySelectorAll('.card').length;
              const count=document.querySelector('[data-date="2026-11-01"] small').textContent;
              filters.orders.q='qY';listRender();const codeMatch=document.querySelectorAll('.card').length;
              filters.orders.s='draft';listRender();const mismatch=document.querySelectorAll('.card').length;
              filters.orders.s='';selectOrderDate('');const cleared=document.querySelectorAll('.card').length;
              const noFold=!document.querySelector('#nav details');orders=saved;filters.orders=f;go('orders');
              return {groups,first,count,codeMatch,mismatch,cleared,noFold};}""")
            assert checks==dict(groups=2,first=1,count='1',codeMatch=1,mismatch=0,cleared=1,noFold=True),checks
            admin.set_viewport_size({'width':390,'height':844});admin.evaluate("go('orders')")
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth'),admin.evaluate("Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.id,Math.round(e.getBoundingClientRect().width)]).slice(0,15)")
            admin.set_viewport_size({'width':1440,'height':1000})
            # Audit all shared orders without changing revisions, raw sources or manual values.
            original=admin.evaluate("api('/api/orders')")
            admin.evaluate('openOrderAudit()')
            assert '原单识别自查' in admin.locator('#modal').inner_text()
            assert admin.locator('#modal .recognition-review').count()==len(original['orders'])
            assert admin.evaluate("api('/api/orders')")==original
            with admin.expect_download() as download:
                admin.evaluate('downloadOrderAudit()')
            audit=json.loads(Path(download.value.path()).read_text())
            assert audit['total']==len(original['orders']) and all('sources' in record for record in audit['records'])
            assert all('shift' not in (record['candidate'] or {}) for record in audit['records'])
            admin.evaluate('openAuditedOrder(0)')
            assert admin.locator('#o-shift').count()==0
            assert admin.evaluate("api('/api/orders')")==original,'Audit preview must not write changes'
            admin.evaluate("editing=null;go('orders')")
            staff.evaluate('logout()');staff.wait_for_selector('#loginForm')
            assert staff.evaluate("fetch('/api/orders').then(r=>r.status)")==401
            assert not errors,errors
            browser.close()
            print('PASS: independent accounts share orders/workers, reload persistence, edit conflict protection, raw preservation, permissions, logout, white mobile layout, source-ID removal, labelled single/batch job parsing, persisted legacy code/gender/salary repair, three-value gender selects and required confirmation, upstream quote confidentiality and exact salary autofill, full batch field parity, UI-only English/Chinese without form loss, whole-document splitting, full supplier prefix and review-before-save; no browser errors')
    finally:
        server.shutdown();server.server_close()
