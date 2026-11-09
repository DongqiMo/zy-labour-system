/* UI-only localisation. Never rerenders a form or translates business data. */
(function(){
 const pairs=[
 ['公司单已人工核对','Company Order Reviewed'],['标记已人工核对','Mark as Reviewed'],
 ['原单识别自查','Source Recognition Audit'],['正在按单号核查原单…','Checking source orders by company number…'],['逐单比较原单与公司单，不自动修改资料。','Compare source and company orders without automatically changing records.'],['单据总数','Total Orders'],['需要核对','Needs Review'],['关键字段已识别','Key Fields Recognised'],['下载自查报告（含原单）','Download Audit Report (Includes Sources)'],['未找到明确来源，请核对','No clear source found; review required'],['缺少可核对来源','No Verifiable Source'],['与现有公司单不同','Differs from Current Company Order'],['查看转单预览','Preview Re-recognition'],['单据已不存在，请重新自查','Order no longer exists; run the audit again'],['自查失败，请稍后重试','Audit failed; try again later'],
 ['请选择','Select'],['出生年月','Date of Birth'],['最高学历','Highest Education'],['是否有港澳通行证','HK / Macau Travel Permit'],['现住地址','Current Address'],['原在港工作单位','Previous Hong Kong Employer'],['离职日期','Employment End Date'],['原始登记 PDF','Original Registration PDF'],['原始 PDF 无法读取，显示登记表模板','Original PDF could not be read; showing the registration template'],['请选择 PDF 文件','Choose a PDF file'],['PDF 文件不能超过20MB','PDF file must not exceed 20 MB'],['识别结果会填入当前登记表，已识别字段将被覆盖，是否继续？','Recognised values will replace matching fields in this form. Continue?'],['正在读取 PDF，请稍候…','Reading PDF. Please wait…'],['PDF 页数须为1至20页','PDF must contain between 1 and 20 pages'],['正在识别 PDF，请核对后保存','Recognising PDF. Review the results before saving'],['正在识别扫描件，请稍候…','Recognising a scanned document. Please wait…'],['未识别到填写内容，请使用清晰的登记表 PDF','No filled fields recognised. Use a clear registration PDF'],['PDF 已识别，请逐项核对后保存','PDF recognised. Review each field before saving'],['PDF 识别失败，当前资料未改变','PDF recognition failed. Existing form data was not changed'],['PDF 识别失败，请稍后重试','PDF recognition failed. Try again later'],
 ['已排除内容与原因','Excluded Content and Reasons'],['上家全包报价','Supplier Package Quote'],['上家收费信息','Upstream Fee Information'],['上家尾部报价','Supplier Footer Quote'],['无标签金额或算式','Unlabelled Amount or Expression'],['宣传提示','Promotional Heading'],['已排除','Excluded'],['冲突内容','Conflicting Content'],['已核对未分类和冲突内容，必要信息已补入公司单','I reviewed unclassified and conflicting text and added necessary information to the company order'],['请先核对未分类或冲突内容并确认','Review unclassified or conflicting content and confirm before publication'],
 ['搜索岗位或公司单号','Search job title or company order number'],['按日期查找劳务单','Find Orders by Date'],['数字表示当天录入的单数，点击日期筛选；可同时使用搜索和状态筛选。','Counts show orders entered on each date. Combine a date with search and status filters.'],['选择日期','Select Date'],['清除日期筛选','Clear Date Filter'],['当前筛选日期','Selected Date'],['上个月','Previous Month'],['下个月','Next Month'],['周一','Mon'],['周二','Tue'],['周三','Wed'],['周四','Thu'],['周五','Fri'],['周六','Sat'],['周日','Sun'],
 ['劳务单','Labour Orders'],['劳工信息','Worker Information'],
 ['字段来源与待核对清单','Field Sources and Review Checklist'],['来源为识别时的原文片段；手动修改后请重新核对。','Sources show recognised text excerpts. Review again after manual changes.'],['未发现额外核对项目，仍请确认识别结果。','No additional review items found. Please still verify the results.'],['未分类内容','Unclassified Content'],['未识别年龄要求，请核对原单','Age requirement not recognised. Check the source.'],['未识别工作时间，请核对原单','Working hours not recognised. Check the source.'],['休息周期不明确，请确认是每周还是每月','Rest period is unclear. Confirm whether it is weekly or monthly.'],['部分原单内容尚未分类，请核对未分类内容','Some source text is unclassified. Review the unclassified content.'],
 ['卓亚港澳劳务','ZY Hong Kong & Macau Labour'],['卓亚港澳劳务系统','ZY Labour Management System'],['工作台 /','Workspace /'],['工作台','Workspace'],
 ['今日劳务单总览','Today’s Orders'],['劳务单数据库','Order Database'],['劳工登记表','Worker Registration'],['已登记劳工','Registered Workers'],['整理新劳务单','Prepare New Order'],['编辑公司单','Edit Company Order'],
 ['每一份机会，都值得认真整理。掌握今日劳务单进度。','Organise every opportunity. Track today’s order progress.'],['所有劳务单集中管理，原单与公司单随时核对。','Manage all orders and compare source and company versions.'],
 ['＋ 整理新劳务单','＋ Prepare New Order'],['今日劳务单总数','Total Orders Today'],['待确认备注金额','Fee Note Amount Awaiting Confirmation'],['今日已完成劳务单','Completed Orders Today'],['今日录入的全部劳务单','All orders entered today'],['核对价格后即可生成发布稿','Confirm pricing to prepare the release'],['公司单已就绪，可直接复制发布','Company copy is ready to share'],
 ['搜索岗位','Search job title'],['全部状态','All statuses'],['已生成发布稿','Release Ready'],['今日劳务单','Today’s Orders'],['全部劳务单','All Orders'],['暂无符合条件的劳务单','No matching orders'],['整理一份新劳务单，开始今天的工作。','Prepare a new order to get started.'],
 ['备注金额（劳务，服务费管理费）','Fee note amount (labour and service management)'],
 ['月薪','Monthly salary'],['性别','Gender'],['年龄','Age'],['录入','Entered'],['雇主未填写','Employer not provided'],['未填写','Not provided'],['备注金额','Fee Note Amount'],['待确认','Awaiting confirmation'],['填写备注金额 ↗','Enter Fee Note ↗'],['原单 · 查看原始内容','Source Order · View Original'],['公司单 · 查看发布文案','Company Order · View Release'],['复制公司单','Copy Company Order'],['删除','Delete'],
 ['移除上游编号，核对原单，再生成清晰的公司发布稿。','Remove upstream references, review the source and prepare company copy.'],['返回列表','Back to List'],['录入原单','Enter Source'],['确认信息','Review Details'],['确认备注金额并生成','Confirm Fee Note and Save'],['单条录入','Single Entry'],['批量录入','Batch Entry'],['粘贴微信群原单','Paste Source Order'],['原单（保留不变）','Source Order (Unchanged)'],['自动移除上游单号；请逐项核对识别结果。','Upstream references are removed. Check every recognised field.'],['✧ 自动整理','✧ Auto Organise'],['自动整理','Auto Organise'],['薪资保持原单格式；备注金额可留空，保存后进入待确认。','Salary keeps its source format. Leave the ZY price blank to save a draft.'],['核对公司单信息','Review Company Order'],['保存修改','Save Changes'],['保存劳务单','Save Order'],
 ['公司单号','Company Order No.'],['职位名称','Job Title'],['雇主','Employer'],['薪资待遇（月薪）','Salary (Monthly)'],['招聘性别','Recruitment Gender'],['年龄要求','Age Requirement'],['语言要求','Language Requirement'],['工作时间','Working Hours'],['班次','Shift'],['面试方式 / 时间','Interview Method / Time'],['每月休息','Monthly Days Off'],['工作内容','Job Duties'],['工作要求','Job Requirements'],['其他备注','Other Notes'],['请选择招聘性别','Select recruitment gender'],['例如 3.8w，可留空','e.g. 3.8w; may be left blank'],
 ['批量粘贴原单','Paste Multiple Source Orders'],['多份原单之间使用独立的 ---、“下一单”或“第 N 单”分隔。','Separate source orders with a line containing ---, 下一单 or 第 N 单.'],['在此粘贴多份微信群原单…','Paste multiple source orders here…'],['识别并预览','Recognise and Preview'],['请先粘贴并识别原单，再逐份核对全部字段。','Paste and recognise source orders, then review every field in each item.'],['核对原单','Review Source Order'],['自动整理当前原单','Organise Current Source'],['移除此份','Remove This Item'],['重新粘贴全部原单','Replace All Source Orders'],['每份均可修改全部字段，填写全包价后按价格判定状态。','Edit every field for each item. Its ZY price determines draft or ready status.'],['上一份','Previous Item'],['下一份','Next Item'],['保存全部劳务单','Save All Orders'],['没有可保存的原单','No source orders to save'],
 ['确认备注金额','Confirm Fee Note Amount'],['例如 3.8w；空或0为待确认','e.g. 3.8w; blank or 0 remains a draft'],['取消','Cancel'],['保存价格','Save Price'],['确定删除这份劳务单？删除后无法恢复。','Delete this order? This cannot be undone.'],
 ['PDF识别','Recognise PDF'],['下载资料备份','Download Backup'],['＋ 新建登记','＋ New Registration'],['资料与照片保存在团队服务器，授权账号可共同查看与修改。录入前请取得本人授权，并定期备份。','Records and photos are shared with authorised team members. Obtain consent before entry and back up regularly.'],['＋ 上传或拖放劳工照片','＋ Upload or Drop Worker Photo'],['支持图片，自动压缩后保存至团队服务器','Images are compressed before saving to the team database'],['移除照片','Remove Photo'],['＋ 上传照片','＋ Upload Photo'],
 ['基本信息','Basic Information'],['姓名','Name'],['出生日期','Date of Birth'],['身高（cm）','Height (cm)'],['体重（kg）','Weight (kg)'],['婚姻状况','Marital Status'],['籍贯','Hometown'],['健康状况','Health'],['学历','Education Level'],['港澳通行证','HK / Macau Travel Permit'],['身份证号码','ID Number'],['身份证有效期','ID Validity'],['身份证地址','ID Address'],['现居地址','Current Address'],
 ['香港劳务经历','Hong Kong Work Experience'],['是否曾来港从事劳务','Previously Worked in Hong Kong'],['香港雇主','Hong Kong Employer'],['离港日期','Hong Kong Departure Date'],['语言及技能','Languages and Skills'],['粤语能力','Cantonese Proficiency'],['普通话能力','Mandarin Proficiency'],['英语能力','English Proficiency'],['其他语言','Other Languages'],['专业证书','Certificates'],['特长爱好','Skills and Hobbies'],
 ['求职意向与联系方式','Job Preferences and Contact Details'],['第一求职意向','First Job Preference'],['第二求职意向','Second Job Preference'],['第三求职意向','Third Job Preference'],['期望薪金','Expected Salary'],['联系电话','Phone'],['备用联系人','Alternate Contact'],['教育及培训（最多2条）','Education and Training (Up to 2)'],['＋ 添加教育经历','＋ Add Education'],['工作经历（最多4条）','Work Experience (Up to 4)'],['＋ 添加工作经历','＋ Add Work Experience'],['预览登记表','Preview Registration'],['保存登记资料','Save Registration'],
 ['起止年月','Period'],['学校 / 培训机构','School / Training Provider'],['专业','Major'],['学历 / 资格','Qualification'],['职位','Position'],['工作事项简介','Duties Summary'],['移除','Remove'],['求职意向未填写','Job preference not provided'],['编辑','Edit'],['更新于','Updated'],['暂无已登记劳工，点击「新建登记」添加资料。','No registered workers. Choose New Registration to add one.'],['团队共享资料','Shared Team Records'],['确定删除该劳工资料？删除后无法恢复。','Delete this worker record? This cannot be undone.'],
 ['返回修改','Back to Edit'],['打印 / 保存为 PDF','Print / Save as PDF'],['当前为重建版式；尚未取得原登记表背景模板。','Reconstructed layout; the original form background is not available.'],['教育及培训','Education and Training'],['工作经历','Work Experience'],['PDF 模板识别尚待迁移','PDF Template Recognition Pending'],['文件未附原登记表背景图、识别坐标及原有识别代码，当前版本无法准确还原固定模板 PDF 识别。请先手动填写并核对资料。','The original template assets and recognition code are unavailable. Enter and check records manually for now.'],['当前PDF识别尚未实现。','PDF recognition is not yet implemented.'],['返回登记表','Back to Registration'],
 ['用心连接每一份工作','Connecting people with opportunities'],['团队共享 · 登录后可访问','Team Workspace · Sign-in Required'],['账号设置','Account Settings'],['退出','Sign Out'],['管理员','Administrator'],['员工','Staff'],['团队资料已连接','Team database connected'],['团队资料已同步','Team data synced'],['维护中 · 只读，已暂停写入','Maintenance · Read-only'],['连接中断，正在重试；请勿关闭未保存表单','Connection lost; retrying. Keep unsaved forms open.'],
 ['ZY LABOUR SYSTEM · 团队工作台','ZY LABOUR SYSTEM · TEAM WORKSPACE'],['登录后与团队共同管理劳务单及劳工资料。','Sign in to manage orders and worker records with your team.'],['账号','Account'],['团队账号邮箱','Team account email'],['密码','Password'],['登录工作台','Sign In'],['账号由管理员开通。请勿在公共设备保存密码。','Accounts are created by an administrator. Do not save passwords on public devices.'],
 ['修改密码','Change Password'],['当前密码','Current Password'],['新密码（至少12个字符）','New Password (At Least 12 Characters)'],['确认新密码','Confirm New Password'],['修改并重新登录','Change Password and Sign In Again'],['团队账号','Team Accounts'],['读取中…','Loading…'],['开通新账号','Create Team Account'],['初始密码（至少12个字符）','Initial Password (At Least 12 Characters)'],['角色','Role'],['员工（管理共享订单和劳工资料）','Staff (Manage Shared Orders and Workers)'],['管理员（另可管理账号）','Administrator (Also Manage Accounts)'],['开通账号','Create Account'],['备份与迁移','Backup and Migration'],['读取维护状态…','Loading maintenance status…'],['暂停业务写入','Pause Business Writes'],['恢复业务写入','Resume Business Writes'],['迁移前暂停写入，再导出最终备份。暂停后仍可查看资料。','Pause writes before exporting a final migration backup. Records remain readable.'],['导出完整业务资料','Export All Business Data'],['恢复到空数据库','Restore to Empty Database'],['包含订单、劳工、照片及附件；不包含账号密码。JSON可迁移至其他数据库。','Includes orders, workers, photos and attachments; excludes passwords. Portable JSON supports database migration.'],['导入本浏览器旧资料','Import Legacy Browser Records'],['手动确认后才上传；仅适用于同一浏览器和原网站来源内的旧资料，不覆盖现有记录。','Uploads only after confirmation. Limited to legacy data on this browser and origin; existing records are not overwritten.'],['关闭','Close'],['当前：已暂停写入（只读）','Current: Writes Paused (Read-only)'],['当前：正常读写','Current: Read / Write'],['使用中','Active'],['已停用','Disabled'],['停用','Disable'],
 ['等待动画，非实际处理百分比','Waiting animation, not actual processing percentage'],['正在整理，请稍候','Organising, please wait'],
 ['整理进度','Recognition progress'],['阶段进度，非模型计算百分比','Stage progress, not model computation percentage'],['读取原单','Reading source'],['规则识别','Applying rules'],['检查AI连接','Checking AI connection'],['等待AI返回','Waiting for AI response'],['核对识别结果','Checking results'],['整理已停止','Recognition stopped'],['整理未完成，请重试','Recognition incomplete. Try again.'],
 ['请先粘贴原单','Paste a source order first'],['整理完成，请核对各项信息','Organised. Review all recognised details.'],['请填写原单、职位名称和公司单号','Enter the source order, job title and company order number'],['请选择招聘性别：男、女或男女不限','Select a recruitment gender: 男, 女 or 男女不限'],['公司单号格式应为 ZY-年份-月日-流水，例如 ZY-26-1103-01','Use ZY-YY-MMDD-NN, for example ZY-26-1103-01'],['公司单号已存在，请修改','Company order number already exists; change it'],['劳务单已保存','Order saved'],['批量劳务单已保存','Batch orders saved'],['价格已保存','Price saved'],['公司单已复制','Company order copied'],['复制失败，请展开公司单选择文字复制','Copy failed. Expand the company order and copy the text manually.'],['请先编辑公司单，选择男、女或男女不限后再复制','Edit the company order and select 男, 女 or 男女不限 before copying'],['每份原单都必须有职位名称','Every source order needs a job title'],
 ['请选择图片文件','Choose an image file'],['图片无法读取，请更换图片','Cannot read this image; choose another'],['请填写姓名','Enter the worker’s name'],['劳工资料已保存','Worker record saved'],['已达到经历条数上限','Maximum number of history entries reached'],['共享资料读取失败，请检查连接并刷新重试。','Cannot load shared records. Check the connection and refresh.'],
 ['两次输入的新密码不一致','The new passwords do not match'],['密码已修改，请使用新密码登录','Password changed. Sign in with your new password.'],['账号已开通，请通过安全方式告知同事初始密码','Account created. Share the initial password securely.'],['停用此账号并立即撤销其登录？','Disable this account and block its business access?'],['暂停所有业务资料写入，以便备份迁移？','Pause all business writes for backup or migration?'],['恢复业务写入？','Resume business writes?'],['维护状态已更新','Maintenance setting updated'],['完整备份已生成，请保存到私人位置','Complete backup generated. Keep it in a private location.'],['请等当前保存完成再导入','Wait for the current save before importing'],['文件超过32MB，请使用迁移工具分配更合适的传输方式','File exceeds 32 MB. Use a suitable database migration tool.'],['备份格式或版本不支持','Unsupported backup format or version'],['备份无法读取，未恢复','Cannot read backup; nothing restored'],
 ['已退出登录','Signed out'],['登录已过期，请重新登录','Session expired. Sign in again.'],['登录已过期，请重新登录。','Session expired. Sign in again.'],['账号或密码错误','Incorrect account or password'],['账号未获团队授权、已停用或权限不足','Account is not authorised, is disabled or has insufficient permissions'],['其他人已修改订单，请先刷新列表并重新核对，当前修改尚未保存','Someone changed the orders. Reload and review before saving. Your changes are not saved.'],['其他人已修改此资料，请重新打开核对，当前修改尚未保存','Someone changed this record. Reopen and review it before saving.'],['系统正在维护或迁移，已暂停写入；当前输入尚未保存','Writes are paused for maintenance or migration. Your input has not been saved.'],['云端尚未配置','Cloud connection is not configured'],['服务器响应异常，请稍后重试','Unexpected server response; try again later'],['请求失败','Request failed'],['操作失败，请稍后重试','Operation failed; try again later'],
 ['简体转换库未加载，原文暂按输入保存，请核对繁体字段','Text conversion is unavailable. The entered source is retained; check traditional Chinese fields.'],['本浏览器没有可导入的旧资料（示例订单不导入）','No legacy records to import; example orders are excluded'],['旧订单格式异常，未上传','Invalid legacy order format; nothing uploaded'],['旧劳工资料无法读取，未上传','Cannot read legacy worker records; nothing uploaded']
,
 ["检测到多份原单，请使用批量录入或拆分后处理", "Multiple source orders detected. Use batch entry or split the source first."],
 ["表单已修改，未覆盖人工内容", "The form changed. Human edits were retained."],
 ["AI与规则结果有差异，请核对原文", "AI and rule results differ. Review the source."],
 ["AI暂不可用，已保留规则识别结果", "AI is unavailable. Rule recognition has been retained."],
 ["检查原单识别结果，不比较或修改人工公司单。", "Check source recognition without comparing or modifying human-edited company orders."],
 ["未找到明确原文依据", "No clear source evidence found"],
 ["识别到多个雇主名称，请人工核对", "Multiple employer names detected. Review them manually."],
 ["识别到多组薪资，请人工核对或拆分原单", "Multiple salary values detected. Review manually or split the source."],
 ["未可靠识别职位，请人工核对", "Job title is uncertain. Review it manually."],
 ["性别不明确或有冲突，请人工选择", "Recruitment gender is missing or conflicting. Select it manually."],
 ["未可靠识别主薪资，请人工核对", "Main salary is uncertain. Review it manually."],
 ["按原单重新识别（预览）", "Recognise Source Again (Preview)"],
 ["已生成重新识别预览，核对后保存才会修改公司单", "Recognition preview is ready. Review and save to update this company order."],
 ["转到批量处理", "Switch to Batch Entry"],
 ["公司单号格式应为 ZY-年份-月日-流水，可附上家字母", "Use ZY-YY-MMDD-NN, optionally followed by the supplier’s full letter prefix."],
 ["公司单不能含原单字段括号", "Company orders cannot contain source label brackets."],
 ["公司单不能含完整上家编号，只保留单号后的上家字母", "Keep only the supplier’s full letter suffix, not its full source reference."],
 ["公司单仍有原单报价或费用信息，请核对", "Upstream pricing or fees remain. Review the company order."],
 ["这份原单需要重新核对，暂不能生成发布稿", "Review this source order before generating a release."]
 ];
 const dictionary=new Map(pairs),originals=new WeakMap(),lastValues=new WeakMap(),attributeOriginals=new WeakMap();
 let language='zh';try{language=localStorage.getItem('zy-ui-language-v1')==='en'?'en':'zh'}catch{}
 function translate(text){
  if(language!=='en')return text;
  const source=String(text),trimmed=source.trim();let translated=dictionary.get(trimmed);
  if(translated===undefined){
   let match;
   if(trimmed.endsWith(' *')&&dictionary.has(trimmed.slice(0,-2)))translated=dictionary.get(trimmed.slice(0,-2))+' *';
   else if((match=trimmed.match(/^([◫▤▧♙]\s*)(.*)$/))&&dictionary.has(match[2]))translated=match[1]+dictionary.get(match[2]);
   else if((match=trimmed.match(/^((?:0?\d+\s*\/\s*|[①②③]\s*))(.*)$/))&&dictionary.has(match[2]))translated=match[1]+dictionary.get(match[2]);
   else if((match=trimmed.match(/^第 (\d+) 份，共 (\d+) 份$/)))translated=`Item ${match[1]} of ${match[2]}`;
   else if((match=trimmed.match(/^第 (\d+) 份$/)))translated=`Item ${match[1]}`;
   else if((match=trimmed.match(/^第 (\d+) 份：([\s\S]+)$/)))translated=`Item ${match[1]}: ${translate(match[2])}`;
   else if((match=trimmed.match(/^共 (\d+) 份资料 · 团队共享资料$/)))translated=`${match[1]} records · Shared Team Records`;
   else if((match=trimmed.match(/^共 (\d+) 份$/)))translated=`${match[1]} orders`;
   else if(trimmed==='份')translated='orders';
   else if((match=trimmed.match(/^(录入|更新于)\s+(.+)$/)))translated=`${dictionary.get(match[1])} ${match[2]}`;
   else if(trimmed.includes('·')){const parts=trimmed.split('·');if(parts.some(p=>dictionary.has(p.trim())))translated=parts.map(p=>dictionary.get(p.trim())||p.trim()).join(' · ')}
  }
  return translated===undefined?source:source.replace(trimmed,translated);
 }
 const protectedSelector='[data-user-content],pre,textarea,input,script,style,#date,#login-date,[data-language-toggle]';
 function protectedNode(node){return node.parentElement?.closest(protectedSelector)}
 function localise(){
  observer.disconnect();
  try{
   const modal=document.getElementById('modal');if(modal?.open&&!modal.querySelector('[data-language-toggle]')){const button=document.createElement('button');button.type='button';button.className='dialog-language no-print';button.dataset.languageToggle='';button.onclick=()=>window.ZYI18n.toggle();modal.prepend(button)}
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){
    if(protectedNode(node)||!node.nodeValue.trim())continue;
    const current=node.nodeValue;
    if(!originals.has(node)||current!==lastValues.get(node))originals.set(node,current);
    const next=translate(originals.get(node));if(current!==next)node.nodeValue=next;lastValues.set(node,next);
   }
   document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element=>{
    if(element.closest('[data-user-content]'))return;
    let values=attributeOriginals.get(element);if(!values){values={};attributeOriginals.set(element,values)}
    for(const key of ['placeholder','title','aria-label'])if(element.hasAttribute(key)){
     const current=element.getAttribute(key);if(!values[key]||current!==values[key].last)values[key]={original:current};
     const next=translate(values[key].original);element.setAttribute(key,next);values[key].last=next;
    }
   });
   document.documentElement.lang=language==='en'?'en':'zh-CN';document.title=language==='en'?'ZY Labour Management System':'卓亚港澳劳务系统';
   const narrow=matchMedia('(max-width:640px)').matches,options={year:'numeric',month:narrow?'short':'long',day:'numeric',...(narrow?{}:{weekday:'long'})};
   const date=new Date().toLocaleDateString(language==='en'?'en-CA':'zh-CN',options);
   for(const id of ['date','login-date'])if(document.getElementById(id))document.getElementById(id).textContent=date;
   document.querySelectorAll('[data-language-toggle]').forEach(button=>{button.textContent=language==='en'?'中文':'English';button.setAttribute('aria-label',language==='en'?'Switch interface to Chinese':'切换界面为英文');button.setAttribute('aria-pressed',String(language==='en'))});
   const loginTools=document.getElementById('login-language');if(loginTools)loginTools.hidden=!document.getElementById('login');
  }finally{observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','hidden']})}
 }
 let queued=false;
 const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;localise()})});
 window.ZYI18n={get language(){return language},translate,apply:localise,toggle(){language=language==='en'?'zh':'en';try{localStorage.setItem('zy-ui-language-v1',language)}catch{}localise()}};
 const tools=document.createElement('div');tools.id='login-language';tools.hidden=true;tools.innerHTML='<span id="login-date"></span><button type="button" data-language-toggle onclick="ZYI18n.toggle()">English</button>';document.body.append(tools);
 const nativeConfirm=window.confirm.bind(window);window.confirm=message=>nativeConfirm(translate(message));
 window.addEventListener('resize',()=>localise());localise();
})();
