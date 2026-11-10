/* View-only unified order workspace. Business validation and writes stay in their existing modules. */
let selectedOrderId=null,detailTab='company',detailScroll=0,orderListReturn=null,detailTriggerId=null,searchTimer=null;
let calendarExpanded=false;
const expandedOrderDates=new Set();
const jsValue=value=>esc(JSON.stringify(value));
const navSymbols={orders:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',workers:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',match:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10l2 2 4-4"/>',workerRecords:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M5 17c0-4 8-4 8 0M15 8h3M15 12h3"/>'};
function navigation(){
 const nav=$('#nav');if(!nav)return;
 nav.innerHTML=[['劳务单',['orders']],['劳工信息',['workers','workerRecords','match']]].map(([label,keys])=>`<section class="nav-group"><h2 class="nav-group-title">${label}</h2><div class="nav-group-items">${keys.map(k=>`<button class="${k===view?'active':''} ${k==='match'?'match-nav':''}" ${k===view?'aria-current="page"':''} onclick="go('${k}',{preserveOrders:true})"><svg viewBox="0 0 24 24" aria-hidden="true">${navSymbols[k]}</svg><span>${k==='workers'?'劳工登记':names[k]}</span>${k==='orders'?'<b id="nav-review-count" hidden></b>':''}</button>`).join('')}</div></section>`).join('');updateReviewCount();
}
function updateReviewCount(){const badge=$('#nav-review-count');if(!badge)return;const n=orders.filter(o=>orderState(o)==='review').length;badge.hidden=!n;badge.textContent=n;badge.setAttribute('aria-label',(window.ZYI18n?.translate('需核对')||'需核对')+': '+n)}
function go(v,options={}){
 if(v!=='match')window.ZYMatchUI?.leave();closeOrderMenu();hideDetailOverlay();
 if(v==='dashboard'||v==='orders'){
  if(!options.preserveOrders){filters.orders.range=v==='dashboard'?'today':'all';filters.orders.date=''}
  view='orders';calendarExpanded=false;
 }else view=v;
 document.body.dataset.view=view;navigation();render();window.scrollTo(0,0);
}
function teamMenu(){
 $('#modal').innerHTML=`<h2>我的</h2><p><span data-user-content>${esc(sessionUser?.username)}</span> · ${sessionUser?.role==='admin'?'管理员':'员工'}</p><div class="actions"><button onclick="accountDialog()">账号设置</button><button onclick="logout()">退出</button><button data-language-toggle onclick="ZYI18n.toggle()">English</button><button onclick="$('#modal').close()">关闭</button></div><p>${esc($('#syncStatus')?.textContent||'')}</p>`;$('#modal').showModal();
}
function render(){
 document.body.dataset.view=view;
 if(view==='match')return matchView();if(view==='new')return newView();if(view==='workers')return workerView();if(view==='workerRecords')return recordsView();
 if(!$('#order-workspace')){
  $('#content').innerHTML=`<div id="order-workspace"><section class="order-list-pane" aria-label="劳务单列表"><div class="order-tools"><div class="order-heading"><h1>劳务单</h1><div class="business-clock"><time id="business-date" data-user-content></time> <span>北京时间</span></div></div><input id="order-search" type="search" placeholder="搜索职位、单号、雇主、薪资" aria-label="搜索职位、单号、雇主、薪资" value="${esc(filters.orders.q)}" oninput="queueOrderSearch(this.value)"><div class="date-segments" role="group" aria-label="日期范围"><button data-range="today" onclick="setOrderRange('today')">今天</button><button class="range-week" data-range="week" onclick="setOrderRange('week')">本周</button><button data-range="all" onclick="setOrderRange('all')">全部</button><button class="range-date" data-range="date" onclick="toggleOrderCalendar()">选日期</button></div><div id="state-chips" aria-label="状态筛选"></div><div id="order-calendar"></div></div><div class="order-table-scroll"><div class="order-table"><div class="order-grid order-table-head" aria-hidden="true"><span>单号</span><span>职位 · 雇主</span><span>月薪</span><span>性别</span><span>年龄</span><span>状态</span><span>操作</span></div><div id="results"></div></div></div><p id="list-count" class="list-count"></p></section><section id="order-detail" class="order-detail" aria-label="劳务单详情"></section></div><button class="new-order-fab" aria-label="整理新劳务单" onclick="editing=null;go('new')">＋</button>`;
 }
 if(document.activeElement!==$('#order-search'))$('#order-search').value=filters.orders.q;
 renderOrderCalendar();listRender();
}
function queueOrderSearch(value){filters.orders.q=value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(view==='orders')listRender()},200)}
function setOrderRange(range){clearTimeout(searchTimer);filters.orders.range=range;filters.orders.date='';calendarExpanded=false;renderOrderCalendar();listRender()}
function toggleOrderCalendar(){calendarExpanded=!calendarExpanded;renderOrderCalendar()}
function rangeOrders(){
 const f=filters.orders,currentDay=ZYTime.todayKey(),{start,end}=ZYTime.weekRange(currentDay);
 return orders.filter(o=>{const key=ZYTime.dateKey(o.createdAt);return f.range==='today'?key===currentDay:f.range==='week'?key>=start&&key<end:f.range==='date'?key===f.date:true});
}
function setOrderState(state){filters.orders.s=state;listRender()}
function stateBadge(state){return `<span class="state-badge state-${state}" title="${orderStateLabels[state]}">${orderStateLabels[state]}</span>`}
function rowAction(o){const state=orderState(o),id=jsValue(o.id);return `<button class="row-action action-${state}" onclick="${state==='ready'?`copyOrder(${id})`:state==='review'?`openOrderDetail(${id},'sources',this)`:`fillPrice(${id})`}">${state==='ready'?'复制':state==='review'?'核对':'填金额'}</button>`}
function card(record){
 const o=orderPublication(record).order,state=orderState(record),id=jsValue(o.id),age=String(o.age||'').replace(/\s+/g,''),gender=o.gender==='男女不限'?'不限':o.gender;
 return `<article class="order-grid order-row ${selectedOrderId===o.id?'selected':''}" data-order-id="${esc(o.id)}" data-state="${state}"><span class="row-code numeric" data-user-content title="${esc(o.code)}">${esc(o.code)}</span><button class="order-open" onclick="openOrderDetail(${id},null,this)"><span class="row-identity" data-user-content title="${esc([o.title,o.employer].filter(Boolean).join(' · '))}"><strong data-user-content>${esc(o.title)}</strong>${o.employer?`<span class="row-employer" data-user-content>${esc(o.employer)}</span>`:''}</span><span class="mobile-row-badge">${stateBadge(state)}</span><span class="mobile-row-meta numeric" data-user-content>${esc(String(o.code).replace(/^ZY-\d{2}-/,''))} · ${esc(o.salary||'—')} · ${esc(gender||'—')} · ${esc(age||'—')}</span></button><span class="row-salary numeric" ${o.salary?'data-user-content':''} title="${esc(o.salary)}">${o.salary?`<span data-user-content>${esc(o.salary)}</span>`:'未识别'}</span><span class="row-gender" data-user-content title="${esc(o.gender)}">${esc(gender)}</span><span class="row-age" data-user-content title="${esc(o.age)}">${esc(age)}</span><span class="row-status">${stateBadge(state)}</span><div class="row-actions">${rowAction(record)}<button class="row-more" aria-label="更多操作" aria-haspopup="menu" onclick="openOrderMenu(${id},this)">⋯</button></div></article>`;
}
function listRender(){
 if(view!=='orders'||!$('#results'))return;
 const active=document.activeElement,activeRow=active?.closest('.order-row'),activeClass=activeRow?(active.classList.contains('order-open')?'order-open':active.classList.contains('row-action')?'row-action':'row-more'):null;
 const f=filters.orders,range=rangeOrders(),query=String(f.q||'').trim().toLowerCase();
 const matches=range.filter(o=>{const p=orderPublication(o).order;return ['title','code','employer','salary'].some(k=>String(p[k]||'').toLowerCase().includes(query))&&(!f.s||orderState(o)===f.s)});
 $('#state-chips').innerHTML=[['','全部'],['review','需核对'],['draft','待确认金额'],['ready','可发布']].map(([state,label])=>`<button class="state-chip" data-filter-state="${state}" aria-pressed="${f.s===state}" onclick="setOrderState('${state}')"><i class="state-dot dot-${state||'all'}" aria-hidden="true"></i><span>${label}</span> <b data-user-content>${state?range.filter(o=>orderState(o)===state).length:range.length}</b></button>`).join('');
 document.querySelectorAll('[data-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.range===f.range)));
 const dateButton=$('[data-range="date"]');dateButton.textContent=f.range==='date'?f.date:'选日期';dateButton.toggleAttribute('data-user-content',f.range==='date');
 // A compact, always-visible date launcher remains available on phones after choosing All.
 document.querySelector('.date-segments').classList.toggle('show-date',f.range!=='today');
 const groups={};for(const o of matches)(groups[day(o.createdAt)]??=[]).push(o);
 $('#results').innerHTML=matches.length?Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(d=>{
  const heading=`<span data-user-content>${esc(d)}</span>${d===today()?' · <span>今天</span>':''}<span class="group-count">共 ${groups[d].length} 份</span>`;
  return f.range==='all'?`<details class="order-date-group" ${expandedOrderDates.has(d)?'open':''}><summary data-date="${esc(d)}" onclick="expandedOrderDates[this.parentElement.open?'delete':'add'](this.dataset.date)">${heading}</summary><div class="order-date-content">${groups[d].map(card).join('')}</div></details>`:`<section class="order-date-section"><h2 class="order-group-heading">${heading}</h2>${groups[d].map(card).join('')}</section>`;
 }).join(''):'<div class="empty">暂无符合条件的劳务单<br><small>整理一份新劳务单，开始今天的工作。</small></div>';
 $('#list-count').textContent=`共 ${matches.length} 份`;updateReviewCount();refreshOrderDetail();if(activeRow){const next=[...document.querySelectorAll('.order-row')].find(row=>row.dataset.orderId===activeRow.dataset.orderId);next?.querySelector('.'+activeClass)?.focus({preventScroll:true})}
}
let orderCalendarMonth=(({year,month})=>({year,month}))(ZYTime.parts(new Date()));
function orderDateKey(value){return ZYTime.dateKey(value)}
function selectOrderDate(value){filters.orders.date=value;filters.orders.range=value?'date':'all';if(value){const [year,month]=value.split('-').map(Number);orderCalendarMonth={year,month}}renderOrderCalendar();listRender()}
function moveOrderCalendar(offset){const total=orderCalendarMonth.year*12+orderCalendarMonth.month-1+offset;orderCalendarMonth={year:Math.floor(total/12),month:(total%12+12)%12+1};renderOrderCalendar()}
function renderOrderCalendar(){
 const container=$('#order-calendar');if(!container)return;
 const expanded=calendarExpanded,currentDate=ZYTime.todayKey();
 const y=orderCalendarMonth.year,m=orderCalendarMonth.month,counts={};for(const o of orders){const key=orderDateKey(o.createdAt);if(key)counts[key]=(counts[key]||0)+1}
 const info=ZYTime.monthInfo(y,m),offset=info.firstWeekday-1,total=info.daysInMonth;
 const cells=Array.from({length:offset},()=>'<span></span>');
 for(let n=1;n<=total;n++){const key=`${y}-${String(m).padStart(2,'0')}-${String(n).padStart(2,'0')}`;cells.push(`<button type="button" data-date="${key}" aria-pressed="${filters.orders.date===key}" aria-current="${key===currentDate?'date':'false'}" class="calendar-day ${key===currentDate?'calendar-today':''} ${filters.orders.date===key?'primary':''}" onclick="selectOrderDate('${key}')"><span data-user-content>${n}</span><small data-user-content>${counts[key]||'·'}</small></button>`)}
 container.innerHTML=`<details class="calendar-panel" ${expanded?'open':''} ontoggle="if(this.isConnected)calendarExpanded=this.open"><summary>按日期查找劳务单</summary><p>数字表示当天录入的单数，点击日期筛选；可同时使用搜索和状态筛选。</p><div class="calendar-controls"><button type="button" aria-label="上个月" onclick="moveOrderCalendar(-1)">‹</button><strong data-user-content>${y}-${String(m).padStart(2,'0')}</strong><button type="button" aria-label="下个月" onclick="moveOrderCalendar(1)">›</button><button type="button" onclick="selectOrderDate('')">清除日期筛选</button></div><label>选择日期<input type="date" id="order-date" value="${esc(filters.orders.date)}" onchange="selectOrderDate(this.value)"></label><div class="calendar-grid">${['周一','周二','周三','周四','周五','周六','周日'].map(n=>`<span class="calendar-weekday">${n}</span>`).join('')}${cells.join('')}</div></details>${filters.orders.date?`<p class="note"><span>当前筛选日期</span> <b data-user-content>${esc(filters.orders.date)}</b><button type="button" onclick="selectOrderDate('')">清除日期筛选</button></p>`:''}`;
}
function rememberOrderList(id){
 selectedOrderId=id;orderListReturn={filters:{...filters.orders},id,tab:detailTab,scroll:$('#detail-scroll')?.scrollTop||0,pageY:scrollY};hideDetailOverlay();
}
function restoreOrderList(){if(!orderListReturn)return;filters.orders={...orderListReturn.filters};selectedOrderId=orderListReturn.id;detailTab=orderListReturn.tab;detailScroll=orderListReturn.scroll;render();if($('#detail-scroll'))$('#detail-scroll').scrollTop=detailScroll=orderListReturn.scroll;window.scrollTo(0,orderListReturn.pageY)}
function showSavedOrder(id){
 filters.orders={q:'',s:'',range:'today',date:''};selectedOrderId=id;detailTab=orderState(orders.find(o=>o.id===id))==='review'?'sources':'company';detailScroll=0;
 const record=orders.find(o=>o.id===id);if(record)expandedOrderDates.add(day(record.createdAt));render();
 const row=[...document.querySelectorAll('.order-row')].find(e=>e.dataset.orderId===id);row?.scrollIntoView({block:'nearest',behavior:'instant'});
}
function openOrderDetail(id,tab,trigger){
 const record=orders.find(o=>o.id===id);if(!record)return;
 if(selectedOrderId!==id){detailTab=tab||(orderState(record)==='review'?'sources':'company');detailScroll=0}else if(tab)detailTab=tab;
 selectedOrderId=id;detailTriggerId=id;closeOrderMenu();
 document.querySelectorAll('.order-row').forEach(row=>row.classList.toggle('selected',row.dataset.orderId===id));refreshOrderDetail();
 if(matchMedia('(max-width:1099px)').matches){$('#order-detail [aria-label="关闭详情"]')?.focus()}else if(trigger?.classList.contains('row-action'))$('#order-detail [role="tab"][aria-selected="true"]')?.focus();
}
function hideDetailOverlay(){const overlay=$('#detail-overlay');if(!overlay?.open)return;overlay.close();const panel=$('#order-detail');if(panel&&$('#order-workspace'))$('#order-workspace').append(panel)}
function closeOrderDetail(){
 selectedOrderId=null;detailScroll=0;closeOrderMenu();hideDetailOverlay();refreshOrderDetail();document.querySelectorAll('.order-row.selected').forEach(row=>row.classList.remove('selected'));
 const row=[...document.querySelectorAll('.order-row')].find(row=>row.dataset.orderId===detailTriggerId);row?.querySelector('.order-open')?.focus();
}
function selectDetailTab(tab){detailTab=tab;detailScroll=0;refreshOrderDetail();$('#detail-tab-'+tab)?.focus()}
function detailTabKeys(event){
 const keys=['company','raw','sources'],at=keys.indexOf(event.target.closest('[role="tab"]')?.id.replace('detail-tab-','')||detailTab);let next;
 if(event.key==='ArrowRight')next=keys[(at+1)%3];if(event.key==='ArrowLeft')next=keys[(at+2)%3];if(event.key==='Home')next=keys[0];if(event.key==='End')next=keys[2];if(next){event.preventDefault();selectDetailTab(next)}
}
function refreshOrderDetail(){
 const panel=$('#order-detail');if(!panel)return;
 const record=orders.find(o=>o.id===selectedOrderId);
 if(!record){if(selectedOrderId){selectedOrderId=null;hideDetailOverlay();toast('该劳务单已被删除')}panel.innerHTML='<p class="detail-placeholder">选择一份劳务单查看详情</p>';panel.classList.remove('has-order');return}
 const sameOrder=panel.dataset.recordId===record.id,focus=document.activeElement,focusKey=panel.contains(focus)?(focus.id?'#'+focus.id:focus.classList.contains('detail-primary')?'.detail-primary':focus.classList.contains('detail-close')?'.detail-close':null):null;
 const headerScroll=sameOrder?(panel.querySelector('.detail-header')?.scrollTop||0):0,sourceOpen=sameOrder&&panel.dataset.tab===detailTab?[...panel.querySelectorAll('#detail-scroll details')].map(el=>el.open):[];
 const previousScroll=$('#detail-scroll')?.scrollTop;if(previousScroll!==undefined&&panel.dataset.recordId===record.id&&panel.dataset.tab===detailTab)detailScroll=previousScroll;panel.dataset.recordId=record.id;panel.dataset.tab=detailTab;
 const o=orderPublication(record).order,state=orderState(record),id=jsValue(o.id),reviewed=ZYOrderParser.isHumanReviewed(o);
 const content=detailTab==='company'?`<pre class="company-copy" data-user-content>${esc(publish(record))}</pre>`:detailTab==='raw'?`<pre class="source-copy" data-user-content>${esc(record.raw)}</pre>`:recognitionReviewMarkup(record,-1,true);
 panel.classList.add('has-order');panel.innerHTML=`<div class="sheet-handle" aria-hidden="true"></div><div class="detail-header"><div class="detail-code"><span class="numeric" data-user-content>${esc(o.code)}</span>${stateBadge(state)}<button class="detail-close" aria-label="关闭详情" onclick="closeOrderDetail()">×</button></div><h2 data-user-content>${esc(o.title)}</h2><div class="detail-facts">${o.employer?`<p data-user-content>${esc(o.employer)}</p>`:''}<p><span>月薪</span> <span data-user-content>${esc(o.salary||'—')}</span> · <span data-user-content>${esc(o.gender||'—')} · ${esc(o.age||'—')}</span></p><p><span>录入</span> <time data-user-content>${esc(day(o.createdAt))}</time></p><p><span>全包价</span> <b data-user-content>${esc(priceN(o.price)>0?priceFmt(o.price):'—')}</b></p></div>${reviewed?`<p class="reviewed-stamp"><span aria-hidden="true">✓ </span><span>已人工核对</span>${o.humanReviewedBy?` · <span data-user-content>${esc(o.humanReviewedBy)}</span>`:''}${o.humanReviewedAt?` · <span data-user-content>${esc(ZYTime.formatDateTime(o.humanReviewedAt))}</span> <span>北京时间</span>`:''}</p>`:''}${state==='review'?`<div class="publication-problems"><b>暂不能复制发布</b><ul>${orderPublication(record).problems.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>`:''}</div><div class="detail-tabs" role="tablist" aria-label="劳务单内容" onkeydown="detailTabKeys(event)">${[['company','公司单'],['raw','原单'],['sources','识别来源']].map(([key,label])=>`<button role="tab" id="detail-tab-${key}" aria-selected="${detailTab===key}" tabindex="${detailTab===key?'0':'-1'}" aria-controls="detail-scroll" onclick="selectDetailTab('${key}')">${label}</button>`).join('')}</div><div id="detail-scroll" role="tabpanel" aria-labelledby="detail-tab-${detailTab}" tabindex="0">${content}</div><div class="detail-actions"><button class="detail-primary ${state==='ready'?'primary':state==='review'?'review-primary':'draft-primary'}" onclick="${state==='ready'?`copyOrder(${id})`:state==='review'?`markOrderReviewed(${id})`:`fillPrice(${id})`}">${state==='ready'?'复制公司单':state==='review'?'标记已人工核对':'填写全包价'}</button><button onclick="editOrder(${id})">编辑</button><button aria-label="更多操作" aria-haspopup="menu" onclick="openOrderMenu(${id},this,true)">⋯</button></div>`;
 panel.querySelectorAll('#detail-scroll details').forEach((el,i)=>{el.open=!!sourceOpen[i]});panel.querySelector('.detail-header').scrollTop=headerScroll;$('#detail-scroll').scrollTop=detailScroll;if(focusKey)panel.querySelector(focusKey)?.focus({preventScroll:true});
 const overlay=$('#detail-overlay');if(matchMedia('(max-width:1099px)').matches){if(panel.parentElement!==overlay)overlay.append(panel);if(!overlay.open)overlay.showModal()}else if(overlay.open)hideDetailOverlay();
}
let orderMenuTrigger=null;
function openOrderMenu(id,trigger,detailOnly=false){
 const record=orders.find(o=>o.id===id);if(!record)return;const menu=$('#order-menu');orderMenuTrigger=trigger;
 menu.innerHTML=`${detailOnly?'':`<button role="menuitem" onclick="closeOrderMenu();editOrder(${jsValue(id)})">编辑公司单</button>${!ZYOrderParser.isHumanReviewed(record)?`<button role="menuitem" onclick="closeOrderMenu();markOrderReviewed(${jsValue(id)})">标记已人工核对</button>`:''}`}<button role="menuitem" class="danger" onclick="closeOrderMenu();deleteOrder(${jsValue(id)})">删除</button>`;
 // The menu belongs inside a modal detail's top layer on narrower screens.
 const owner=trigger.closest('#detail-overlay')||document.body;owner.append(menu);menu.hidden=false;
 const rect=trigger.getBoundingClientRect();menu.style.right=Math.max(8,innerWidth-rect.right)+'px';menu.style.top=Math.min(rect.bottom+4,innerHeight-menu.offsetHeight-8)+'px';menu.querySelector('button')?.focus();
}
function closeOrderMenu(){const menu=$('#order-menu');if(menu){menu.hidden=true;document.body.append(menu)}}
addEventListener('click',event=>{if(!event.target.closest('#order-menu,[aria-haspopup="menu"]'))closeOrderMenu()});
addEventListener('keydown',event=>{const menu=$('#order-menu');if(menu&&!menu.hidden){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeOrderMenu();orderMenuTrigger?.focus()}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const items=[...menu.querySelectorAll('button')],at=items.indexOf(document.activeElement);items[(at+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus()}}},true);
$('#detail-overlay').addEventListener('cancel',event=>{event.preventDefault();closeOrderDetail()});
$('#detail-overlay').addEventListener('click',event=>{if(event.target===$('#detail-overlay')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeOrderDetail()}});
matchMedia('(max-width:1099px)').addEventListener('change',()=>{if(view==='orders'&&selectedOrderId)refreshOrderDetail()});
