import assert from 'node:assert/strict';
import time from '../dist/business-time.js';
import '../dist/order-parser.js';
assert.equal(time.zone,'Asia/Shanghai');
for(const [value,key] of [
 ['2026-11-09T02:36:00Z','2026-11-09'],['2026-11-09T15:59:59Z','2026-11-09'],['2026-11-09T16:00:00Z','2026-11-10'],
 ['2025-12-31T18:00:00Z','2026-01-01'],['2026-11-09','2026-11-09'],['1990-05-12','1990-05-12'],
 ['2026-11-09T23:30:00','2026-11-09'],[new Date('2026-11-09T02:36:00Z'),'2026-11-09'],[0,'1970-01-01']
])assert.equal(time.dateKey(value),key);
for(const value of ['',null,undefined,NaN,true,{},[],Symbol('invalid'),'11/09/2026','invalid','2026-02-29','2024-02-30','2026-13-01'])assert.equal(time.dateKey(value),'',String(value));
assert.deepEqual(time.parts('2026-11-09T16:00:00Z'),{year:2026,month:11,day:10,hour:0,minute:0,weekday:2});
assert.equal(time.formatDateTime('2026-11-09T03:42:00Z'),'2026-11-09 11:42');
assert.equal(time.formatDateTime('invalid'),'');
for(const [key,n,expected] of [['2026-11-30',1,'2026-12-01'],['2026-12-31',1,'2027-01-01'],['2024-02-28',1,'2024-02-29'],['2024-02-29',1,'2024-03-01'],['2026-03-08',-1,'2026-03-07'],['2026-11-01',1,'2026-11-02'],['2026-01-01',-1,'2025-12-31']])assert.equal(time.addDays(key,n),expected);
assert.equal(time.addDays('invalid',1),'');assert.equal(time.addDays('2026-11-01',1.5),'');
assert.deepEqual(time.monthInfo(2024,2),{firstWeekday:4,daysInMonth:29});
assert.deepEqual(time.monthInfo(2026,2),{firstWeekday:7,daysInMonth:28});
assert.deepEqual(time.monthInfo(2026,11),{firstWeekday:7,daysInMonth:30});assert.equal(time.monthInfo(2026,13),null);
for(const key of ['2026-11-09','2026-11-15'])assert.deepEqual(time.weekRange(key),{start:'2026-11-09',end:'2026-11-16'});
assert.deepEqual(time.weekRange('2026-11-16'),{start:'2026-11-16',end:'2026-11-23'});
assert.deepEqual(time.weekRange('2026-01-01'),{start:'2025-12-29',end:'2026-01-05'});
assert.deepEqual(time.weekRange('2026-03-08'),{start:'2026-03-02',end:'2026-03-09'});
assert.deepEqual(time.weekRange('2026-11-01'),{start:'2026-10-26',end:'2026-11-02'});
// The narrow V-code repair uses the China year; already-valid company codes and all timestamps survive.
const legacy={id:'synthetic-time',code:'V-11.9-3',createdAt:'2025-12-31T18:00:00Z',raw:'岗位：资料协调员',gender:'男',salary:'HKD22000'};
const valid={...legacy,id:'synthetic-current',code:'ZY-25-1231-09'};
const invalid={...legacy,id:'synthetic-invalid',code:'V-2.30-3'};
const repaired=ZYOrderParser.repairLegacyOrders([legacy,valid,invalid]);
assert.equal(repaired[0].code,'ZY-26-1109-03');assert.equal(repaired[1].code,valid.code);assert.equal(repaired[2].code,invalid.code);
assert.equal(repaired[0].createdAt,legacy.createdAt);assert.equal(legacy.code,'V-11.9-3');
console.log('PASS: China date keys/parts, midnight/year rollover, literal dates, invalid inputs, UTC-only date arithmetic, leap years, DST-independent weeks/months and narrow legacy-year repair');
