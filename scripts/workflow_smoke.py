"""Batch-one UI acceptance against a temporary database and synthetic records only."""
import json
import secrets
import sys
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, Error as BrowserError
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.app import make_server, create_user

with tempfile.TemporaryDirectory() as tmp:
    server = make_server(Path(tmp)/'workflow.sqlite3', port=0, secure=False)
    url = 'http://127.0.0.1:'+str(server.server_address[1])
    server.public_origin = url
    password = secrets.token_urlsafe(24)
    create_user(server.db_path, 'reviewer', password, 'admin')
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            page = browser.new_page(viewport={'width':1440, 'height':1000})
            errors, dialogs = [], []
            choice = {'accept':True}
            def handle_dialog(dialog):
                dialogs.append((dialog.type, dialog.message))
                dialog.accept() if choice['accept'] else dialog.dismiss()
            page.on('dialog', handle_dialog)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url)
            page.locator('[name=username]').fill('reviewer')
            page.locator('[name=password]').fill(password)
            page.locator('#loginForm button').click()
            page.wait_for_selector('#syncStatus')
            review_source = next(item['source'] for item in json.loads(Path('tests/fixtures/recognition-errors.json').read_text())['cases'] if item['id']=='REC-005')
            page.evaluate('''async reviewRaw => {
                const raw='岗位：资料协调专岗\\n雇主：香港某服务机构\\n性别：女\\n工资：HK22000\\n年龄：40岁以下\\n工作时间：每天8小时\\n工作内容：整理资料';
                const make=(id,raw,n)=>({...ZYOrderParser.analyze(raw,'ZY-26-1109-'+n,{explicitBoundary:true}).order,id,createdAt:new Date().toISOString(),price:'4.2w',status:'ready'});
                const draft=make('flow-draft',raw,'01');draft.price='';
                const review=make('flow-review',reviewRaw+'\\n上家全包34000','02');
                const ready=make('flow-ready',raw,'03');Object.assign(ready,ZYOrderParser.humanReviewMetadata(ready,'reviewer'));
                const legacy=make('flow-legacy',reviewRaw,'04');legacy.reviewConfirmation=ZYOrderParser.reviewSignature(legacy.raw).replace(/^S1-/,'8-');
                const saved=await api('/api/orders',{method:'PUT',body:{orders:[draft,review,ready,legacy],revision}});orders=[draft,review,ready,legacy];revision=saved.revision;go('dashboard');
            }''', review_source)
            assert page.evaluate('orders.map(orderState)') == ['draft','review','ready','ready']
            assert page.locator('.stats .stat').count() == 4
            assert page.evaluate("[...document.querySelectorAll('.stats strong')].map(e=>parseInt(e.textContent))") == [4,1,1,2]
            for state,count in [('draft',1),('review',1),('ready',2)]:
                page.locator('.toolbar select').select_option(state)
                assert page.locator('.order-card').count() == count
                assert all(text == {'draft':'待确认金额','review':'需核对','ready':'可发布'}[state] for text in page.locator('.price>.badge').all_inner_texts())
                assert page.locator('button[onclick^="copyOrder"]').count() == (count if state=='ready' else 0)
            page.locator('.toolbar select').select_option('')
            assert page.locator('[data-order-id="flow-review"] .publication-problems li').count() > 0
            assert page.locator('[data-order-id="flow-legacy"] .reviewed-stamp').inner_text() == '已人工核对'
            # Content-keyed validation cache invalidates on an in-place field change.
            page.evaluate('''() => {window.nativeValidate=ZYOrderParser.validateCompany;window.validations=0;ZYOrderParser.validateCompany=(...args)=>{validations++;return nativeValidate(...args)};window.cachedOrder={...orders.find(o=>o.id==='flow-ready'),id:'cache-only'};orderState(cachedOrder);orderState(cachedOrder)}''')
            assert page.evaluate('validations') == 1
            page.evaluate("cachedOrder.gender='';orderState(cachedOrder)")
            assert page.evaluate('validations') == 2
            page.evaluate('() => {ZYOrderParser.validateCompany=nativeValidate}')
            # No-extra-items case and English UI protect source/reviewer business values.
            page.evaluate("markOrderReviewed('flow-ready')")
            assert '未发现额外核对项目，仍请确认识别结果。' in page.locator('#modal').inner_text()
            page.evaluate("document.querySelector('[data-language-toggle]').click()")
            page.wait_for_function("() => document.querySelector('#modal h2').textContent==='Confirm Human Review'")
            assert page.locator('#modal [data-user-content]').first.inner_text().startswith('ZY-26-1109-03')
            assert 'reviewer' in page.locator('[data-order-id="flow-ready"] .reviewed-stamp [data-user-content]').first.inner_text()
            page.evaluate("document.querySelector('#modal').close();document.querySelector('[data-language-toggle]').click()")
            before = page.evaluate("api('/api/orders')")
            page.evaluate("copyOrder('flow-review')")
            assert page.locator('.toast').inner_text() == '请先核对未分类或冲突内容并确认'
            page.evaluate("markOrderReviewed('flow-review')")
            assert page.locator('#modal').is_visible()
            assert '未分类内容' in page.locator('#modal').inner_text()
            assert '上家全包34000' in page.locator('#modal').inner_text()
            assert page.evaluate("api('/api/orders')") == before
            page.locator('#modal button').filter(has_text='取消').click()
            assert page.evaluate("api('/api/orders')") == before
            page.evaluate("markOrderReviewed('flow-review')")
            page.locator('#confirm-order-review').click()
            page.wait_for_function("() => !document.querySelector('#modal').open")
            after = page.evaluate("api('/api/orders')")
            reviewed = next(o for o in after['orders'] if o['id']=='flow-review')
            prior = next(o for o in before['orders'] if o['id']=='flow-review')
            assert all(reviewed[key]==prior[key] for key in ['raw','title','salary','gender','price','status'])
            assert reviewed['humanReviewedBy']=='reviewer' and reviewed['humanReviewedAt']
            assert page.evaluate("orderState(orders.find(o=>o.id==='flow-review'))")=='ready'
            assert 'reviewer' in page.locator('[data-order-id="flow-review"] .reviewed-stamp').inner_text()
            page.evaluate("orders.push({...orders[0],id:'blocked-review',raw:'岗位：资料协调专岗；工资：HK22000',price:'4.2w',gender:''});markOrderReviewed('blocked-review')")
            assert page.locator('#confirm-order-review').count() == 0
            assert '请选择招聘性别' in page.locator('#modal').inner_text()
            assert page.locator('#modal button').filter(has_text='编辑公司单').count() == 1
            page.evaluate("confirmOrderReview();document.querySelector('#modal').close();orders=orders.filter(o=>o.id!=='blocked-review')")
            assert page.evaluate("api('/api/orders')") == after
            assert page.evaluate("publish(orders.find(o=>o.id==='flow-ready')).includes('职位名称：')") is False
            assert page.evaluate("publish(orders.find(o=>o.id==='flow-ready')).startsWith('ZY-26-1109-03｜资料协调专岗')")
            # Unsaved single/edit forms: cancel keeps exact content; confirmed leave discards.
            page.evaluate("editing=null;mode='single';go('new')")
            page.locator('#o-price').evaluate("element => {element.value='8.8w'}")
            choice['accept']=False;previous=len(dialogs);page.evaluate("go('orders')")
            assert len(dialogs)==previous+1 and page.locator('#o-price').input_value()=='8.8w'
            choice['accept']=True;page.evaluate("go('orders');go('new')")
            page.locator('#raw').fill('合成未保存原单')
            page.locator('#o-title').fill('未保存职位')
            choice['accept']=False
            for action in ["go('orders')",'leaveOrderEditor()',"switchOrderMode('batch')","editOrder('flow-ready')"]:
                previous=len(dialogs);page.evaluate(action)
                assert len(dialogs)==previous+1
                assert page.evaluate('view')=='new' and page.locator('#raw').input_value()=='合成未保存原单'
                assert page.evaluate('editing') is None
            page.evaluate("document.querySelector('[data-language-toggle]').click()")
            page.evaluate("go('orders')")
            assert 'Discard unsaved changes?' in dialogs[-1][1]
            page.evaluate("document.querySelector('[data-language-toggle]').click()")
            previous=len(dialogs)
            try:
                page.reload(timeout=5000)
            except BrowserError:
                pass
            assert any(kind=='beforeunload' for kind,_ in dialogs[previous:])
            assert page.locator('#raw').input_value()=='合成未保存原单'
            choice['accept']=True;page.evaluate("go('orders')")
            page.evaluate("editOrder('flow-ready')")
            previous=len(dialogs);page.evaluate("go('orders')")
            assert len(dialogs)==previous, 'Unchanged edit must not warn'
            page.evaluate("editOrder('flow-ready')");page.locator('#o-notes').fill('合成人工备注')
            choice['accept']=False;page.evaluate('leaveOrderEditor()')
            assert page.locator('#o-notes').input_value()=='合成人工备注'
            previous=len(dialogs);page.evaluate('saveOrder()')
            page.wait_for_function("() => view==='orders'")
            assert len(dialogs)==previous, 'Successful save navigation must not warn'
            # Batch buffers survive navigation without a site confirmation.
            choice['accept']=True;page.evaluate("editing=null;mode='batch';batch=[];batchInput='';go('new');converter=x=>x")
            page.locator('#batchraw').fill('岗位：资料协调专岗\n工资HK22000\n性别：女')
            page.evaluate('previewBatch()')
            batch_before=page.evaluate('JSON.stringify(batch)');previous=len(dialogs)
            page.evaluate("go('orders');go('new')")
            assert len(dialogs)==previous and page.evaluate('JSON.stringify(batch)')==batch_before
            assert page.evaluate('ZYDrafts.batchDirty()')
            assert page.evaluate('batch.length')==1
            choice['accept']=False;previous=len(dialogs)
            try:
                page.reload(timeout=5000)
            except BrowserError:
                pass
            assert any(kind=='beforeunload' for kind,_ in dialogs[previous:])
            assert page.evaluate('JSON.stringify(batch)')==batch_before
            choice['accept']=True
            # A dirty worker survives navigation; only destructive new/edit actions warn.
            page.evaluate("batch=[];batchInput='';go('workers')")
            page.locator('#w-name').fill('合成劳工甲')
            previous=len(dialogs);page.evaluate("go('orders');go('workers')")
            assert len(dialogs)==previous and page.locator('#w-name').input_value()=='合成劳工甲'
            choice['accept']=False;previous=len(dialogs)
            try:
                page.reload(timeout=5000)
            except BrowserError:
                pass
            assert any(kind=='beforeunload' for kind,_ in dialogs[previous:])
            page.evaluate('newWorkerRegistration()')
            assert page.locator('#w-name').input_value()=='合成劳工甲'
            before_logout=page.evaluate('sessionUser.id');page.evaluate('logout()')
            assert page.evaluate('sessionUser.id')==before_logout
            choice['accept']=True;page.evaluate('newWorkerRegistration()')
            assert not page.locator('#w-name').input_value()
            previous=len(dialogs);page.evaluate("worker.sourcePdfDirty=true;addHistory('educationHistory');newWorkerRegistration()")
            assert len(dialogs)==previous, 'Blank history rows and bookkeeping alone are not dirty'
            page.locator('#w-name').fill('合成劳工乙');previous=len(dialogs);page.evaluate('saveWorker()')
            page.wait_for_function("() => view==='workerRecords'")
            assert len(dialogs)==previous
            page.evaluate('editWorker(workers[0].id)')
            assert not page.evaluate('ZYDrafts.workerDirty()')
            page.evaluate("worker._version=999;worker.createdAt='bookkeeping';worker.sourcePdfDirty=true")
            assert not page.evaluate('ZYDrafts.workerDirty()')
            page.locator('#w-name').fill('合成劳工乙修改');choice['accept']=False;page.evaluate('editWorker(workers[0].id)')
            assert page.locator('#w-name').input_value()=='合成劳工乙修改'
            # Responsive state cards and translated labels, without translating business data.
            choice['accept']=True;page.evaluate("worker={};go('dashboard')")
            for width in [1440,375]:
                page.set_viewport_size({'width':width,'height':900})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors, errors
            browser.close()
            print('PASS: batch-one states/cache/legacy review, review dialog/blockers/metadata, single-edit/batch/worker draft protection, native beforeunload, logout cancellation, no save-navigation prompt and non-duplicated publication title')
    finally:
        server.shutdown();server.server_close()
