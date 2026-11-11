import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../dist/matching.js'),C=require('../dist/job-classification.js'),V=require('../dist/job-categories.js'),today='2026-11-10';
assert.equal(V.majors.length,18);
const worker={gender:'男',age:'26',workHistory:[{position:'维修工',employer:'某家电维修公司',period:'2021-2026',duties:''}],certificates:'高空证，电工证'};
const aiWorker={...worker,matchProfile:{version:2,sourceHash:M.sourceHash(worker,'worker'),by:'ai',intents:[],history:[{index:0,major:'maintenance',subcategory_id:'seed:appliance',evidence:'维修工'}],certificates:[{major:'maintenance',subcategory_id:'seed:electrician',evidence:'电工证'},{major:'equipment',subcategory_id:'seed:lift_operator',evidence:'高空证'}]}};
const rows=[['家电维修技工',100,'high'],['电工',69,'mid'],['吊机维修员',69,'mid'],['码头机械技术员',69,'mid'],['升降台操作员',35,'low'],['点心厨师',null,'excluded'],['稀有协调专岗',null,'manual'],['维修工',69,'mid']];
for(const [title,score,level] of rows){const r=M.matchWorkerToOrder(aiWorker,{title},{today});if(level==='excluded'){assert(r.excluded);assert(r.reasons[0].includes('厨房餐饮制作'));assert(r.reasons[0].includes('维修与技术'))}else if(level==='manual'){assert(r.manual);assert.equal(r.score,undefined)}else{assert.equal(r.score,score,title);assert.equal(r.level,level,title)}console.log(title+': '+(r.excluded?'excluded':r.level+' '+(r.score??'—')))}
assert(M.matchWorkerToOrder(aiWorker,{title:'稀有协调专岗',gender:'女'},{today}).excluded);
assert(M.matchWorkerToOrder({...worker,age:'50'},{title:'电工',age:'49岁以下'},{today}).excluded);
const unknown=M.matchWorkerToOrder({age:'30',workHistory:[{position:'罕见复合协调者',period:'2024-至今'}]},{title:'电工'},{today});assert(unknown.manual&&!unknown.excluded);
assert(!M.matchWorkerToOrder({...worker,workHistory:[{position:'维修工',period:'1990.01-1990.02'}],certificates:''},{title:'电工'},{today}).excluded);
assert.equal(M.matchWorkerToOrder({certificates:'高空证',age:'30'},{title:'升降台操作员'},{today}).E,35);
assert(M.matchWorkerToOrder({certificates:'健康证',workHistory:[{position:'清洁员',period:'2020-至今'}]},{title:'电工'},{today}).excluded);
assert.equal(C.classify('汽车美容师').major,'vehicle_service');assert.equal(C.classify('吊机维修员').major,'maintenance');assert.equal(C.classify('吊机操作员').major,'equipment');
for(const title of ['甜品师','面包师傅','日本菜师傅','汽车美容师','升降台操作员','地勤','侍应生','调酒员','美容师','维修工','电工','吊机维修员','码头机械技术员'])assert.notEqual(C.classify(title).major,'other',title);
const fresh={version:2,sourceHash:M.sourceHash(worker,'worker'),by:'ai',intents:[],history:[{index:0,major:'maintenance',subcategory_id:'seed:appliance',evidence:'维修工'}],certificates:[{major:'maintenance',subcategory_id:'seed:electrician',evidence:'电工证'},{major:'equipment',subcategory_id:'seed:lift_operator',evidence:'高空证'}]};
assert(M.profileFor({...worker,matchProfile:fresh},'worker').valid);assert.equal(M.scoreExperience({...worker,matchProfile:fresh},{title:'家电维修技工'},today).by,'ai');
assert(!M.profileFor({...worker,matchProfile:{...fresh,version:1}},'worker').valid);
assert(!M.profileFor({...worker,matchProfile:{...fresh,history:[{...fresh.history[0],evidence:'不存在的依据'}]}},'worker').valid);
assert(!M.profileFor({...worker,matchProfile:{...fresh,history:[{...fresh.history[0],major:'invalid'}]}},'worker').valid);
assert(!M.profileFor({...worker,matchProfile:{...fresh,history:[{...fresh.history[0],subcategory_id:'missing'}]}},'worker').valid);
assert(!M.profileFor({...worker,workHistory:[{...worker.workHistory[0],employer:'另一行业公司'}],matchProfile:fresh},'worker').valid);
const custom=[{id:'new-tech',major:'maintenance',name:'复合维修技师',aliases:['复合技师'],status:'new'},{id:'old-a',major:'maintenance',name:'旧细类A',aliases:[],merged_into:'old-b'},{id:'old-b',major:'maintenance',name:'旧细类B',aliases:[],merged_into:'new-tech'}];C.configure({subcategories:custom});assert.equal(C.resolve('old-a').id,'new-tech');assert.equal(C.compare({major:'maintenance',subcategory_id:'old-a'},{major:'maintenance',subcategory_id:'new-tech'}),1);assert.equal(C.classify('复合技师').subcategory_id,'new-tech');
C.configure({subcategories:custom.map((x,i)=>i?x:{...x,major:'equipment'})});assert.equal(C.current({major:'maintenance',subcategory_id:'old-a'}).major,'equipment');
C.configure({subcategories:[{id:'cycle-a',major:'maintenance',name:'循环A',merged_into:'cycle-b'},{id:'cycle-b',major:'maintenance',name:'循环B',merged_into:'cycle-a'}]});assert.equal(C.resolve('cycle-a'),null);
const input={title:'电工',workContent:'设备检修'},hash=await C.textHash('order',input);assert.equal(hash,await C.textHash('order',{...input,title:' 电工 '}));C.configure({cache:[{text_hash:hash,kind:'order',major:'equipment',subcategory_id:'seed:forklift',evidence:'设备检修',by:'user'}]});await C.bind([{kind:'order',input}]);assert.equal(M.profileFor(input).major,'equipment');
C.reset();assert.equal(C.cache.length,0);assert.equal(M.sourceFor(worker,'worker').history[0].employer,'某家电维修公司');for(const key of ['name','phone','idNumber','currentAddress','photo'])assert(!Object.hasOwn(M.sourceFor({...worker,[key]:'PRIVATE'},'worker'),key));
console.log('PASS: repair regression, broad fallback, certificate evidence, manual judgment, v1 expiry, new dictionary rows, merge chains, administrator precedence and redacted transport');

const fallback=M.matchWorkerToOrder(worker,{title:'维修工',salary:'HKD15000'},{today});assert(!fallback.excluded&&!fallback.manual);assert.equal(fallback.level,'mid');assert.equal(fallback.score,70);

assert.equal(C.classify('机械设备操作员').major,'equipment');assert.equal(C.classify('汽车美容技工').major,'vehicle_service');assert.equal(C.certificates('高空作業證')[0].major,'equipment');
