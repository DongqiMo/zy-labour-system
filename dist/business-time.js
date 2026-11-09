/* One business timezone, shared by browsers and Node. Stored instants remain UTC. */
(function(root){
 const zone='Asia/Shanghai',dayMs=86400000;
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'});
 const englishHeader=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'long',day:'numeric',weekday:'long'});
 const weekdays={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7},zhWeekdays=['','星期一','星期二','星期三','星期四','星期五','星期六','星期日'];
 const pad=n=>String(n).padStart(2,'0');
 function utcDate(year,month,day){const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(0,0,0,0);return date}
 function parseKey(key){
  const m=typeof key==='string'&&key.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
  const year=+m[1],month=+m[2],day=+m[3],date=utcDate(year,month,day);
  return year>=1&&date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day?date:null;
 }
 function formattedParts(date){
  const p=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
  return {year:+p.year,month:+p.month,day:+p.day,hour:+p.hour,minute:+p.minute,weekday:weekdays[p.weekday]};
 }
 function instant(value){
  if(value===null||value===undefined||typeof value==='boolean'||typeof value==='string'&&!value.trim())return null;
  if(!['string','number'].includes(typeof value)&&Object.prototype.toString.call(value)!=='[object Date]')return null;
  if(typeof value==='string'){
   // Calendar-only dates are literal. Legacy ISO datetimes without an offset mean business wall time.
   if(/^\d{4}-\d{2}-\d{2}/.test(value)&&!parseKey(value.slice(0,10)))return null;
   if(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(value)){
    const nominal=new Date(value.length===10?value+'T00:00:00Z':value+'Z');if(!Number.isFinite(nominal.getTime()))return null;
    const p=formattedParts(nominal),wall=utcDate(p.year,p.month,p.day);wall.setUTCHours(p.hour,p.minute,nominal.getUTCSeconds(),nominal.getUTCMilliseconds());
    return new Date(nominal.getTime()-(wall.getTime()-nominal.getTime()));
   }
   if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value))return null;
  }
  const date=new Date(value);return Number.isFinite(date.getTime())?date:null;
 }
 function parts(value){const date=instant(value);return date?formattedParts(date):null}
 function dateKey(value){const p=parts(value);return p?`${String(p.year).padStart(4,'0')}-${pad(p.month)}-${pad(p.day)}`:''}
 function todayKey(){return dateKey(new Date())}
 function formatDateTime(value){const p=parts(value);return p?`${dateKey(value)} ${pad(p.hour)}:${pad(p.minute)}`:''}
 function addDays(key,n){const date=parseKey(key);if(!date||!Number.isInteger(n))return '';date.setUTCDate(date.getUTCDate()+n);const year=date.getUTCFullYear();return year>=1&&year<=9999?`${String(year).padStart(4,'0')}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`:''}
 function weekRange(key){const date=parseKey(key);if(!date)return {start:'',end:''};const start=addDays(key,1-(date.getUTCDay()||7));return {start,end:addDays(start,7)}}
 function monthInfo(year,month){if(!Number.isInteger(year)||year<1||year>9999||!Number.isInteger(month)||month<1||month>12)return null;const first=utcDate(year,month,1);return {firstWeekday:first.getUTCDay()||7,daysInMonth:(utcDate(year,month+1,1)-first)/dayMs}}
 function headerDate(language){const date=new Date();if(language==='en')return englishHeader.format(date);const p=parts(date);return `${p.year}年${p.month}月${p.day}日 ${zhWeekdays[p.weekday]}`}
 const api=Object.freeze({zone,dateKey,todayKey,parts,formatDateTime,addDays,weekRange,monthInfo,headerDate});root.ZYTime=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
