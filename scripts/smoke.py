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
            staff.locator('#o-price').fill('3.8w');staff.evaluate('saveOrder()');staff.wait_for_selector('.card')
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
            # Account management UI and staff restrictions.
            admin.evaluate('accountDialog()');admin.wait_for_selector('#userForm')
            assert 'colleague' in admin.locator('#teamUsers').inner_text()
            admin.evaluate("document.querySelector('#modal').close()")
            staff.evaluate('accountDialog()');assert staff.locator('#userForm').count()==0
            staff.evaluate("document.querySelector('#modal').close()")
            admin.set_viewport_size({'width':390,'height':844})
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth')
            admin.set_viewport_size({'width':1440,'height':1000})
            admin.evaluate("editing=null;mode='single';go('new');converter=x=>x")
            admin.locator('#raw').fill('【更新】XR80080香港某公司招聘：\n招聘岗位：铲车/叉车起重车驾驶员（货仓）：8名\n薪金待遇：HKD17118（底15500+1618津贴）\n工作时间：每天9小时\n基本要求：男女不限，30~48岁\nDJ: 90000\n80000')
            admin.evaluate('autoParse()')
            assert admin.locator('#o-title').input_value()=='铲车/叉车起重车驾驶员（货仓）'
            assert admin.locator('#o-employer').input_value()=='香港某公司'
            assert admin.locator('#o-salary').input_value()=='HKD17118（底15500+1618津贴）'
            assert 'XR80080' not in admin.locator('#raw').input_value()
            admin.evaluate('saveOrder()');admin.wait_for_selector('.card')
            assert 'XR80080' not in admin.evaluate('orders[0].raw')
            assert admin.evaluate('orders[0].title')=='铲车/叉车起重车驾驶员（货仓）'
            admin.evaluate("editing=null;mode='batch';go('new')")
            admin.locator('#batchraw').fill('AT-1234\n招聘岗位：厨师：2名\n月薪：HKD 18,000\nAT-5678\n招聘岗位：司机：3名\n月薪：HKD 17,000')
            admin.evaluate('previewBatch()');assert admin.evaluate('batch.length')==2
            assert admin.evaluate('batch.map(o=>o.title)')==['厨师','司机']
            assert admin.evaluate("batch.every(o=>!o.raw.includes('AT-'))")
            staff.evaluate('logout()');staff.wait_for_selector('#loginForm')
            assert staff.evaluate("fetch('/api/orders').then(r=>r.status)")==401
            assert not errors,errors
            browser.close()
            print('PASS: independent accounts share orders/workers, reload persistence, edit conflict protection, raw preservation, permissions, logout, white mobile layout, source-ID removal and labelled single/batch job parsing; no browser errors')
    finally:
        server.shutdown();server.server_close()
