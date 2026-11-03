import assert from 'node:assert/strict';
import '../dist/order-parser.js';
const {parse,sanitizeRaw,present}=globalThis.ZYOrderParser;
const sample=`已视频录取几人，继续收简历安排

【更新】XR80080香港某公司招聘：

招聘岗位：铲车/叉车起重车驾驶员（货仓）：8名
薪金待遇：HKD17118（底15500+1618津贴）
备注：铲车津贴（HKD500）需入职后考取了香港铲车证才能获取
工作时间：轮班工作，每周工作6天，每天9小时（包括1小时休息时间用膳时间）月休4天。
食宿：吃自理，#雇主提供宿舍统一安排
基本要求：男女不限，30~48岁左右，粤语会听会说，认识24个英文字母，能吃苦耐劳；#有货运代理、海运、空运物流仓务经验（空运仓务优先）
工作要求：负责操作铲车/叉式起重车；协助货仓运作，搬运货物；装卸货柜；及收货上架，装箱出货，盘点及整理货仓，会看送货收货表格等；
工作地点：机场或者葵涌（具体录取地址看雇主安排）

费用：23800全包`;
const o=parse(sample,'ZY-26-1103-01');
assert.equal(o.title,'铲车/叉车起重车驾驶员（货仓）');assert.equal(o.employer,'香港某公司');
assert.equal(o.salary,'HKD17118（底15500+1618津贴）');assert.equal(o.code,'ZY-26-1103-01');
assert(!o.raw.includes('XR80080'));assert(o.raw.includes('HKD17118'));assert(o.raw.includes('HKD500'));assert(o.raw.includes('23800全包'));assert(o.raw.includes('30~48岁'));assert(o.raw.includes('24个英文字母'));
assert.equal(o.gender,'男女不限');assert.match(o.hours,/每天9小时/);assert.equal(o.rest,'月休4天');assert(!o.requirements.includes('工作时间'));assert(!o.requirements.includes('工作地点'));
assert.match(o.requirements,/认识24个英文字母/);assert.match(o.notes,/香港铲车证/);assert.match(o.notes,/#雇主提供宿舍/);
for(const text of [
 '【招聘岗位】铲车/叉车起重车驾驶员（货仓）：8名',
 '[招聘岗位] 铲车/叉车起重车驾驶员（货仓）：8名',
 '1. 招聘岗位：铲车/叉车起重车驾驶员（货仓）：8名',
 '招聘岗位 铲车/叉车起重车驾驶员（货仓）：8名',
 '招聘岗位：\n铲车/叉车起重车驾驶员（货仓）：8名'
])assert.equal(parse(text).title,o.title,text);
assert.equal(parse('【更新】XR80080香港某公司招聘：\n薪金待遇：HKD17118').title,'');
assert.equal(parse('招聘岗位：\n月薪：HKD18000').title,'');
assert.equal(parse('急招：叉车司机 8名\n月薪：HKD18000').title,'叉车司机');
assert.equal(parse('【职位】厨师\n【月薪】HKD 18,799\nDJ: 90000\n80000').salary,'HKD 18,799');
assert.equal(parse('【职位】厨师\nDJ: 90000\n80000').salary,'');
assert.equal(parse('招聘崗位：叉車司機（貨倉）：8名\n薪金待遇：HKD17118').title,'叉車司機（貨倉）');
const stripped=sanitizeRaw('原单编号：AB-12345\nAT-1234 厨师\nZY-26-1103-01\n月薪 HKD17118 USD20000 CNY15000\n年龄30~48岁，每天9小时\n1. 有经验');
assert(!/AB-12345|AT-1234|ZY-26-1103-01/.test(stripped));assert(stripped.includes('HKD17118 USD20000 CNY15000'));assert(stripped.includes('1. 有经验'));
assert.equal(sanitizeRaw(stripped),stripped);
const legacy={...o,raw:sample,title:'招聘岗位',employer:'【更新】XR80080香港某公司招聘：'};const display=present(legacy);
assert.equal(display.title,o.title);assert.equal(display.employer,'香港某公司');assert(!display.raw.includes('XR80080'));assert.equal(legacy.raw,sample);
assert.equal(present({...legacy,title:'手动修改的叉车司机'}).title,'手动修改的叉车司机');
console.log('PASS: exact forklift sample, labelled/traditional/multiline jobs, upstream IDs removed, currency/numbers preserved, salary/noise separation, legacy display without archive mutation');
const kitchen=`选表香港面试
【岗位】西餐帮厨
【年龄要求】35 岁以下
【性别要求】男
【合约期限】24个月
【工资薪酬】16310/月
【工作时间】每天 9 小时，每周 6 天，需轮班
【语言要求】粤语
【食宿安排】包工作餐，雇主提供宿舍扣租金大约2500/月
【工作内容】需有厨房及切配经验`;
const cook=parse(kitchen,'ZY-26-1103-01');
assert.equal(cook.title,'西餐帮厨');assert.equal(cook.gender,'男');assert.equal(cook.salary,'16310/月');assert.equal(cook.age,'35 岁以下');assert(!cook.notes.includes('2500'));assert.match(cook.notes,/雇主提供宿舍/);assert.equal(cook.workContent,'需有厨房及切配经验');
assert.equal(parse('【性別要求】男\n【工資薪酬】港幣16,310/月').gender,'男');assert.equal(parse('【性別要求】男\n【工資薪酬】港幣16,310/月').salary,'港幣16,310/月');
assert.equal(parse('【备注】提供宿舍\n【合约期限】24个月\n【岗位】帮厨').notes,'提供宿舍');
assert.equal(ZYOrderParser.cleanField('gender','要求】 男'),'男');assert.equal(ZYOrderParser.cleanField('salary','薪酬】 16310/月'),'16310/月');
assert.equal(ZYOrderParser.cleanField('salary','HKD17118（薪酬含津贴）'),'HKD17118（薪酬含津贴）');assert.equal(ZYOrderParser.cleanField('gender','男，有经验要求'),'男，有经验要求');
const historical={...cook,id:'old-cook',code:'V-11.3-01',raw:kitchen,createdAt:'2026-11-03T08:00:00Z',gender:'要求】 男',salary:'薪酬】 16310/月'};
const valid={...historical,id:'valid-order',code:'ZY-26-1103-01',gender:'女',salary:'HKD 20,000',title:'手动确认的岗位'};
const before=JSON.stringify([historical,valid]);const fixed=ZYOrderParser.repairLegacyOrders([historical,valid]);
assert.equal(fixed[0].code,'ZY-26-1103-02');assert.equal(fixed[0].gender,'男');assert.equal(fixed[0].salary,'16310/月');assert.equal(fixed[0].raw,kitchen);assert.deepEqual(fixed[1],valid);assert.equal(JSON.stringify([historical,valid]),before);
assert.deepEqual(ZYOrderParser.repairLegacyOrders(fixed),fixed);
assert.equal(ZYOrderParser.repairLegacyOrders([{...historical,code:'V-11.3-08'}])[0].code,'ZY-26-1103-08');
assert.equal(ZYOrderParser.repairLegacyOrders([{...historical,code:'CUSTOM-01'}])[0].code,'CUSTOM-01');
console.log('PASS: exact kitchen sample, complete bracket labels, salary format, safe legacy field cleanup and collision-free/idempotent V-code repair');
const normalize=ZYOrderParser.normalizeGender;
for(const [text,expected]of [
 ['男','男'],['【性别要求】 男（35岁以下）','男'],['要求】 男','男'],['只招男性，有经验','男'],
 ['女','女'],['女士，懂粤语','女'],['招聘性別】女，年龄不限','女'],['女性，有男装销售经验','女'],
 ['男女不限','男女不限'],['男/女均可','男女不限'],['男、女','男女不限'],['性别不限（年龄40以下）','男女不限'],['不限','男女不限'],['男（女也可）','男女不限'],
 ['男，不收女','男'],['不招男，只招女','女'],['男，负责女厕清洁','男'],['不招男，不招女',''],['未注明',''],['年龄不限','']
])assert.equal(normalize(text),expected,text);
assert.equal(normalize('', '【岗位】男装店销售\n【基本要求】女性，懂粤语'),'女');
assert.equal(normalize('', '【岗位】男女装销售\n【年龄要求】不限'),'');
assert.equal(normalize('', '【性别要求】待确认\n【工作内容】接待男女顾客'),'');
assert.equal(normalize('', '【性别要求】\n女\n【年龄】30岁'),'女');
for(const input of ['性别要求】 男，35岁','女（懂粤语）','男/女均可','不限','未填写','【不明】？？']){
 const view=present({...historical,gender:input,raw:''});assert(['','男','女','男女不限'].includes(view.gender));
 assert.equal(normalize(normalize(input)),normalize(input));
}
assert.equal(parse('【岗位】厨师\n【性别要求】男（35岁以下）').gender,'男');
assert.equal(parse('【岗位】服务员\n【性别要求】女士，懂粤语').gender,'女');
assert.equal(parse('【岗位】清洁员\n【基本要求】男女不限，年龄不限').gender,'男女不限');
console.log('PASS: gender enum, bracket/punctuation/qualifier removal, explicit-label precedence, exclusions, uncertain values remain unassigned');
const monetary=ZYOrderParser.parse(sample,'ZY-26-1103-01');
assert.equal(monetary.salary,'HKD17118（底15500+1618津贴）');assert(monetary.raw.includes('23800全包'));assert(monetary.raw.includes('HKD500'));
assert(!monetary.notes.includes('23800'));assert(!monetary.notes.includes('全包'));assert(!monetary.notes.includes('HKD500'));assert(monetary.notes.includes('雇主提供宿舍'));
const safe=ZYOrderParser.sanitizeCompany({raw:sample,code:'ZY-26-1103-01',salary:'HKD 18,000（底薪16,000，津贴2,000）',price:'3.7w',notes:'原单全包价23800；雇主提供宿舍扣租金大约2500/月；劳务费3000元；铲车津贴（HKD500）需考证',requirements:'年龄30~48岁，每天9小时，认识24个英文字母；另收管理费2000',workContent:'操作设备500W功率，搬运20kg货物'});
assert.equal(safe.raw,sample);assert.equal(safe.price,'3.7w');assert.equal(safe.salary,'HKD 18,000（底薪16,000，津贴2,000）');assert.equal(safe.code,'ZY-26-1103-01');
for(const value of [safe.notes,safe.requirements])assert(!/23800|2500|3000|500|2000|全包/.test(value));
assert(safe.notes.includes('雇主提供宿舍'));assert(safe.requirements.includes('30~48岁'));assert(safe.requirements.includes('9小时'));assert(safe.requirements.includes('24个英文字母'));assert(safe.workContent.includes('500W功率'));assert(safe.workContent.includes('20kg'));
assert.deepEqual(ZYOrderParser.sanitizeCompany(safe),safe);
assert.equal(ZYOrderParser.stripSourcePackage('HKD17118，全包价23800'),'HKD17118');
assert.equal(ZYOrderParser.stripSourcePackage('HKD17118 全包价23800'),'HKD17118');
assert.equal(ZYOrderParser.stripSourcePackage('23800全包'),'');
assert.equal(ZYOrderParser.stripSourcePackage('全包价：2.38w'),'');
assert.equal(parse('【职位】厨师\n【备注】HKD500津贴\n费用：23800全包').salary,'');
assert.equal(parse('【职位】厨师\n全包HKD23800').salary,'');
assert.equal(parse('【职位】厨师\n【薪酬】16310/月').salary,'16310/月');
assert.equal(parse('【职位】厨师\n【薪金待遇】HKD17118（底15500+1618津贴）').salary,'HKD17118（底15500+1618津贴）');
console.log('PASS: source package/fee amounts excluded throughout company fields, exact salary preserved/auto-filled, independent ZY price retained, original raw and non-price numbers preserved');
for(const quote of ['全包價格23800','全包价格：23800元（含所有费用）','费用：23800全包','23800全包（含中介费）','全包2万3','原单全包价格两万三千八','全包价格\n23800','底价23800','上家价：23800','23800左右']){
 const output=ZYOrderParser.cleanCompanyText('需有经验；'+quote+'；提供工作餐');
 assert(!/23800|全包|两万|2万/.test(output),quote+' => '+output);assert(output.includes('需有经验'));assert(output.includes('提供工作餐'));
}
assert.equal(ZYOrderParser.stripSourcePackage('HKD17118，全包2万3'),'HKD17118');
assert.equal(ZYOrderParser.stripSourcePackage('HKD17118 23800全包'),'HKD17118');
assert.equal(ZYOrderParser.stripSourcePackage('HKD17118 全包两万三千八'),'HKD17118');
console.log('PASS: entire upstream package clauses and price tails removed, including traditional labels and mixed Arabic/Chinese quotes');
const plainNumbers=ZYOrderParser.sanitizeCompany({age:'35',hours:'9',rest:'4',salary:'16310/月',price:'3.7w',notes:'23800'});
assert.equal(plainNumbers.age,'35');assert.equal(plainNumbers.hours,'9');assert.equal(plainNumbers.rest,'4');assert.equal(plainNumbers.notes,'');assert.equal(plainNumbers.salary,'16310/月');assert.equal(plainNumbers.price,'3.7w');
