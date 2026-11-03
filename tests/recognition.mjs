// Synthetic regression documents exercise formats, not production customer records.
import assert from 'node:assert/strict';
import '../dist/order-parser.js';
const P=ZYOrderParser;
const cutting=`能出席过港面试报名选表，需附斩鸡去骨砧板刀工视频
岗位【QY-20991234砧板师傅】（发简历时附砧板刀工的视频）
（批文厨房帮工）
工作职责：
协助厨房日常运作，准备食材，斩鸡去骨、切肉类菜类，保持厨房清洁
工作要求：
1.男性，30-40岁，有厨房及砧板切配工作经验
2.粤语流利，有责任心，服从管理
3.工作时间：10.5小时（11:00-22:00排班）（含吃饭休息时间），上6休1，满三个月做得好
有奖金跟劳工假
4.薪资待遇：$19000，包吃2餐，住宿扣实际住宿费2500
5.地址：港九新界（需调店）
31000`;
const cut=P.parse(cutting,'ZY-26-1103-13');
assert.equal(cut.title,'砧板师傅');assert.equal(cut.gender,'男');assert.equal(cut.age,'30-40岁');assert.match(cut.salary,/^\$19000/);assert.equal(cut.code,'ZY-26-1103-13 QY');assert.equal(cut.sourcePrefix,'QY');assert.equal(cut.rest,'上6休1');
assert.match(cut.hours,/10\.5小时/);assert.match(cut.hours,/11:00-22:00/);assert(!cut.hours.includes('上6休1'));assert(!cut.hours.includes('奖金'));
assert.match(cut.notes,/批文厨房帮工/);assert.match(cut.notes,/包吃2餐/);assert.match(cut.notes,/住宿/);assert.match(cut.salary,/奖金/);assert.match(cut.salary,/劳工假/);assert.match(cut.salary,/满三个月.*有奖金/);
assert.match(cut.interview,/过港面试/);assert.match(cut.interview,/视频/);assert.match(cut.workContent,/准备食材/);assert(!cut.requirements.includes('工作时间'));assert(!cut.requirements.includes('19000'));
assert(!cut.raw.includes('QY-20991234'));assert(cut.raw.includes('31000'));assert.deepEqual(P.validateCompany(cut,true),[]);
for(const field of ['title','salary','notes','requirements','workContent','interview'])assert(!/[【】\[\]［］]/.test(cut[field]));
assert(cut.notes.includes('2500'));
// Field order changes, paragraph bodies remain associated with their labels.
const blocks=['岗位【AB-20992345电工】','工作要求：\n1.女性，25-45岁\n2.普通话流利，有5年经验','薪资待遇：HKD 20,000（底薪18,000+津贴2,000），包工作餐，住宿扣2500','工作时间：\n10.5小时，每周6天，上6休1','工作职责：\n维修电路\n检查设备','面试方式：视频面试，需附证书'];
for(let shift=0;shift<blocks.length;shift++)for(const reverse of [false,true]){
 const arrangement=blocks.slice(shift).concat(blocks.slice(0,shift));if(reverse)arrangement.reverse();
 const order=P.parse(arrangement.join('\n'),'ZY-26-1103-15');
 assert.equal(order.title,'电工');assert.equal(order.gender,'女');assert.equal(order.salary,'HKD 20,000；底薪18,000+津贴2,000');assert.equal(order.rest,'上6休1');assert.match(order.hours,/10\.5小时/);assert.match(order.salary,/津贴2,000/);assert.match(order.workContent,/维修电路/);assert.match(order.interview,/视频面试/);assert.equal(order.code,'ZY-26-1103-15 AB');
 assert.deepEqual(P.validateCompany(order,true),[]);
}
const two=`侍应生 男女不限 35岁以下 粤语
工资待遇：17500HKD 有工作餐 住宿扣2500
工作时间：每周6天*10小时班
总价30500元含劳务办证，保险另计

粤菜厨师 男 45岁以下 粤语
工资待遇：21000HKD 有工作餐 住宿扣2500
工作时间：每周6天*10小时班
要求：会海鲜类的中餐，有管理经验优先
总价30500元含劳务办证，保险另计`;
const separated=P.splitOrders(two);assert.equal(separated.length,2);const pair=separated.map(raw=>P.parse(raw,'ZY-26-1103-20'));
assert.deepEqual(pair.map(o=>o.title),['侍应生','粤菜厨师']);assert.deepEqual(pair.map(o=>o.gender),['男女不限','男']);assert.deepEqual(pair.map(o=>o.salary),['17500HKD','21000HKD']);assert.deepEqual(pair.map(o=>o.age),['35岁以下','45岁以下']);
assert(!pair[0].requirements.includes('海鲜'));assert(pair[1].requirements.includes('海鲜'));
assert(P.parse(two).needsSplit);assert(P.analyze(two).order===null);
assert.equal(P.splitOrders(two.replace(/\n\n/,'\n---\n')).length,2);
assert.equal(P.splitOrders('AT-1234\n岗位：厨师\n工资：HKD18000\nAT-5678\n岗位：司机\n工资：HKD19000').length,2);
assert.equal(P.splitOrders('岗位：厨师\n薪资：18000/月\n工作内容：\n厨房工作\n\n厨师有经验优先').length,1);
const ambiguous=P.analyze('岗位：厨师\n性别：男\n性别：女\n薪资：18000/月\n月薪：19000/月','ZY-26-1103-01');assert.equal(ambiguous.order.gender,'');assert.equal(ambiguous.order.salary,'');assert(ambiguous.warnings.length>=2);
for(const [value,prefix]of [['QY-20991234','QY'],['XR80080','XR'],['ABC-20991234','ABC'],['AT-12345','AT']]){
 const source=`岗位【${value}维修技工】\n性别：男\n月薪：HKD19000`;
 assert.equal(P.sourcePrefix(source),prefix);assert(!P.sanitizeRaw(source).includes(value));assert.equal(P.parse(source,'ZY-26-1103-21').code,'ZY-26-1103-21 '+prefix);
}
assert.equal(P.sourcePrefix('月薪HKD19000\n需ISO9001知识\n驾驶B737设备'),'');assert(P.sanitizeRaw('月薪HKD19000\n需ISO9001知识').includes('HKD19000'));
const manual=P.sanitizeCompany({code:'ZY-26-1103-23 QY',title:'【电工】',sourcePrefix:'QY',gender:'男',salary:'$20000，津贴$500，住宿扣2500',price:'4.2w',notes:'【奖金】2000元；全包价格23800；保险另计',raw:'保留原单23800'});
assert.equal(manual.title,'电工');assert.match(manual.salary,/^\$20000/);assert.match(manual.salary,/津贴\$500/);assert.match(manual.salary,/奖金2000元/);assert(!/23800|保险/.test(manual.notes));assert.match(manual.notes,/2500/);assert.equal(manual.price,'4.2w');assert.equal(manual.raw,'保留原单23800');assert.deepEqual(P.sanitizeCompany(manual),manual);
console.log('PASS: whole-document classification, 12 reordered formats, compact job/source IDs, paragraph gender, pay-component notes, cycles, interview preparation, multi-order guard and price confidentiality');
for(const title of ['男装店销售','女性健康顾问','男性服装销售']){
 const order=P.parse(`岗位：${title}\n工资：HKD19000`,'ZY-26-1103-24');
 assert.equal(order.title,title);assert.equal(order.gender,'');
}
assert.equal(P.parse('岗位：服务员男女不限35岁以下粤语\n工资：17500HKD').title,'服务员');
assert(!P.cleanCompanyText('含23800劳务费').includes('23800'));
for(const text of ['包吃2餐，HKD19000，住宿扣2500','有工作餐 17500HKD，住宿扣2500']){
 const pay=P.extractPay(text);assert(/19000|17500/.test(pay.salary));assert(!pay.salary.includes('2500'));assert(pay.notes.join('').includes('2500'));assert(pay.notes.join('').match(/工作餐|包吃2餐/));
}
for(const [left,right]of [['【','】'],['[',']'],['［','］'],['「','」'],['『','』'],['〔','〕']]){
 const order=P.parse(`${left}岗位名称${right}电工\n${left}工资标准${right}HKD19000\n${left}性别要求${right}男`,'ZY-26-1103-25');
 assert.equal(order.title,'电工');assert.equal(order.salary,'HKD19000');assert.equal(order.gender,'男');
}
const benefitInRequirements=P.parse('岗位：司机\n工作要求：男，35岁以下，年终奖金2000元\n工资：HKD19000','ZY-26-1103-26');
assert(!benefitInRequirements.requirements.includes('2000'));assert(benefitInRequirements.salary.includes('2000元'));
const distantSalary='岗位：厨师\n工资：HKD18000\n\n司机 男 40岁以下\n工作要求：\n'+Array.from({length:25},(_,i)=>`${i+1}.相关工作经验`).join('\n')+'\n工资：HKD19000';
assert.equal(P.splitOrders(distantSalary).length,2);
assert.equal(P.splitOrders('岗位：厨师\n工资：HKD18000\n岗位：电工\n工作要求：有经验').length,2);

// Decorative prefixes must not obstruct classification or disclose supplier costs.
for(const bullet of ['·','•','●','✅','👉','- ']){
 const raw=`新单\n视频面试\nCV998877HK工厂食品加工HK16888+\n${bullet}男，50岁内，粤语\n${bullet}10H，休4，轮班\n${bullet}住扣10%（必须住）\n${bullet}主要做急冻食品\n${bullet}能接受0-4度室温工作\n💰2K+2.64办证保险另计（劳务费800）`;
 const o=P.parse(raw,'ZY-26-1103-15');
 assert.equal(o.title,'食品加工');assert.equal(o.gender,'男');assert.equal(o.age,'50岁内');assert.equal(o.hours,'10H；轮班');assert.equal(o.salary,'HK16888+');assert.equal(o.code,'ZY-26-1103-15 CV');assert.match(o.workContent,/0-4度/);
 assert.doesNotMatch(JSON.stringify({...o,raw:'',parsedSnapshot:'',recognitionAudit:''}),/2K|2\.64|800/);
}
for(const tail of ['22000+3500+1100','3.2w','💰2K+2.64办证保险另计']){
 const o=P.parse(`【职位】销售员\n【工资】16888\n【要求】女，18-40岁\n【工作要求】一年销售经验【工作内\n容】整理商品\n${tail}`,'ZY-26-1103-16');
 assert.equal(o.salary,'16888');assert.equal(o.workContent,'整理商品');assert.doesNotMatch(o.requirements,/22000|3500|1100|3\.2|2K|工作内容/);
}
console.log('PASS: decorative bullets, compact HK headers, supplier expressions, inline/wrapped labels, legitimate temperatures and salaries');

for(const label of ['职位薪酬','職位薪酬','职位薪资','職位薪資','岗位薪酬','崗位薪酬']){
 for(const amount of ['HK$28000+','HK$28,000/月','HKD28000+','HK28000+']){
  const o=P.parse(`[职位名称]货车司机\n[${label}]${amount}\n[性别要求]男\n[工作内容]负责运输\n劳务费700/月，办证1200，保险600`,'ZY-26-1103-28');
  assert.equal(o.salary,amount);assert.doesNotMatch(o.notes,/HK|700|1200|600/);
 }
}
assert.equal(P.extractPay('包吃两餐，HK$28000+').salary,'HK$28000+');
assert.equal(P.cleanCompanyText('HK$28000'),'');
console.log('PASS: simplified/traditional position pay labels and complete HK$ currency preserve original salary without leaking fees');

const payrollSource='岗位：司机\n性别：男\n年龄：35岁以下\n工资：HK$26000+，津贴HK$500，住宿扣2500\n奖金：考核合格每月2000元\n工作时间：10H\n休息：休4\n备注：餐费扣款600；劳务费3000；全包35000\n需准备个人资料\n22000+3000+1176';
const payroll=P.analyze(payrollSource,'ZY-26-1103-32');
assert.match(payroll.order.salary,/^HK\$26000\+；津贴HK\$500/);assert.match(payroll.order.salary,/奖金：考核合格每月2000元/);
assert.match(payroll.order.notes,/住宿扣2500/);assert.match(payroll.order.notes,/餐费扣款600/);
for(const key of ['salary','notes','requirements','workContent'])assert.doesNotMatch(payroll.order[key],/3000|35000|1176|全包/);
assert.deepEqual(P.validateCompany(payroll.order,true),[]);assert.deepEqual(P.sanitizeCompany(payroll.order),payroll.order);
assert(payroll.sources.salary.some(line=>line.includes('HK$26000+')));assert(payroll.warnings.some(line=>line.includes('休息周期')));assert(P.analyze('待核对附加信息\n岗位：司机\n性别：男\n工资：18000/月','ZY-26-1103-32').unclassified.includes('待核对附加信息'));
const unsafeDeduction=P.sanitizeCompany({salary:'HKD18000',notes:'住宿扣2500，劳务费3000；住宿扣2500含办证费1000；全包35000',price:'4w'});
assert.doesNotMatch(unsafeDeduction.notes,/3000|1000|35000|劳务|办证|全包/);assert.match(unsafeDeduction.notes,/2500/);
const classifiedDeduction=P.parse('岗位：司机\n性别：男\n工资：18000/月\n工作要求：有经验，住宿扣2500','ZY-26-1103-33');assert.match(classifiedDeduction.notes,/2500/);assert.doesNotMatch(classifiedDeduction.requirements,/2500/);
console.log('PASS: salary components, employee deductions, supplier fee privacy, idempotence and source/review reports');

for(const [value,expected]of [['15920','HKD15920'],['15920+','HKD15920+'],['HK$15,920+','HKD15920+'],['HKD 15,920','HKD15920'],['15920HKD','HKD15920'],['港幣15,920/月','HKD15920'],['$15920，津贴500','HKD15920；津贴500'],['HKD15920+；奖金2000元','HKD15920+；奖金2000元'],['HKD100/小时','HKD100/小时'],['USD15920','USD15920']]){
 assert.equal(P.formatCompanySalary(value),expected,value);assert.equal(P.formatCompanySalary(expected),expected);
}
const formattedRecord={code:'ZY-26-1103-34',title:'司机',gender:'男',salary:'HK$15,920+',raw:'工资HK$15,920+'};const originalRecord=JSON.stringify(formattedRecord);
assert.equal(P.present(formattedRecord).salary,'HKD15920+');assert.equal(JSON.stringify(formattedRecord),originalRecord);
console.log('PASS: company salary HKD formatting, optional plus, pay components, period/currency safety and immutable source');
