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
