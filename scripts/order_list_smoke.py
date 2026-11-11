"""Unified-list acceptance with synthetic orders and a disposable local database."""
from pathlib import Path
import json, secrets, sys, tempfile, threading
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import make_server,create_user

with tempfile.TemporaryDirectory() as tmp:
    server=make_server(Path(tmp)/'list.sqlite3',port=0,secure=False)
    url=f'http://127.0.0.1:{server.server_address[1]}';server.public_origin=url
    password=secrets.token_urlsafe(24);create_user(server.db_path,'synthetic-reviewer',password,'admin')
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1440,'height':1000})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
            page.goto(url);page.locator('[name=username]').fill('synthetic-reviewer');page.locator('[name=password]').fill(password)
            page.locator('#loginForm button').click();page.wait_for_selector('#syncStatus')
            review_source=next(c['source'] for c in json.loads(Path('tests/fixtures/recognition-errors.json').read_text())['cases'] if c['id']=='REC-005')
            page.evaluate('''async reviewSource=>{
                const raw='岗位：资料协调员\\n雇主：香港某合成机构\\n性别：男女不限\\n年龄：40-50岁\\n工资：HKD22000\\n工作时间：每天8小时\\n工作内容：整理资料';
                const make=(id,source,n)=>({...ZYOrderParser.analyze(source,'ZY-26-1109-'+n,{explicitBoundary:true}).order,id,createdAt:new Date().toISOString(),price:'4.2w',status:'ready'});
                const ready=make('ui-ready',raw,'01');Object.assign(ready,ZYOrderParser.humanReviewMetadata(ready,'synthetic-reviewer'));
                ready.workContent=Array.from({length:80},(_,i)=>'合成工作内容供滚动验证'+i).join('；');
                const review=make('ui-review',reviewSource,'02');const draft=make('ui-draft',raw,'03');draft.price='';
                const old=make('ui-old',reviewSource,'04');const t=new Date();t.setDate(t.getDate()-14);old.createdAt=t.toISOString();
                const long={...ready,id:'ui-long',code:'ZY-26-1109-05',title:'合成长职位名称'.repeat(15),employer:'合成雇主名称'.repeat(15),age:'40 - 50 岁'};
                const saved=await api('/api/orders',{method:'PUT',body:{orders:[ready,review,draft,old,long],revision}});revision=saved.revision;orders=[ready,review,draft,old,long];go('dashboard');
                window.clipboardCopies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{clipboardCopies.push(text)}},configurable:true});
            }''',review_source)
            assert page.locator('header,.stats,.stat,.order-card').count()==0
            assert page.locator('aside .brand img').count()==1
            assert page.locator('.order-row').count()==4
            assert page.locator('#state-chips b').all_text_contents()==['4','1','1','2']
            assert page.locator('#nav-review-count').inner_text()=='2' # all dates, not only today's filters
            assert page.locator('.row-age').last.inner_text()=='40-50岁'
            assert page.locator('.row-gender').first.inner_text()=='不限'
            assert page.evaluate("orders[0].gender")=='男女不限'
            assert page.locator('[data-order-id=ui-long] .row-identity').get_attribute('title').count('合成')>2
            heights=page.locator('.order-row').evaluate_all('(rows)=>rows.map(row=>row.getBoundingClientRect().height)')
            assert heights==[52]*4,heights
            assert page.locator('.order-row').evaluate_all("rows=>rows.every(row=>[...row.children].every(cell=>getComputedStyle(cell).whiteSpace==='nowrap'))")
            page.locator('[data-order-id=ui-ready] .order-open').focus();page.keyboard.press('Enter')
            assert page.evaluate('selectedOrderId')=='ui-ready'
            assert page.locator('[data-order-id=ui-ready]').get_attribute('class').endswith('selected')
            assert page.locator('[data-order-id=ui-ready] .order-open').evaluate('(e)=>e.getBoundingClientRect().width')>=200
            assert page.locator('#order-detail').evaluate('(e)=>Math.round(e.getBoundingClientRect().width)')==392
            page.locator('.detail-primary').click();assert page.evaluate('clipboardCopies.length')==1
            page.locator('[data-order-id=ui-ready] .row-action').click();assert page.evaluate('clipboardCopies.length')==2
            assert page.locator('.toast').inner_text()=='公司单已复制'
            # Tabs reset on switching record; independent scroll survives real list refreshes/sync.
            page.locator('#detail-tab-raw').click();assert page.locator('.source-copy').inner_text()==page.evaluate('orders[0].raw')
            page.locator('#detail-tab-company').click();page.locator('#detail-scroll').evaluate('(e)=>e.scrollTop=180')
            scroll=page.locator('#detail-scroll').evaluate('(e)=>e.scrollTop');assert scroll>0
            page.evaluate('''async()=>{const native=api;api=async(path,opts)=>path==='/api/orders'?{orders:orders.map(o=>o.id==='ui-ready'?{...o,employer:'合成同步雇主'}:o),revision:revision+1}:native(path,opts);try{await performSync()}finally{api=native}}''')
            assert page.evaluate('selectedOrderId')=='ui-ready' and page.evaluate('detailTab')=='company'
            assert page.locator('#detail-scroll').evaluate('(e)=>e.scrollTop')==scroll
            assert '合成同步雇主' in page.locator('.detail-facts').inner_text()
            page.locator('[data-order-id=ui-review] .row-more').click()
            assert page.locator('#order-menu').get_by_role('menuitem',name='标记已人工核对',exact=True).count()==1
            page.keyboard.press('Escape')
            page.locator('[data-order-id=ui-review] .row-action').click()
            assert page.evaluate('detailTab')=='sources' and page.locator('#detail-scroll').evaluate('(e)=>e.scrollTop')==0
            assert page.locator('.publication-problems li').count()>0
            assert page.locator('#detail-scroll > details').count()==0
            assert page.locator('#detail-scroll .review-confirm').count()==0 # read-only source view cannot mutate metadata
            page.locator('.detail-primary').click();assert page.locator('#confirm-order-review').is_visible()
            # Restore the actual revision after a synthetic sync, then confirm through the unchanged writer.
            page.evaluate("api('/api/orders').then(r=>{revision=r.revision})")
            page.locator('#confirm-order-review').click();page.wait_for_function("() => !document.querySelector('#modal').open")
            assert page.evaluate('selectedOrderId')=='ui-review' and page.evaluate('detailTab')=='sources'
            assert page.locator('#order-detail .state-badge').inner_text()=='可发布'
            assert 'synthetic-reviewer' in page.locator('.reviewed-stamp').inner_text()
            page.locator('[data-order-id=ui-review] .row-more').click()
            assert page.locator('#order-menu').get_by_role('menuitem',name='标记已人工核对',exact=True).count()==0
            page.keyboard.press('Escape')
            page.locator('[data-order-id=ui-draft] .row-action').click();assert page.locator('#price-input').is_visible()
            page.locator('#price-input').fill('3.7w');page.locator('#modal button').filter(has_text='保存价格').click()
            page.wait_for_function("() => !document.querySelector('#modal').open")
            page.evaluate("openOrderDetail('ui-draft')");assert '3.7w' in page.locator('.detail-facts').inner_text()
            page.evaluate("fillPrice('ui-draft')");page.locator('#price-input').fill('');page.locator('#modal button').filter(has_text='保存价格').click()
            page.wait_for_function("() => !document.querySelector('#modal').open")
            assert page.evaluate('selectedOrderId')=='ui-draft'
            assert page.locator('.detail-primary').inner_text()=='填写全包价'
            page.locator('.detail-primary').click();assert page.locator('#price-input').is_visible();page.evaluate("$('#modal').close()")
            # All date modes, counts and status chips derive from the same records/state function.
            for range_name,count in [('week',4),('all',5),('today',4)]:
                page.locator(f'[data-range={range_name}]').click()
                assert page.locator('#state-chips b').first.inner_text()==str(count)
                assert page.locator('.order-row').count()==count
                if range_name=='week':
                    group=page.locator('.order-date-group').first
                    assert group.count()==1
                    if group.evaluate('(e)=>e.open'):group.locator('summary').click()
                    assert not group.evaluate('(e)=>e.open')
                    assert group.locator('.order-row:visible').count()==0
                    group.locator('summary').focus();page.keyboard.press('Enter')
                    assert group.evaluate('(e)=>e.open')
                    assert group.locator('.order-row:visible').count()==4
                    page.evaluate('listRender()')
                    assert page.locator('.order-date-group').first.evaluate('(e)=>e.open')
            page.locator('[data-filter-state=draft]').click();assert page.locator('.order-row').count()==1
            page.locator('[data-filter-state=""]').click()
            page.locator('[data-range=date]').click();assert page.locator('.calendar-panel').evaluate('(e)=>e.open')
            assert page.locator('.calendar-today[aria-current=date]').count()==1
            old_date=page.evaluate("orderDateKey(orders.find(o=>o.id==='ui-old').createdAt)")
            page.locator('#order-date').fill(old_date);page.locator('#order-date').dispatch_event('change')
            assert page.locator('.order-row').count()==1 and page.locator('#state-chips b').first.inner_text()=='1'
            assert page.locator('[data-range=date]').inner_text()==old_date
            page.evaluate("selectOrderDate('');setOrderRange('today')")
            for query in ['资料协调员','1109-01','合成同步雇主','22000']:
                page.locator('#order-search').fill(query);page.wait_for_timeout(260)
                assert page.locator('.order-row').count()>0,query
            page.locator('#order-search').fill('不存在的合成岗位');page.wait_for_timeout(260);assert page.locator('.order-row').count()==0
            page.locator('#order-search').fill('1109-01');page.wait_for_timeout(260)
            page.locator('[data-filter-state=ready]').click();page.evaluate("openOrderDetail('ui-ready')")
            before=page.evaluate('JSON.stringify(filters.orders)')
            page.locator('.detail-actions').get_by_role('button',name='编辑',exact=True).click();page.locator('#o-notes').fill('合成编辑备注')
            page.evaluate('saveOrder()');page.wait_for_selector('#order-workspace')
            assert page.evaluate('JSON.stringify(filters.orders)')==before and page.evaluate('selectedOrderId')=='ui-ready'
            assert page.locator('#order-detail .company-copy').count()==1
            # More menu keeps destructive actions out of the row and restores focus on Escape.
            assert page.locator('.order-row > .danger').count()==0
            page.locator('.row-more').first.click();assert page.locator('#order-menu .danger').inner_text()=='删除'
            page.keyboard.press('Escape');assert page.locator('.row-more').first.evaluate('(e)=>e===document.activeElement')
            # Tablet drawer is modal; Escape/backdrop closes and returns to the row trigger.
            page.evaluate("filters.orders.q='';filters.orders.s='';setOrderRange('today');closeOrderDetail()")
            page.set_viewport_size({'width':900,'height':900})
            page.locator('[data-order-id=ui-ready] .order-open').click();assert page.locator('#detail-overlay').evaluate('(e)=>e.open')
            assert page.evaluate("document.querySelector('#detail-overlay').contains(document.activeElement)")
            page.keyboard.press('Escape');assert page.locator('[data-order-id=ui-ready] .order-open').evaluate('(e)=>e===document.activeElement')
            for width in [375,390]:
                page.set_viewport_size({'width':width,'height':844})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert page.locator('.mobile-row-meta').evaluate_all("items=>items.every(e=>getComputedStyle(e).whiteSpace==='nowrap')")
                assert page.locator('nav').evaluate('(e)=>e.getBoundingClientRect().height')==68
                assert page.locator('nav button:visible').count()==3
                assert page.locator('.order-tools button:visible,.order-open:visible,.row-action:visible,nav button:visible').evaluate_all('items=>items.every(e=>e.getBoundingClientRect().height>=44)')
                assert page.locator('.new-order-fab').evaluate('(e)=>e.getBoundingClientRect().bottom')<=844-68-16
                page.locator('[data-order-id=ui-ready] .order-open').click()
                assert page.locator('#detail-overlay').evaluate('(e)=>e.open')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.wait_for_timeout(170)
                assert page.locator('.detail-close').evaluate('(e)=>e.getBoundingClientRect().height')>=44
                page.locator('#detail-tab-raw').focus();page.keyboard.press('ArrowRight');assert page.evaluate('detailTab')=='sources'
                # Native modal contains keyboard focus, including Shift+Tab wrapping.
                for _ in range(14):page.keyboard.press('Tab')
                assert page.evaluate("document.querySelector('#detail-overlay').contains(document.activeElement)")
                page.locator('.detail-close').click();assert page.locator('[data-order-id=ui-ready] .order-open').evaluate('(e)=>e===document.activeElement')
                page.locator('[data-order-id=ui-ready] .order-open').click();page.mouse.click(5,5)
                assert not page.locator('#detail-overlay').evaluate('(e)=>e.open')
                assert page.locator('[data-order-id=ui-ready] .order-open').evaluate('(e)=>e===document.activeElement')
            page.evaluate("go('workerRecords')");page.locator('.mobile-account-trigger').click();assert page.locator('#modal [data-language-toggle]').is_visible()
            page.locator('#modal [data-language-toggle]').click();page.evaluate("$('#modal').close();go('dashboard')")
            page.wait_for_function("() => document.querySelector('h1').textContent==='Labour Orders'")
            page.evaluate("filters.orders.q='1109-01';listRender();openOrderDetail('ui-ready')")
            assert page.locator('#order-detail .company-copy').inner_text()==page.evaluate("publish(orders.find(o=>o.id==='ui-ready'))")
            assert '4.2w' in page.locator('.detail-facts').inner_text()
            assert page.locator('#list-count').inner_text()=='1 order'
            assert page.locator('#detail-tab-sources').inner_text()=='Recognition Sources'
            # All new UI text translates, while record text is excluded from localisation.
            for tab in ['company','raw','sources']:
                page.evaluate('(tab)=>selectDetailTab(tab)',tab)
                page.wait_for_timeout(40)
                untranslated=page.evaluate("""()=>{const texts=[],walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode())if(!n.parentElement.closest('[data-user-content],pre,textarea,input,script,style,#date,#login-date,[data-language-toggle]')&&/[\u3400-\u9fff]/.test(n.nodeValue))texts.push(n.nodeValue.trim());return texts}""")
                assert not untranslated,untranslated
            # Required palette text/background pairs meet WCAG AA contrast.
            ratios=page.evaluate("""()=>{const css=getComputedStyle(document.documentElement),lum=name=>{const hex=css.getPropertyValue(name).trim().replace('#',''),h=hex.length===3?[...hex].map(c=>c+c).join(''):hex;return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0)};return [['--text-muted','--surface'],['--text-muted','--row-selected'],['--text-secondary','--group-head'],['--ready-text','--ready-bg'],['--review-text','--review-bg'],['--draft-text','--draft-bg'],['--surface','--brand'],['--sidebar-text','--sidebar']].map(([a,b])=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)})}""")
            assert min(ratios)>=4.5,ratios
            page.emulate_media(reduced_motion='reduce')
            assert page.locator('#detail-overlay').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
            assert page.locator('.detail-close').evaluate('(e)=>getComputedStyle(e).transitionDuration')=='0s'
            # Deletion discovered by sync closes only the missing selection and notifies once.
            page.evaluate("closeOrderDetail();openOrderDetail('ui-ready');window.originalToast=toast;window.deletionNotices=0;toast=text=>{if(text==='该劳务单已被删除')deletionNotices++;originalToast(text)};orders=orders.filter(o=>o.id!=='ui-ready');render();render()")
            assert page.evaluate('deletionNotices')==1
            assert page.evaluate('selectedOrderId') is None
            assert page.locator('.toast').inner_text()=='This order has been deleted'
            assert not page.locator('#detail-overlay').evaluate('(e)=>e.open')
            assert not errors,errors
            browser.close()
            print('PASS: compact 52px grid/200px identity column, unified counts/ranges/search, state actions/menu, retained selection/tab/scroll on sync/edit, desktop/tablet/mobile details, keyboard/modal focus restoration, 375/390px layout, account access, English business-data protection and reduced motion')
    finally:
        server.shutdown();server.server_close()
