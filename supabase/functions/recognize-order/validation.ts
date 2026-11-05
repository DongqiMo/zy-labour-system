// Extractive output contract: neither Gemini nor the caller can add company-code/price fields.
export const fields=['title','employer','salary','gender','age','language','hours','rest','interview','workContent','requirements','notes'];
export function redactSource(source:string){
 return source.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[联系方式已隐藏]')
  .replace(/\b\d{17}[0-9Xx]\b/g,'[身份证已隐藏]')
  .replace(/\b[A-Z]{1,2}\d{6}\([0-9A]\)/gi,'[身份证已隐藏]')
  .replace(/((?:电话|電話|手机|手機|联系电话|聯絡電話|联系方式|聯絡方式)\s*[:：]?\s*)[+\d][\d\s()-]{6,}/g,'$1[联系方式已隐藏]');
}
export function validateFacts(data:any,source:string){
 if(!data||!Array.isArray(data.facts)||data.facts.length>60)throw new Error('Invalid facts');
 const output:any[]=[];
 for(const fact of data.facts){
  if(!fact||!fields.includes(fact.field)||typeof fact.value!=='string'||typeof fact.evidence!=='string')throw new Error('Invalid fact');
  const {field,value,evidence}=fact;
  if(!value.trim()||value.length>2000||!evidence.trim()||evidence.length>5000||!source.includes(evidence)||!evidence.includes(value)||/\[.*已隐藏\]/.test(value))throw new Error('Unsupported source value');
  if(/全包|包价|包價|总价|總價|上家|劳务|勞務|办证|辦證|中介|保险另计|保險另計/.test(evidence))continue;
  if(field==='salary'&&!/工资|工資|月薪|薪资|薪資|薪酬|薪金|津贴|津貼|奖金|獎金|提成|花红|花紅|HKD|HK\$|HK|港币|港幣|港元|[$]/i.test(evidence))continue;
  if(['hours','rest'].includes(field)&&!/[时時天日周週班休更hH]|\d{1,2}:\d{2}/.test(value))continue;
  if(!output.some(f=>f.field===field&&f.value===value&&f.evidence===evidence))output.push({field,value,evidence});
 }
 return output;
}
