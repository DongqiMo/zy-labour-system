"""Synthetic matching acceptance: local temporary DB, no external AI, two browser timezones."""
from pathlib import Path
from datetime import datetime
import secrets,sys,tempfile,threading,json
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import make_server,create_user

worker={'id':'match-main','name':'李秀兰','gender':'女','birthDate':'1984-06-12','desiredJob1':'清洁','desiredJob2':'酒店客房','desiredJob3':'厨房帮工','cantonese':'流利','mandarin':'良好','english':'略懂','desiredSalary':'HKD14000','certificates':'健康证','phone':'13800005678','hometown':'广东江门','health':'健康良好','education':'初中','idNumber':'PRIVATE-ID-MARKER','idValidity':'PRIVATE-VALIDITY-MARKER','idAddress':'PRIVATE-ID-ADDRESS','currentAddress':'PRIVATE-CURRENT-ADDRESS','alternateContact':'PRIVATE-ALTERNATE','permit':'PRIVATE-PERMIT','workHistory':[{'period':'2019.03–2023.08','employer':'香港某酒店','position':'客房清洁员','duties':'整理客房和清洁'},{'period':'2015.06–2019.02','employer':'江门某酒楼','position':'厨房帮工','duties':'切配洗碗'},{'period':'2010.09–2015.05','employer':'江门某工厂','position':'包装工','duties':'包装装箱'}]}
jobs=[['match-hotel','酒店客房服务员','女','25-45岁','粤语','HKD17500'],['match-clean','清洁员','女','30-55岁','粤语流利、简单英语','HKD14500'],['match-kitchen','厨房帮工','男女不限','30-50岁','普通话流利','HKD15000'],['match-warehouse','仓库理货员','男女不限','20-50岁','','MOP15000'],['match-chef','点心厨师','男','50岁内','','HKD18920'],['match-office','电脑操作员','女','35岁以下','','HKD14000']]
jobs.append(['match-manual','合成稀有协调岗','男女不限','20-50岁','','HKD15000'])

with tempfile.TemporaryDirectory() as tmp:
    server=make_server(Path(tmp)/'matching.sqlite3',port=0,secure=False)
    url=f'http://127.0.0.1:{server.server_address[1]}';server.public_origin=url
    password=secrets.token_urlsafe(24);create_user(server.db_path,'match-reviewer',password,'admin')
    threading.Thread(target=server.serve_forever,daemon=True).start()
    snapshots=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for zone in ['America/Toronto','Asia/Shanghai']:
                context=browser.new_context(timezone_id=zone,viewport={'width':1440,'height':1000})
                page=context.new_page();errors=[];requests=[];choice={'accept':True};dialogs=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('request',lambda r:requests.append((r.method,r.url)))
                def dialog(d):
                    dialogs.append(d.message);d.accept() if choice['accept'] else d.dismiss()
                page.on('dialog',dialog)
                page.clock.set_fixed_time(datetime.fromisoformat('2026-11-09T12:00:00+00:00'))
                page.goto(url);page.locator('[name=username]').fill('match-reviewer');page.locator('[name=password]').fill(password);page.locator('#loginForm button').click();page.wait_for_selector('#syncStatus')
                # China birthday/month boundaries differ from the device's Toronto calendar day/month.
                page.clock.set_fixed_time(datetime.fromisoformat('2026-06-11T16:01:00+00:00'))
                boundary_age=page.evaluate('(w)=>ZYMatching.workerAge(w)',worker);assert boundary_age==42
                page.clock.set_fixed_time(datetime.fromisoformat('2026-11-30T16:01:00+00:00'))
                current_months=page.evaluate("ZYMatching.parsePeriod('2021.06-至今').months");assert current_months==66
                page.clock.set_fixed_time(datetime.fromisoformat('2026-11-09T12:00:00+00:00'))
                page.evaluate(r'''async payload=>{
                    for(const w of (await api('/api/workers')).workers)await api('/api/workers',{method:'DELETE',body:{id:w.id,version:w._version}});
                    for(const w of [payload.worker,{id:'match-sparse',name:'合成资料少',gender:'男',age:'30',phone:'13900001234'},{id:'match-excluded',name:'合成高龄',gender:'女',age:'90',workHistory:[{position:'清洁员',period:'2019-2023'}]}])await api('/api/workers',{method:'PUT',body:{worker:{...w,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}});
                    const make=(job,index)=>{const [id,title,gender,age,language,salary]=job,raw=`岗位：${title}\n性别：${gender}\n年龄：${age}\n工资：${salary}\n工作时间：每天8小时`;
                        const o={...ZYOrderParser.analyze(raw,'ZY-26-1109-'+String(index+1).padStart(2,'0'),{explicitBoundary:true}).order,id,title,gender,age,language,salary,price:'4.2w',createdAt:'2026-11-08T02:00:00Z',status:'ready'};return {...o,...ZYOrderParser.humanReviewMetadata(o,'match-reviewer')}};
                    orders=payload.jobs.map(make);orders.push({...orders[1],id:'match-old',code:'ZY-26-1020-01',createdAt:'2026-10-20T02:00:00Z'});
                    const review={...ZYOrderParser.analyze('岗位：合成专岗\n工资：HKD22000\n性别：男\n【未知条件】另议','ZY-26-1109-98',{explicitBoundary:true}).order,id:'match-review-only',price:'4.2w',createdAt:new Date().toISOString(),status:'ready'};
                    const draft={...orders[0],id:'match-draft-only',code:'ZY-26-1109-99',price:'',status:'draft'};orders.push(review,draft);
                    const saved=await api('/api/orders',{method:'PUT',body:{orders,revision}});revision=saved.revision;go('orders');
                    window.clipboardCopies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{clipboardCopies.push(text)}},configurable:true});
                }''',{'worker':worker,'jobs':jobs})
                # Sidebar entry and empty selection; searchable picker by name and suffix only.
                page.locator('#nav button[onclick^="go(\'match\'"]').click();page.wait_for_selector('#match-workspace')
                assert page.locator('.empty').count()==2
                page.locator('#match-worker-search').fill('5678');page.wait_for_timeout(250)
                assert page.locator('#match-worker-options button').count()==1
                assert '13800005678' not in page.locator('#match-workspace').inner_text()
                page.locator('#match-worker-options button').click();page.wait_for_selector('[data-match-order=match-hotel]')
                assert page.locator('[data-match-level] b').all_text_contents()==['4','2','1','0','1']
                assert page.locator('.match-entry').count()==3
                assert page.locator('.match-manual-row').count()==1
                assert page.locator('.match-manual-row .match-score').count()==0
                page.locator('[data-match-level=manual]').click();assert page.locator('.match-entry').count()==0 and page.locator('.match-manual-row').count()==1
                page.locator('[data-match-level=""]').click()
                assert not page.locator('[data-match-order=match-review-only]').count() and not page.locator('[data-match-order=match-draft-only]').count()
                assert not page.locator('.match-excluded').evaluate('(e)=>e.open')
                assert '3张' in page.locator('.match-excluded summary').inner_text()
                page.locator('.match-excluded summary').click();assert '要求男性，劳工为女性' in page.locator('.match-excluded').inner_text()
                assert '要求35岁以下，劳工42岁' in page.locator('.match-excluded').inner_text()
                # Only the copy action uses company publication, never worker fields.
                start_requests=len(requests)
                page.locator('[data-match-order=match-hotel] .match-copy').click()
                copied=page.evaluate('clipboardCopies[0]');assert copied==page.evaluate("publish(orders.find(o=>o.id==='match-hotel'))")
                for secret in [worker['name'],worker['phone'],'PRIVATE-ID-MARKER']:assert secret not in copied
                # Expanding changes highlights but never recomputes scores.
                calculations=page.evaluate('matchState.calculations')
                page.locator('[data-match-order=match-hotel] .match-order-open').click()
                assert page.locator('.match-breakdown').count()==1 and page.locator('.match-dimension').count()==1
                assert page.locator('.match-profile-actions').evaluate('(e)=>e.getBoundingClientRect().bottom<=innerHeight')
                assert page.locator('[data-intent-index="1"]').get_attribute('class').endswith('matched')
                assert page.locator('[data-history-index="0"]').get_attribute('class').endswith('matched')
                assert page.locator('[data-language-key=cantonese]').get_attribute('class').endswith('matched')
                page.locator('[data-match-order=match-kitchen] .match-order-open').click()
                assert page.locator('.match-breakdown').count()==1
                assert page.locator('[data-history-index="1"]').get_attribute('class').endswith('matched')
                page.locator('[data-match-order=match-kitchen] .match-order-open').click();assert page.locator('.match-profile .matched').count()==0
                page.locator('[data-match-level=high]').click();assert page.locator('.match-entry').count()==2
                assert page.evaluate('matchState.calculations')==calculations
                page.locator('[data-match-level=""]').click()
                # DOM excludes all restricted fields, and full phone is an explicit reveal.
                html=page.locator('#match-workspace').inner_html()
                for key in ['idNumber','idValidity','idAddress','currentAddress','alternateContact','permit']:
                    assert worker[key] not in html,key
                assert worker['phone'] not in html
                page.locator('.match-phone button').click();assert worker['phone'] in page.locator('.match-phone').inner_text()
                page.locator('.match-phone button').click();assert worker['phone'] not in page.locator('.match-phone').inner_text()
                page.locator('.match-profile-actions button').filter(has_text='预览登记表').click()
                for key in ['idNumber','idValidity','idAddress','currentAddress','alternateContact','permit']:
                    assert worker[key] not in page.locator('#modal').inner_text(),key
                assert worker['phone'] not in page.locator('#modal').inner_text()
                page.evaluate("document.querySelector('#modal').close()")
                page.locator('[data-match-days="30"]').click();assert page.locator('[data-match-level] b').first.inner_text()=='5'
                page.locator('[data-match-days="7"]').click();assert page.locator('[data-match-level] b').first.inner_text()=='4'
                page.locator('[data-match-days="14"]').click()
                assert page.locator('.match-row').evaluate_all('rows=>rows.every(e=>e.getBoundingClientRect().height===52)')
                assert all(method in ['GET','HEAD'] for method,endpoint in requests[start_requests:]),requests[start_requests:]
                # Live backend updates preserve selected worker/open order and invalidate the cache.
                page.locator('[data-match-order=match-hotel] .match-order-open').click();before=page.evaluate('matchState.calculations')
                page.evaluate("async()=>{const w=workers.find(w=>w.id==='match-main');await api('/api/workers',{method:'PUT',body:{worker:{...w,name:'合成李秀兰更新'}}});await performSync()}")
                assert page.evaluate('matchState.workerId')=='match-main' and page.evaluate('matchState.openOrderId')=='match-hotel'
                assert '合成李秀兰更新' in page.locator('.match-person h2').inner_text()
                assert page.evaluate('matchState.calculations')>before
                before=page.evaluate('matchState.calculations')
                page.evaluate("async()=>{const r=await api('/api/orders');await api('/api/orders',{method:'PUT',body:{orders:r.orders.map(o=>o.id==='match-hotel'?{...o,salary:'HKD19000'}:o),revision:r.revision}});await performSync()}")
                assert page.evaluate('matchState.openOrderId')=='match-hotel' and page.evaluate('matchState.calculations')>before
                assert 'HKD19000' in page.locator('[data-match-order=match-hotel] .match-salary').inner_text()
                # English templates translate independently of raw personal/company values.
                page.locator('aside footer [data-language-toggle]').click()
                assert page.locator('h1').inner_text()=='Job Matching'
                assert '合成李秀兰更新' in page.locator('.match-person h2').inner_text()
                assert '相关度' not in page.locator('.match-explanation').first.inner_text()
                untranslated=page.evaluate("""()=>{const out=[],walk=document.createTreeWalker(document.querySelector('#match-workspace'),NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode())if(!n.parentElement.closest('[data-user-content],input,textarea,script,style')&&/[\u3400-\u9fff]/.test(n.nodeValue))out.push(n.nodeValue.trim());return out}""")
                assert not untranslated,untranslated
                page.locator('aside footer [data-language-toggle]').click()
                for width in [900,375,390]:
                    page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(70)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    if width==900:
                        assert not page.locator('.match-profile-shell').evaluate('(e)=>e.open')
                        page.locator('.match-profile-shell>summary').click();assert page.locator('.match-profile-shell').evaluate('(e)=>e.open')
                    else:
                        assert page.locator('.match-row').evaluate_all("rows=>rows.every(row=>[...row.children].every(e=>getComputedStyle(e).whiteSpace==='nowrap'))")
                        page.locator('[data-match-order=match-hotel] .match-order-open').click()
                        if not page.locator('[data-match-order=match-hotel] .match-profile-link').is_visible():page.locator('[data-match-order=match-hotel] .match-order-open').click()
                        page.locator('[data-match-order=match-hotel] .match-profile-link').click()
                        assert page.locator('.match-profile').is_visible()
                        assert page.locator('[data-history-index="0"]').get_attribute('class').endswith('matched')
                        page.locator('.match-mobile-tabs button').first.click()
                        assert page.locator('.match-copy').first.evaluate('(e)=>e.getBoundingClientRect().height')>=44
                        assert page.locator('nav button:visible').count()==3
                # Read-only UI never offers new edit privileges.
                page.set_viewport_size({'width':1440,'height':1000})
                page.evaluate("sessionUser.role='readonly';renderMatchPage()")
                assert page.locator('.match-profile-actions button').count()==1
                page.evaluate("sessionUser.role='admin';renderMatchPage()")
                # The record-row entry preselects the worker; a dirty registration warns before matching.
                page.evaluate("go('workerRecords')");page.wait_for_selector('.workerrow')
                page.locator('.workerrow button[onclick^="openWorkerMatch"]').first.click();page.wait_for_selector('#match-workspace')
                assert page.evaluate('matchState.workerId') in ['match-main','match-sparse','match-excluded']
                page.evaluate("worker={};go('workers')");page.locator('#w-name').fill('合成未保存劳工')
                choice['accept']=False;count=len(dialogs);page.evaluate("go('match')")
                assert len(dialogs)==count+1 and page.evaluate('view')=='workers'
                assert page.locator('#w-name').input_value()=='合成未保存劳工'
                choice['accept']=True;page.evaluate("go('match')");page.wait_for_selector('#match-workspace')
                # Sparse and excluded-only states.
                page.evaluate("selectMatchWorker('match-sparse')");assert '请补充工作经历后再匹配' in page.locator('.match-results').inner_text()
                page.evaluate("selectMatchWorker('match-excluded')");assert page.locator('.match-excluded').evaluate('(e)=>e.open')
                assert '没有符合的岗位' in page.locator('.match-results').inner_text()
                page.evaluate("selectMatchWorker('match-main')")
                results=page.evaluate("matchBundle().results.filter(r=>!r.excluded&&!r.manual).map(r=>({id:r.orderId,score:r.score,level:r.level}))")
                snapshots.append({'scores':results,'boundaryAge':boundary_age,'currentMonths':current_months})
                # Cached AI metadata is independent of business fields and expires after a relevant edit.
                page.evaluate("""async()=>{const w=workers.find(w=>w.id==='match-main');window.originalMatchWorker={...w};await dbWrite('put',{...w,matchProfile:{version:2,sourceHash:ZYMatching.sourceHash(w,'worker'),by:'ai',intents:[],certificates:[],history:[{index:0,major:'hotel_cleaning',subcategory_id:'seed:housekeeping',evidence:'客房清洁员'}]}});await performSync();matchState.openOrderId='match-hotel';renderMatchPage()}""")
                assert 'AI' in page.locator('.match-breakdown').inner_text()
                page.evaluate("""async()=>{const w=workers.find(w=>w.id==='match-main');await dbWrite('put',{...w,workHistory:w.workHistory.map((h,i)=>i===0?{...h,duties:h.duties+'，合成更新'}:h)});await performSync()}""")
                assert page.evaluate("ZYMatching.profileFor(workers.find(w=>w.id==='match-main'),'worker').by")=='rules'
                page.evaluate("""async()=>{const w=workers.find(w=>w.id==='match-main');await dbWrite('put',{...originalMatchWorker,_version:w._version});await performSync()}""")
                # Save-success link enters matching with the new worker selected, without adding a new write route.
                page.evaluate("newWorkerRegistration()")
                page.locator('#w-name').fill('合成新登记');page.locator('#w-desiredJob1').fill('清洁')
                page.evaluate('saveWorker()');page.wait_for_selector('.workerrow')
                page.locator('.toast button').click();page.wait_for_selector('#match-workspace')
                assert page.locator('.match-person h2').inner_text()=='合成新登记'
                # No ready company records and no workers have their own actionable empty states.
                page.evaluate("selectMatchWorker('match-main')")
                page.evaluate("async()=>{window.matchOriginalOrders=(await api('/api/orders')).orders;const r=await api('/api/orders');await api('/api/orders',{method:'PUT',body:{orders:r.orders.map(o=>({...o,price:''})),revision:r.revision}});await performSync()}")
                assert '没有可发布' in page.locator('.match-results').inner_text()
                page.locator('.match-results button').filter(has_text='切换到30天').click()
                assert page.evaluate('matchState.days')==30
                page.evaluate("async()=>{for(const w of (await api('/api/workers')).workers)await api('/api/workers',{method:'DELETE',body:{id:w.id,version:w._version}});await performSync()}")
                assert '还没有已登记' in page.locator('#match-workspace').inner_text()
                assert page.locator('#match-workspace button').filter(has_text='去劳工登记').count()==1
                assert page.evaluate('matchState.cache.size')==0
                # Cache is ephemeral; no matching results/applicant data are written to browser storage.
                assert page.evaluate("Object.keys(localStorage).filter(k=>k!=='zy-ui-language-v1')")==[]
                assert page.evaluate('indexedDB.databases().then(dbs=>dbs.length)')==0
                assert not [u for method,u in requests if not u.startswith(url)]
                assert not errors,errors
                context.close();print(f'PASS: {zone}: matching entry/search/scores/highlights/copy/privacy/ranges/sync/mobile/i18n/readonly and dirty-registration guard')
            assert snapshots[0]==snapshots[1],snapshots
            browser.close();print('PASS: both browser timezones have identical matching scores')
    finally:
        server.shutdown();server.server_close()
