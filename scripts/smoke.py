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
            staff.locator('#o-gender').select_option('男女不限');staff.evaluate('saveOrder()');staff.wait_for_selector('.card')
            admin.evaluate('syncShared()');admin.wait_for_selector('.card');assert '共享厨师' in admin.locator('.card').inner_text()
            # Two editors started from the same revision: second save must not overwrite.
            for page in [admin,staff]:page.evaluate('editOrder(orders[0].id)')
            staff.locator('#o-title').fill('同事已修订');staff.evaluate('saveOrder()');staff.wait_for_selector('.card')
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
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth')
            admin.set_viewport_size({'width':1440,'height':1000})
            admin.evaluate("editing=null;mode='single';go('new');converter=x=>x")
            admin.locator('#raw').fill('【更新】XR80080香港某公司招聘：\n招聘岗位：铲车/叉车起重车驾驶员（货仓）：8名\n薪金待遇：HKD17118（底15500+1618津贴）\n工作时间：每天9小时\n基本要求：男女不限，30~48岁\n备注：铲车津贴（HKD500）需考证；雇主提供宿舍扣租金2500/月\n费用：23800全包\nDJ: 90000\n80000')
            admin.evaluate('autoParse()')
            assert admin.locator('#o-title').input_value()=='铲车/叉车起重车驾驶员（货仓）'
            assert admin.locator('#o-employer').input_value()=='香港某公司'
            assert admin.locator('#o-salary').input_value()=='HKD17118（底15500+1618津贴）'
            assert 'XR80080' not in admin.locator('#raw').input_value()
            notes=admin.locator('#o-notes').input_value()
            assert not any(token in notes for token in ['23800','全包','HKD500','2500'])
            admin.locator('#o-price').fill('3.7w')
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card')
            company=admin.evaluate('publish(orders[0])')
            assert 'HKD17118（底15500+1618津贴）' in company
            assert '卓亚全包价：3.7w' in company
            assert not any(token in company for token in ['23800','HKD500','2500'])
            assert admin.evaluate("orders[0].raw.includes('23800全包')")
            assert 'XR80080' not in admin.evaluate('orders[0].raw')
            assert admin.evaluate('orders[0].title')=='铲车/叉车起重车驾驶员（货仓）'
            admin.evaluate("editing=null;mode='batch';go('new')")
            admin.locator('#batchraw').fill('AT-1234\n招聘岗位：厨师：2名\n月薪：HKD 18,000\nAT-5678\n招聘岗位：司机：3名\n月薪：HKD 17,000')
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
            admin.evaluate('saveBatch()');admin.wait_for_selector('.card')
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
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth')
            admin.locator('header [data-language-toggle]').click()
            fixed=admin.evaluate("orders.find(o=>o.id==='legacy-kitchen')")
            assert fixed['code'].startswith('ZY-26-1103-')
            assert fixed['gender']=='男' and fixed['salary']=='16310/月'
            assert fixed['raw']=='【岗位】西餐帮厨\n【性别要求】男\n【工资薪酬】16310/月'
            remote=staff.evaluate("api('/api/orders').then(x=>x.orders.find(o=>o.id==='legacy-kitchen'))")
            assert remote['code']==fixed['code'] and remote['gender']=='男' and remote['salary']=='16310/月'
            staff.evaluate('logout()');staff.wait_for_selector('#loginForm')
            assert staff.evaluate("fetch('/api/orders').then(r=>r.status)")==401
            assert not errors,errors
            browser.close()
            print('PASS: independent accounts share orders/workers, reload persistence, edit conflict protection, raw preservation, permissions, logout, white mobile layout, source-ID removal, labelled single/batch job parsing, persisted legacy code/gender/salary repair, three-value gender selects and required confirmation, upstream quote confidentiality and exact salary autofill, full batch field parity, UI-only English/Chinese without form loss; no browser errors')
    finally:
        server.shutdown();server.server_close()
