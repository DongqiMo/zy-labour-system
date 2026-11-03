"""Worker template/form/import adapter acceptance using synthetic data and a temporary server."""
from pathlib import Path
import json,secrets,sys,tempfile,threading,subprocess,shutil
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import make_server,create_user
from playwright.sync_api import sync_playwright

with tempfile.TemporaryDirectory() as tmp:
    server=make_server(Path(tmp)/'workers.sqlite3',port=0,secure=False)
    url='http://127.0.0.1:'+str(server.server_address[1]);server.public_origin=url
    password=secrets.token_urlsafe(24);create_user(Path(tmp)/'workers.sqlite3','owner',password,'admin')
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(url);page.locator('[name=username]').fill('owner');page.locator('[name=password]').fill(password);page.locator('#loginForm button').click();page.wait_for_selector('#syncStatus')
            page.evaluate("worker={};go('workers');converter=x=>x")
            for field,value in {'name':'模板测试人员','birthDate':'1994-05-12','height':'170','weight':'65','idNumber':'SYNTHETIC-ID','idAddress':'测试地址甲','currentAddress':'测试地址乙','desiredSalary':'HKD 18,000，期望岗位厨师','phone':'00000000','certificates':'测试技能证书','hobbies':'阅读'}.items():page.locator('#w-'+field).fill(value)
            for field,value in {'gender':'男','permit':'是','workedHongKong':'否','cantonese':'流利','mandarin':'良好','english':'略懂'}.items():page.locator('#w-'+field).select_option(value)
            page.evaluate("addHistory('educationHistory');worker.educationHistory[0]={period:'2010–2013',school:'测试学校',major:'测试专业',qualification:'测试学历'};renderHistory('educationHistory');addHistory('workHistory');worker.workHistory[0]={period:'2020–2023',employer:'测试单位',position:'测试岗位',duties:'整理测试资料'};renderHistory('workHistory');worker.photo=(()=>{const c=document.createElement('canvas');c.width=100;c.height=120;c.getContext('2d').fillRect(0,0,100,120);return c.toDataURL('image/jpeg')})()")
            page.evaluate('previewCurrent()');page.wait_for_function("document.querySelector('.worker-template-background')?.naturalWidth===2480")
            assert page.locator('.worker-template-page').count()==1
            assert page.locator('.worker-template-check').count()==5
            assert not page.locator('.worker-preview-sheet').evaluate("e=>e.innerHTML.includes('NaN')")
            assert page.locator('.worker-template-photo').count()==1
            assert '模板测试人员' in page.locator('.worker-preview-sheet').inner_text()
            page.emulate_media(media='print')
            assert 790<page.locator('.worker-template-page').bounding_box()['width']<800
            assert page.locator('.worker-template-field').first.evaluate("e=>getComputedStyle(e).fontSize").endswith('px')
            pdf=Path(tmp)/'registration.pdf';page.pdf(path=str(pdf),print_background=True,prefer_css_page_size=True)
            if shutil.which('pdfinfo'):
                info=subprocess.check_output(['pdfinfo',str(pdf)],text=True)
                assert 'Pages:           1' in info,info
                assert 'A4' in info,info
            page.emulate_media(media='screen');page.evaluate("document.querySelector('#modal').close();saveWorker()")
            page.wait_for_selector('.workerrow');saved=page.evaluate('workers[0]');assert saved['name']=='模板测试人员' and saved['cantonese']=='流利' and len(saved['educationHistory'])==1
            page.evaluate('editWorker(workers[0].id)');assert page.locator('#w-gender').input_value()=='男';assert page.locator('#w-idNumber').input_value()=='SYNTHETIC-ID'
            # Long original fields use an appendix rather than disappearing from the document.
            page.evaluate("worker.workHistory[0].duties='长文本测试'.repeat(30);previewCurrent()")
            assert page.locator('.worker-template-appendix').count()==1
            assert '长文本测试'*30 in page.locator('.appendix-box').inner_text()
            page.evaluate("document.querySelector('#modal').close()")
            # Existing legacy enum values remain readable and are not silently cleared.
            page.evaluate("worker.marital='其他旧值';workerView()")
            assert page.locator('#w-marital').input_value()=='其他旧值'
            page.evaluate("ZYI18n.toggle()")
            assert page.locator('#w-name').input_value()=='模板测试人员'
            assert page.locator('#w-gender').input_value()=='男'
            # Invalid files fail before loading external recognition libraries.
            page.evaluate("importWorkerPdf(new File(['x'],'wrong.txt',{type:'text/plain'}))")
            assert page.locator('#w-name').input_value()=='模板测试人员'
            labelled=page.evaluate("workerPdfLabelValues([{text:'姓 名：测试姓名 性 别：男 身 高：170 体 重：60',cols:['','','',''],y:140}])")
            assert labelled['name']=='测试姓名' and labelled['gender']=='男' and labelled['height']=='170' and labelled['weight']=='60',labelled
            # Exercise the actual coordinate extraction/merge path with a deterministic PDF.js boundary.
            page.on('dialog',lambda dialog:dialog.accept())
            page.evaluate("""()=>{loadWorkerPdfJs=async()=>({getDocument:()=>({promise:Promise.resolve({numPages:1,destroy:async()=>{},getPage:async()=>({getViewport:({scale})=>({width:595.2*scale,height:841.92*scale,convertToViewportPoint:(x,y)=>[x,841.92-y]}),getTextContent:async()=>({items:Object.entries({name:'导入测试人员',gender:'女',height:'165',weight:'55',birthDate:'1995-06-15',age:'30',marital:'未婚',hometown:'测试地区',health:'健康',education:'本科',idNumber:'SYNTHETIC-PDF',idValidity:'2030.01.01',idAddress:'测试地址',currentAddress:'测试现址',hkEmployer:'测试雇主',hkExitDate:'2024-01-01',otherLanguages:'测试语言',certificates:'测试证书',hobbies:'阅读',desiredJob1:'厨师',desiredJob2:'文员',desiredJob3:'电工',desiredSalary:'18000',phone:'00000000',alternateContact:'测试联系'}).map(([key,str])=>{const r=workerPdfRegions()[key];return {str,transform:[1,0,0,1,r.x+3,841.92-r.y-18],width:Math.min(32,r.w-6),height:8}})}),render:()=>({promise:Promise.resolve()})})})})})}""")
            page.evaluate("importWorkerPdf(new File(['%PDF-1.4\\n%%EOF'],'synthetic.pdf',{type:'application/pdf'}))")
            page.wait_for_function("worker.name==='导入测试人员'")
            assert page.locator('#w-name').input_value()=='导入测试人员'
            assert page.evaluate('worker.sourcePdfDirty===false && worker.sourcePdfData.startsWith("data:application/pdf;base64,")')
            assert page.evaluate("api('/api/workers').then(x=>x.workers[0].name)")=='模板测试人员','Import must not save automatically'
            page.evaluate('previewCurrent()');assert page.locator('.worker-source-pdf-frame').count()==1;page.evaluate("document.querySelector('#modal').close()")
            page.locator('#w-name').fill('导入后已核对');assert page.evaluate('worker.sourcePdfDirty===true')
            page.evaluate('previewCurrent()');assert page.locator('.worker-template-background').count()==1;page.evaluate("document.querySelector('#modal').close()")
            page.evaluate('saveWorker()');page.wait_for_selector('.workerrow');assert page.evaluate('workers[0].name')=='导入后已核对'
            page.set_viewport_size({'width':390,'height':844});page.evaluate('editWorker(workers[0].id)');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),page.evaluate("Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.tagName,e.className,e.id,Math.round(e.getBoundingClientRect().width)]).slice(0,15)")
            assert not errors,errors;browser.close()
        print('PASS: legacy template coordinates, finite language checks, A4 PDF, appendix, enum/data preservation, shared save, language switch, PDF validation/import adapter and mobile form')
    finally:
        server.shutdown();server.server_close()
