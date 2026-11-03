"""Provider-neutral business backup. Never exports users, password hashes or sessions."""
from datetime import datetime, timezone
from server.app import APIError, connect, validate_orders, validate_worker

FORMAT='zy-labour-portable'
VERSION=1


def validate(payload):
    if not isinstance(payload,dict) or payload.get('format')!=FORMAT or type(payload.get('version')) is not int or payload['version']!=VERSION:
        raise APIError(400,'不支持的备份格式或版本')
    validate_orders(payload.get('orders'))
    workers=payload.get('workers')
    if not isinstance(workers,list):raise APIError(400,'劳工备份格式无效')
    seen=set()
    for worker in workers:
        validate_worker(worker)
        if worker['id'] in seen:raise APIError(400,'劳工ID重复')
        seen.add(worker['id'])
    return payload


def export_db(db):
    import json
    # The caller begins a read transaction for one consistent snapshot.
    orders=json.loads(db.execute('SELECT orders FROM state WHERE id=1').fetchone()['orders'])
    workers=[{k:v for k,v in json.loads(r['data']).items() if k!='_version'} for r in db.execute('SELECT data FROM workers ORDER BY id')]
    return validate({'format':FORMAT,'version':VERSION,'exportedAt':datetime.now(timezone.utc).isoformat(),'orders':orders,'workers':workers})


def require_writable(db):
    if db.execute('SELECT read_only FROM settings WHERE id=1').fetchone()[0]:raise APIError(409,'系统正在维护或迁移，已暂停写入；当前输入尚未保存')


def import_db(db,payload,revision=None):
    import json
    validate(payload)
    require_writable(db)
    row=db.execute('SELECT * FROM state WHERE id=1').fetchone()
    if revision is not None and row['revision']!=revision:raise APIError(409,'目标资料已变化，请刷新后重新导入')
    if json.loads(row['orders']) or db.execute('SELECT 1 FROM workers LIMIT 1').fetchone():raise APIError(409,'只允许恢复到空数据库，现有资料不会覆盖')
    db.execute('UPDATE state SET orders=?,revision=revision+1 WHERE id=1',(json.dumps(payload['orders'],ensure_ascii=False),))
    for worker in payload['workers']:
        clean={k:v for k,v in worker.items() if k!='_version'}
        db.execute('INSERT INTO workers VALUES(?,?,?)',(worker['id'],1,json.dumps(clean,ensure_ascii=False)))
    return {'orders':len(payload['orders']),'workers':len(payload['workers']),'revision':row['revision']+1}
