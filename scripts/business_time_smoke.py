"""Frozen-clock China business-date acceptance in three real browser timezones; synthetic local data only."""
from datetime import datetime
from pathlib import Path
import json,secrets,sys,tempfile,threading
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import make_server,create_user

def freeze(page,instant):
    page.clock.set_fixed_time(datetime.fromisoformat(instant.replace('Z','+00:00')))

with tempfile.TemporaryDirectory() as tmp:
    server=make_server(Path(tmp)/'time.sqlite3',port=0,secure=False)
    url=f'http://127.0.0.1:{server.server_address[1]}';server.public_origin=url
    password=secrets.token_urlsafe(24);create_user(server.db_path,'time-reviewer',password,'admin')
    threading.Thread(target=server.serve_forever,daemon=True).start()
    snapshots=[]
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            for zone in ['America/Toronto','Asia/Shanghai','Pacific/Auckland']:
                context=browser.new_context(timezone_id=zone,viewport={'width':1440,'height':1000},accept_downloads=True)
                page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('dialog',lambda dialog:dialog.accept())
                freeze(page,'2026-11-09T17:30:00Z');page.goto(url)
                page.wait_for_selector('#loginForm')
                assert page.locator('#login-date').inner_text()=='2026年11月10日 星期二 · 北京时间'
                page.locator('[name=username]').fill('time-reviewer');page.locator('[name=password]').fill(password)
                page.locator('#loginForm button').click();page.wait_for_selector('#syncStatus')
                page.evaluate('''async()=>{
                    const raw='岗位：时区合成专岗\\n雇主：合成机构\\n工资：HKD22000\\n性别：男\\n年龄：40岁以下\\n工作时间：每天8小时\\n工作内容：整理资料';
                    const make=(id,code,createdAt)=>{const order={...ZYOrderParser.analyze(raw,code,{explicitBoundary:true}).order,id,createdAt,price:'4.2w',status:'ready'};return {...order,...ZYOrderParser.humanReviewMetadata(order,'time-reviewer'),humanReviewedAt:'2026-11-09T03:42:00Z'}};
                    orders=[make('time-reference','ZY-26-1109-26','2026-11-09T02:36:00Z'),make('time-today','ZY-26-1110-01','2026-11-09T17:00:00Z'),
                        make('time-sunday','ZY-26-1115-01','2026-11-15T15:59:00Z'),make('time-monday','ZY-26-1116-01','2026-11-15T16:00:00Z'),
                        make('time-dst-fall-before','ZY-26-1101-01','2026-11-01T05:30:00Z'),make('time-dst-fall-after','ZY-26-1101-02','2026-11-01T06:30:00Z'),
                        make('time-dst-spring-before','ZY-26-0308-01','2026-03-08T06:59:00Z'),make('time-dst-spring-after','ZY-26-0308-02','2026-03-08T07:01:00Z')];
                    const result=await api('/api/orders',{method:'PUT',body:{orders,revision}});revision=result.revision;go('orders');
                }''')
                before=page.evaluate("api('/api/orders').then(r=>r.orders.find(o=>o.id==='time-reference'))")
                result={}
                result['reference']=page.evaluate("day(orders.find(o=>o.id==='time-reference').createdAt)")
                assert result['reference']=='2026-11-09'
                assert page.locator('.order-date-group > summary[data-date="2026-11-09"]').count()==1
                page.evaluate("selectOrderDate('2026-11-09');openOrderDetail('time-reference')")
                assert page.locator('.calendar-day[data-date="2026-11-09"] small').inner_text()=='1'
                assert '录入 2026-11-09' in page.locator('.detail-facts').inner_text()
                assert '2026-11-09 11:42 北京时间' in page.locator('.reviewed-stamp').inner_text()
                result['review']=page.locator('.reviewed-stamp').inner_text()
                page.evaluate("closeOrderDetail();go('dashboard')")
                assert page.locator('.order-row').count()==1 and page.locator('.order-row').get_attribute('data-order-id')=='time-today'
                result['prefix']=page.evaluate('prefix()');assert result['prefix']=='ZY-26-1110-'
                assert page.locator('.calendar-today').get_attribute('data-date')=='2026-11-10'
                assert page.locator('#business-date').inner_text()=='2026年11月10日 星期二'
                assert '北京时间' in page.locator('.business-clock').inner_text()
                page.locator('aside footer [data-language-toggle]').click()
                assert page.locator('#business-date').inner_text()=='Tuesday, November 10, 2026'
                assert 'China time' in page.locator('.business-clock').inner_text()
                page.locator('aside footer [data-language-toggle]').click()
                result['midnight']=[]
                for instant,key,expected in [('2026-11-09T15:59:00Z','2026-11-09','ZY-26-1109-27'),('2026-11-09T16:00:00Z','2026-11-10','ZY-26-1110-01')]:
                    freeze(page,instant)
                    boundary=page.evaluate("() => {const saved=orders;orders=[{code:'ZY-26-1109-26'}];const value={today:today(),code:code()};orders=saved;return value}")
                    assert boundary=={'today':key,'code':expected};result['midnight'].append(boundary)
                    page.evaluate("orderCalendarMonth=(({year,month})=>({year,month}))(ZYTime.parts(new Date()));go('dashboard')")
                    assert page.locator('.calendar-today').get_attribute('data-date')==key
                result['weeks']=[]
                for instant,start,ids in [('2026-11-15T15:59:00Z','2026-11-09',['time-reference','time-today','time-sunday']),('2026-11-15T16:00:00Z','2026-11-16',['time-monday'])]:
                    freeze(page,instant);page.evaluate("setOrderRange('week')")
                    assert page.evaluate('rangeOrders().map(o=>o.id)')==ids
                    week=page.evaluate('ZYTime.weekRange(today())');assert week['start']==start;result['weeks'].append(week)
                    assert page.locator('#state-chips b').first.inner_text()==str(len(ids))
                result['dst']=[]
                for key,instants in [('2026-11-01',['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z']),('2026-03-08',['2026-03-08T06:59:00Z','2026-03-08T07:01:00Z'])]:
                    for instant in instants:
                        freeze(page,instant);page.evaluate('(key)=>selectOrderDate(key)',key)
                        assert page.evaluate('today()')==key
                        assert page.locator('.order-row').count()==2
                        assert page.locator(f'.calendar-day[data-date="{key}"] small').inner_text()=='2'
                        assert page.locator('.calendar-today').get_attribute('data-date')==key
                        result['dst'].append(page.evaluate('({key:today(),week:ZYTime.weekRange(today()),days:ZYTime.monthInfo(orderCalendarMonth.year,orderCalendarMonth.month).daysInMonth})'))
                # Birthday flips on the China date, not on the device's date; explicit stored age retains precedence.
                freeze(page,'2026-05-11T15:59:00Z');assert page.evaluate("workerAge({birthDate:'1990-05-12'})")==35
                freeze(page,'2026-05-11T16:00:00Z');assert page.evaluate("workerAge({birthDate:'1990-05-12'})")==36
                assert page.evaluate("workerAge({birthDate:'1990-05-12',age:'30'})")=='30'
                page.evaluate("go('workers')");page.locator('#w-name').fill('合成时区劳工')
                page.locator('#w-birthDate').fill('1990-05-12');page.locator('#w-hkExitDate').fill('2026-03-08')
                page.evaluate('previewCurrent()')
                assert '1990.05.12' in page.locator('#modal').inner_text() and '2026.03.08' in page.locator('#modal').inner_text()
                assert page.evaluate('worker.birthDate')=='1990-05-12' and page.evaluate('worker.hkExitDate')=='2026-03-08'
                page.evaluate("$('#modal').close()")
                result['worker']=page.evaluate('({birthDate:worker.birthDate,hkExitDate:worker.hkExitDate,age:workerAge(worker)})')
                freeze(page,'2026-11-09T17:30:00Z')
                result['legacy']=page.evaluate("ZYOrderParser.repairLegacyOrders([{id:'time-legacy',code:'V-11.9-3',createdAt:'2025-12-31T18:00:00Z',raw:'岗位：合成职位',gender:'男',salary:'HKD22000'}])[0].code")
                assert result['legacy']=='ZY-26-1109-03'
                # Both portable and worker backup filenames share the China day, with no backend business writes.
                with page.expect_download() as download:page.evaluate('backup()')
                assert download.value.suggested_filename=='zy-worker-registration-backup-2026-11-10.json'
                with page.expect_download() as download:page.evaluate('exportPortable()')
                assert download.value.suggested_filename=='zy-full-backup-2026-11-10.json'
                assert page.evaluate("api('/api/orders').then(r=>r.orders.find(o=>o.id==='time-reference'))")==before
                page.evaluate("worker={};editing=null;mode='single';go('new');converter=x=>x")
                page.locator('#raw').fill('岗位：时区合成专岗\n工资：HKD22000\n性别：男\n年龄：40岁以下\n工作时间：每天8小时')
                page.evaluate('autoParse()');assert page.locator('#o-code').input_value()=='ZY-26-1110-02'
                page.evaluate('saveOrder()');page.wait_for_selector('#order-workspace')
                assert page.evaluate('orders[0].createdAt')=='2026-11-09T17:30:00.000Z'
                assert page.evaluate('orders[0].code')=='ZY-26-1110-02'
                assert page.evaluate('filters.orders.range')=='today'
                assert page.evaluate("api('/api/orders').then(r=>r.orders.find(o=>o.id==='time-reference'))")==before
                assert not errors,errors
                snapshots.append(result);context.close()
                print(f'PASS: {zone}: all nine China-time scenarios, birthday boundaries, UTC storage/history preservation and backup filenames')
            assert all(snapshot==snapshots[0] for snapshot in snapshots),json.dumps(snapshots,ensure_ascii=False,indent=2)
            browser.close();print('PASS: all three timezone snapshots are identical')
    finally:
        server.shutdown();server.server_close()
