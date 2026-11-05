#!/usr/bin/env python3
"""Local-only UIE/rules comparison. No API calls, implicit model downloads or production writes."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = {'title': '职位名称', 'employer': '雇主名称', 'salary': '月薪', 'gender': '招聘性别',
          'age': '年龄要求', 'hours': '工作时间', 'workContent': '工作内容'}
UPSTREAM_COMMIT = '2eafcda44589144d2cb246b74e3bf2564ea6583f'

def canonical(records):
    js = r"""
const fs=require('fs');require('./dist/order-parser.js');const P=ZYOrderParser;
const input=JSON.parse(fs.readFileSync(0,'utf8'));
console.log(JSON.stringify(input.map(r=>{
 if(r.candidate){const o=P.sanitizeCompany(r.candidate);o.title=P.titleValue(o.title||'',true);o.salary=P.formatCompanySalary(o.salary);o.gender=P.normalizeGender(o.gender||'');return o;}
 const a=P.analyze(r.raw,r.code||'ZY-26-1103-90',{explicitBoundary:true});return a.order?P.present(a.order):{};
})));
"""
    return json.loads(subprocess.run(['node', '-e', js], input=json.dumps(records, ensure_ascii=False),
                                    text=True, capture_output=True, check=True, cwd=ROOT).stdout)

def score(fixture, candidate):
    checks=[]
    for field, expected in fixture.get('expected', {}).items():
        if field in SCHEMA:
            checks.append({'field':field,'kind':'exact','pass':candidate.get(field,'')==expected})
    for field, values in fixture.get('contains', {}).items():
        if field in SCHEMA:
            for value in values:
                checks.append({'field':field,'kind':'contains','pass':value in candidate.get(field,'')})
    # Check privacy on the published-equivalent fields, never on the source or internal evidence.
    text='\n'.join(str(candidate.get(field,'')) for field in SCHEMA)
    for forbidden in fixture.get('forbidden', []):
        checks.append({'field':'privacy','kind':'forbidden','pass':forbidden not in text})
    return checks

def extraction_candidate(result, source):
    candidate={};invalid=[];ambiguous=[];accepted={}
    for field,label in SCHEMA.items():
        spans=[]
        for item in result.get(label, []):
            start,end=item.get('start'),item.get('end');text=item.get('text')
            if not isinstance(start,int) or not isinstance(end,int) or not isinstance(text,str) or not 0<=start<end<=len(source) or source[start:end]!=text:
                invalid.append({'field':field, 'reason':'not_an_exact_source_span'});continue
            spans.append({'text':text,'start':start,'end':end,'probability':item.get('probability')})
        accepted[field]=spans
        values=list(dict.fromkeys(span['text'] for span in spans))
        if field!='workContent' and len(values)>1:
            candidate[field]='';ambiguous.append(field)
        else:
            candidate[field]='；'.join(values)
    return candidate,accepted,invalid,ambiguous

def aggregate(rows, field):
    checks=[c for row in rows for c in row.get(field, [])]
    by_field={}
    for c in checks:
        stats=by_field.setdefault(c['field'],{'passed':0,'total':0});stats['total']+=1;stats['passed']+=int(c['pass'])
    return {'passed':sum(int(c['pass']) for c in checks),'total':len(checks),'by_field':by_field}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source-checkout',type=Path)
    ap.add_argument('--model-dir',type=Path)
    ap.add_argument('--model',default='uie-mini',choices=['uie-mini','uie-medium','uie-base','uie-nano'])
    ap.add_argument('--private-audit',type=Path,help='Private audit export: read sources only, never use edited company values as labels.')
    ap.add_argument('--output',type=Path,default=ROOT/'exports/uie-comparison.json')
    ap.add_argument('--baseline-only',action='store_true')
    ap.add_argument('--threads',type=int,default=2)
    ap.add_argument('--device',choices=['cpu','gpu'],default='cpu')
    args=ap.parse_args()
    out=args.output.resolve()
    if not (out.is_relative_to(ROOT/'exports') or out.is_relative_to(Path('/tmp'))):
        ap.error('Private output must be under the ignored exports directory or /tmp')
    fixtures=json.loads((ROOT/'tests/fixtures/recognition-errors.json').read_text())['cases']
    docs=[{'id':f['id'],'raw':f['source'],'fixture':f,'dataset':'synthetic_regression'} for f in fixtures]
    if args.private_audit:
        audit=json.loads(args.private_audit.read_text())
        # Do not inspect human company fields or treat old generated candidates as ground truth.
        for i,record in enumerate(audit.get('records', [])):
            if record.get('needsReview') and isinstance(record.get('raw'),str):
                docs.append({'id':f'private-source-{i+1}','raw':record['raw'],'dataset':'private_unlabelled_source'})
    baseline=canonical(docs)
    predictor=None;status='not_run_baseline_only';metadata={}
    if not args.baseline_only:
        if not args.source_checkout or not args.model_dir:ap.error('Model inference needs an explicit local checkout and converted model directory')
        for name in ['config.json','pytorch_model.bin','vocab.txt']:
            if not (args.model_dir/name).is_file():ap.error('Missing local model file: '+name)
        sha=subprocess.run(['git','rev-parse','HEAD'],cwd=args.source_checkout,text=True,capture_output=True,check=True).stdout.strip()
        if sha!=UPSTREAM_COMMIT:ap.error('Upstream checkout does not match the reviewed commit')
        os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TOKENIZERS_PARALLELISM='false')
        sys.path.insert(0,str(args.source_checkout.resolve()))
        import torch
        import transformers
        torch.set_num_threads(args.threads)
        if args.device=='gpu' and not torch.cuda.is_available():ap.error('CUDA GPU requested but not available in this Python runtime')
        from uie_predictor import UIEPredictor
        predictor=UIEPredictor(args.model,list(SCHEMA.values()),task_path=str(args.model_dir.resolve()),device=args.device,engine='pytorch',batch_size=8,position_prob=0.5)
        status='completed';metadata={'model':args.model,'upstreamCommit':sha,'torch':torch.__version__,'transformers':transformers.__version__,'device':args.device,'threads':args.threads,'threshold':0.5}
    rows=[]
    for i,(doc,base) in enumerate(zip(docs,baseline)):
        row={'id':doc['id'],'dataset':doc['dataset'],'source':doc['raw'],'rules':{k:base.get(k,'') for k in SCHEMA}}
        if doc.get('fixture'):row['ruleChecks']=score(doc['fixture'],base)
        if predictor:
            start=time.perf_counter();result=predictor(doc['raw'])[0];elapsed=time.perf_counter()-start
            candidate,spans,invalid,ambiguous=extraction_candidate(result,doc['raw'])
            cleaned=canonical([{'candidate':candidate}])[0]
            row.update(uieRaw=result,uie={k:cleaned.get(k,'') for k in SCHEMA},sourceSpans=spans,invalidSpans=invalid,ambiguousFields=ambiguous,seconds=elapsed)
            if doc.get('fixture'):row['uieChecks']=score(doc['fixture'],cleaned)
        rows.append(row)
        if (i+1)%5==0:print(f'Processed {i+1}/{len(docs)} local documents',file=sys.stderr,flush=True)
    report={'format':'zy-local-uie-comparison','version':1,'modelStatus':status,'model':metadata,'syntheticCount':len(fixtures),'privateUnlabelledCount':len(docs)-len(fixtures),'rulesChecks':aggregate(rows,'ruleChecks'),'uieChecks':aggregate(rows,'uieChecks') if predictor else None,'limitations':['Synthetic checks are not a production accuracy estimate.','Private sources have no trusted labels; field coverage is not accuracy.','Human-edited company records are not labels or model inputs.','One model/threshold without fine tuning; no production changes.'],'records':rows}
    out.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f:json.dump(report,f,ensure_ascii=False,indent=2)
    print(json.dumps({k:v for k,v in report.items() if k!='records'},ensure_ascii=False))
    print('Private report: '+str(out))

if __name__=='__main__':main()
