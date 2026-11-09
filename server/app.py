"""Single-instance ZY shared server; Python 3.12 standard library only."""
import argparse
from contextlib import contextmanager
import base64
import getpass
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
# Support both CLI execution and module tests without duplicating the module.
if __name__=='__main__':
    import sys
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    sys.modules['server.app']=sys.modules[__name__]

ROOT = Path(__file__).resolve().parents[1]
MAX_BODY = 32 * 1024 * 1024
SESSION_TTL = 12 * 3600


class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def password_hash(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1)
    return base64.b64encode(salt).decode() + ':' + base64.b64encode(derived).decode()


def password_ok(password, saved):
    salt = base64.b64decode(saved.split(':')[0])
    return hmac.compare_digest(password_hash(password, salt), saved)


def validate_account(username, password, role):
    if not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9_.-]{3,64}', username):
        raise APIError(400, '账号须为3–64位英文字母、数字、点、下划线或连字符')
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        raise APIError(400, '密码须为12–256个字符')
    if role not in ('admin', 'staff'):
        raise APIError(400, '角色无效')


@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','staff')), active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
          csrf TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, orders TEXT NOT NULL);
        INSERT OR IGNORE INTO state VALUES(1,0,'[]');
        CREATE TABLE IF NOT EXISTS workers(id TEXT PRIMARY KEY, version INTEGER NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), read_only INTEGER NOT NULL DEFAULT 0);
        INSERT OR IGNORE INTO settings VALUES(1,0);
        CREATE TABLE IF NOT EXISTS attempts(ip TEXT PRIMARY KEY, count INTEGER NOT NULL, reset REAL NOT NULL);
        ''')
    os.chmod(path, 0o600)


def create_user(path, username, password, role):
    validate_account(username, password, role)
    with connect(path) as db:
        db.execute('INSERT INTO users(id,username,password,role) VALUES(?,?,?,?)',
                   (secrets.token_hex(16), username, password_hash(password), role))


def validate_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'[\w-]{1,100}', value, flags=re.ASCII):
        raise APIError(400, '记录ID格式无效')


def validate_orders(orders):
    if not isinstance(orders, list) or len(orders) > 10000:
        raise APIError(400, '订单格式无效或超过10000份')
    ids, codes = set(), set()
    for o in orders:
        if not isinstance(o, dict):
            raise APIError(400, '订单格式无效')
        validate_id(o.get('id'))
        for field in ('code', 'title', 'raw', 'createdAt'):
            if not isinstance(o.get(field), str) or not o[field].strip():
                raise APIError(400, '公司单号、职位、原单及创建时间必填')
        for field, value in o.items():
            if field in ('__proto__', 'constructor', 'prototype') or not isinstance(value, (str, int, float, bool, type(None))):
                raise APIError(400, '订单字段格式无效')
        if o.get('status') not in ('draft', 'ready'):
            raise APIError(400, '订单状态无效')
        if o['id'] in ids or o['code'] in codes:
            raise APIError(409, '记录ID或公司单号重复，请重新核对')
        ids.add(o['id']); codes.add(o['code'])


def validate_worker(w):
    if not isinstance(w, dict):
        raise APIError(400, '劳工资料格式无效')
    validate_id(w.get('id'))
    if not isinstance(w.get('name'), str) or not w['name'].strip():
        raise APIError(400, '姓名必填')
    if not isinstance(w.get('updatedAt'), str) or not isinstance(w.get('createdAt'), str):
        raise APIError(400, '资料日期无效')
    for field, value in w.items():
        if field in ('__proto__', 'constructor', 'prototype'):
            raise APIError(400, '资料字段无效')
        if field in ('educationHistory', 'workHistory'):
            limit = 2 if field == 'educationHistory' else 4
            if not isinstance(value, list) or len(value) > limit or any(not isinstance(h, dict) or any(not isinstance(v, str) for v in h.values()) for h in value):
                raise APIError(400, '经历格式或条数无效')
        elif field == '_version':
            if type(value) is not int:
                raise APIError(400, '资料版本无效')
        elif not isinstance(value, (str, bool, int, float, type(None))):
            raise APIError(400, '资料字段格式无效')
    if w.get('photo') and (not isinstance(w['photo'],str) or not re.fullmatch(r'data:image/jpeg;base64,[A-Za-z0-9+/=]+', w['photo'])):
        raise APIError(400, '照片必须为JPEG资料')


class Handler(BaseHTTPRequestHandler):
    server_version = 'ZY'

    def log_message(self, fmt, *args):
        # No request bodies, cookies, passwords or query strings in logs.
        return

    def reply(self, status, value=None, cookie=None, content_type='application/json; charset=utf-8'):
        body = json.dumps(value, ensure_ascii=False).encode() if content_type.startswith('application/json') else value
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; worker-src 'self' blob: https://cdn.jsdelivr.net; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        if self.headers.get_content_type() != 'application/json':
            raise APIError(415, '请使用JSON请求')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 1 or size > MAX_BODY:
                raise APIError(413, '请求过大或为空')
            value = json.loads(self.rfile.read(size))
        except (ValueError, UnicodeDecodeError):
            raise APIError(400, '请求格式无效')
        if not isinstance(value, dict):
            raise APIError(400, '请求须为JSON对象')
        return value

    def cookie(self, token='', clear=False):
        secure = '; Secure' if self.server.secure_cookie else ''
        return f'zy_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={0 if clear else SESSION_TTL}{secure}'

    def origin_check(self):
        # Enforce same-origin even for login; do not trust X-Forwarded-Host.
        origin = self.headers.get('Origin')
        if origin and origin != self.server.public_origin:
            raise APIError(403, '请求来源不被允许')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            raise APIError(403, '不允许跨站请求')

    def session(self, db, write=False, admin=False):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
            token = cookies['zy_session'].value if 'zy_session' in cookies else ''
        except Exception:
            token = ''
        hashed = hashlib.sha256(token.encode()).hexdigest()
        row = db.execute('SELECT s.csrf,u.id,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1', (hashed, time.time())).fetchone()
        if not row:
            raise APIError(401, '请先登录，或登录已过期')
        if write and not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), row['csrf']):
            raise APIError(403, '请求校验失败，请刷新后再试')
        if admin and row['role'] != 'admin':
            raise APIError(403, '此操作需要管理员权限')
        return row, hashed

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')

    def do_PUT(self):
        self.dispatch('PUT')

    def do_DELETE(self):
        self.dispatch('DELETE')

    def dispatch(self, method):
        try:
            path = urlsplit(self.path).path
            if path.startswith('/api/'):
                if method != 'GET':
                    self.origin_check()
                with connect(self.server.db_path) as db:
                    self.api(db, method, path)
            elif method == 'GET':
                if path=='/config.js':
                    return self.reply(200,b"window.ZY_CONFIG={provider:'sqlite'};",content_type='text/javascript; charset=utf-8')
                files = {'/': 'index.html', '/index.html': 'index.html', '/app.webmanifest': 'app.webmanifest', '/sw.js': 'sw.js', '/icon.svg': 'icon.svg', '/logo.png': 'logo.png', '/worker-registration.js':'worker-registration.js', '/workspace-theme.css':'workspace-theme.css', '/worker-registration.css':'worker-registration.css', '/worker-registration-template.png':'worker-registration-template.png', '/order-recognition.js':'order-recognition.js', '/i18n.js':'i18n.js', '/batch-editor.js':'batch-editor.js', '/order-parser.js':'order-parser.js', '/recognition-archive.js':'recognition-archive.js', '/ai-recognition.js':'ai-recognition.js', '/order-list.js':'order-list.js','/workflow-guards.js':'workflow-guards.js', '/shared.js': 'shared.js', '/supabase-adapter.js':'supabase-adapter.js'}
                if path not in files:
                    raise APIError(404, '找不到页面')
                target = ROOT / 'dist' / files[path]
                mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css':'text/css; charset=utf-8'}
                self.reply(200, target.read_bytes(), content_type=mime[target.suffix])
            else:
                raise APIError(405, '方法不被允许')
        except APIError as e:
            self.reply(e.status, {'error': e.message})
        except sqlite3.IntegrityError:
            self.reply(409, {'error': '记录已存在或资料冲突，请刷新后再试'})
        except (sqlite3.Error, OSError):
            self.reply(503, {'error': '保存服务暂不可用，请稍后重试，勿关闭未保存表单'})

    def api(self, db, method, path):
        if path == '/api/health' and method == 'GET':
            db.execute('SELECT revision FROM state WHERE id=1').fetchone()
            return self.reply(200, {'ok': True})
        if path == '/api/login' and method == 'POST':
            data = self.body()
            name, password = data.get('username'), data.get('password')
            if not isinstance(name, str) or not isinstance(password, str) or len(name)>64 or len(password)>256:
                raise APIError(400, '账号或密码格式错误')
            ip = self.client_address[0]  # Intentionally do not trust proxy-supplied IP headers.
            now = time.time()
            # Commit attempts before expensive password checking and unsuccessful logins.
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM attempts WHERE reset<?', (now,))
            attempt = db.execute('SELECT count FROM attempts WHERE ip=?', (ip,)).fetchone()
            if attempt and attempt['count'] >= 15:
                db.commit()
                raise APIError(429, '尝试过多，请15分钟后再试')
            db.execute('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET count=count+1', (ip, now+900))
            db.commit()
            user = db.execute('SELECT * FROM users WHERE username=? AND active=1', (name,)).fetchone()
            saved = user['password'] if user else self.server.dummy_password
            valid = password_ok(password, saved)
            if not user or not valid:
                raise APIError(401, '账号或密码错误')
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires<?', (now,))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(),user['id'],csrf,now+SESSION_TTL))
            db.commit()
            return self.reply(200, {'user': {k:user[k] for k in ('id','username','role')}, 'csrf':csrf}, self.cookie(token))
        user, token_hash = self.session(db, method!='GET', path.startswith('/api/users') or path in ('/api/export','/api/import') or (path=='/api/maintenance' and method!='GET'))
        if path == '/api/session' and method == 'GET':
            return self.reply(200, {'user':{k:user[k] for k in ('id','username','role')}, 'csrf':user['csrf']})
        if path == '/api/logout' and method == 'POST':
            db.execute('DELETE FROM sessions WHERE token_hash=?',(token_hash,));db.commit()
            return self.reply(200, {'ok':True}, self.cookie(clear=True))
        if path == '/api/maintenance' and method == 'GET':
            return self.reply(200,{'readOnly':bool(db.execute('SELECT read_only FROM settings WHERE id=1').fetchone()[0])})
        if path == '/api/maintenance' and method == 'POST':
            data=self.body()
            if type(data.get('readOnly')) is not bool:raise APIError(400,'维护状态无效')
            db.execute('BEGIN IMMEDIATE');db.execute('UPDATE settings SET read_only=? WHERE id=1',(int(data['readOnly']),));db.commit()
            return self.reply(200,{'readOnly':data['readOnly']})
        if path == '/api/export' and method == 'GET':
            from server.portable import export_db
            db.execute('BEGIN')
            return self.reply(200,export_db(db))
        if path == '/api/import' and method == 'POST':
            from server.portable import import_db
            data=self.body()
            if type(data.get('revision')) is not int:raise APIError(400,'缺少目标资料版本')
            db.execute('BEGIN IMMEDIATE')
            result=import_db(db,data.get('payload'),data['revision']);db.commit()
            return self.reply(200,result)
        if path == '/api/orders' and method == 'GET':
            row=db.execute('SELECT * FROM state WHERE id=1').fetchone()
            return self.reply(200, {'orders':json.loads(row['orders']),'revision':row['revision']})
        if path == '/api/orders' and method == 'PUT':
            data=self.body(); orders=data.get('orders');validate_orders(orders)
            if type(data.get('revision')) is not int:
                raise APIError(400,'缺少资料版本')
            db.execute('BEGIN IMMEDIATE')
            from server.portable import require_writable
            require_writable(db)
            row=db.execute('SELECT * FROM state WHERE id=1').fetchone()
            if row['revision']!=data['revision']:
                raise APIError(409,'其他人已修改订单，请先刷新列表并重新核对，当前修改尚未保存')
            old={o['id']:o for o in json.loads(row['orders'])}
            for o in orders:
                if o['id'] in old and (o['raw']!=old[o['id']]['raw'] or o['createdAt']!=old[o['id']]['createdAt']):
                    raise APIError(400,'编辑公司单不能更改原单或创建时间')
            revision=row['revision']+1
            db.execute('UPDATE state SET orders=?,revision=? WHERE id=1',(json.dumps(orders,ensure_ascii=False),revision));db.commit()
            return self.reply(200, {'revision':revision})
        if path == '/api/workers' and method == 'GET':
            records=[{**json.loads(r['data']),'_version':r['version']} for r in db.execute('SELECT * FROM workers')]
            return self.reply(200, {'workers':sorted(records,key=lambda w:w['updatedAt'],reverse=True)})
        if path == '/api/workers' and method == 'PUT':
            data=self.body();w=data.get('worker');validate_worker(w)
            version=w.get('_version',0)
            db.execute('BEGIN IMMEDIATE')
            from server.portable import require_writable
            require_writable(db)
            old=db.execute('SELECT * FROM workers WHERE id=?',(w['id'],)).fetchone()
            if (old['version'] if old else 0)!=version:
                raise APIError(409,'其他人已修改此资料，请先重新打开资料核对，当前修改尚未保存')
            if old:
                w['createdAt']=json.loads(old['data'])['createdAt']
            w.pop('_version',None)
            db.execute('INSERT INTO workers VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,data=excluded.data',(w['id'],version+1,json.dumps(w,ensure_ascii=False)));db.commit()
            return self.reply(200, {'version':version+1})
        if path == '/api/workers' and method == 'DELETE':
            data=self.body();validate_id(data.get('id'))
            db.execute('BEGIN IMMEDIATE')
            from server.portable import require_writable
            require_writable(db)
            row=db.execute('SELECT version FROM workers WHERE id=?',(data['id'],)).fetchone()
            if not row or row['version']!=data.get('version'):
                raise APIError(409,'资料已被修改或删除，请刷新后再试')
            db.execute('DELETE FROM workers WHERE id=?',(data['id'],));db.commit()
            return self.reply(200, {'ok':True})
        if path == '/api/users' and method == 'GET':
            return self.reply(200, {'users':[dict(r) for r in db.execute('SELECT id,username,role,active FROM users ORDER BY username')]})
        if path == '/api/users' and method == 'POST':
            data=self.body();validate_account(data.get('username'),data.get('password'),data.get('role'))
            db.execute('INSERT INTO users VALUES(?,?,?,?,1)',(secrets.token_hex(16),data['username'],password_hash(data['password']),data['role']));db.commit()
            return self.reply(201, {'ok':True})
        if path == '/api/users/disable' and method == 'POST':
            data=self.body();uid=data.get('id');validate_id(uid)
            if uid==user['id']:
                raise APIError(400,'不能停用自己的账号')
            db.execute('UPDATE users SET active=0 WHERE id=?',(uid,));db.execute('DELETE FROM sessions WHERE user_id=?',(uid,));db.commit()
            return self.reply(200, {'ok':True})
        if path == '/api/password' and method == 'POST':
            data=self.body();current,new=data.get('current'),data.get('password')
            validate_account(user['username'],new,user['role'])
            row=db.execute('SELECT password FROM users WHERE id=?',(user['id'],)).fetchone()
            if not isinstance(current,str) or len(current)>256 or not password_ok(current,row['password']):
                raise APIError(400,'当前密码不正确')
            db.execute('UPDATE users SET password=? WHERE id=?',(password_hash(new),user['id']))
            db.execute('DELETE FROM sessions WHERE user_id=?',(user['id'],));db.commit()
            return self.reply(200, {'ok':True},self.cookie(clear=True))
        raise APIError(404,'找不到接口')


def make_server(path, host='127.0.0.1', port=8080, public_origin='http://127.0.0.1:8080', secure=True):
    initialize(path)
    server=ThreadingHTTPServer((host,port),Handler)
    server.db_path=str(path);server.public_origin=public_origin.rstrip('/');server.secure_cookie=secure
    server.dummy_password=password_hash(secrets.token_urlsafe(32))
    return server


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['serve','create-admin','backup'])
    parser.add_argument('--db',default=os.environ.get('ZY_DB_PATH',str(ROOT/'var'/'zy.sqlite3')))
    parser.add_argument('--host',default=os.environ.get('ZY_HOST','127.0.0.1'))
    parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','8080')))
    parser.add_argument('--origin',default=os.environ.get('ZY_PUBLIC_ORIGIN','http://127.0.0.1:8080'))
    parser.add_argument('--dev',action='store_true',help='Local HTTP only; disable Secure cookie')
    parser.add_argument('--username')
    parser.add_argument('--output',help='Backup destination, outside the served dist directory')
    args=parser.parse_args();initialize(args.db)
    if args.command=='create-admin':
        username=args.username or input('Admin username: ')
        password=getpass.getpass('Password (12+ characters): ')
        if password!=getpass.getpass('Confirm password: '):
            parser.error('Passwords do not match')
        try:create_user(args.db,username,password,'admin')
        except (APIError,sqlite3.IntegrityError) as e:parser.error(getattr(e,'message','Account already exists'))
        print('Administrator created; no password is stored in setup files.')
    elif args.command=='backup':
        if not args.output:parser.error('--output is required')
        out=Path(args.output).resolve()
        if out.is_relative_to((ROOT/'dist').resolve()) or out==Path(args.db).resolve() or out.exists():parser.error('Choose a new private path outside dist and the live database')
        out.parent.mkdir(parents=True,exist_ok=True)
        with connect(args.db) as src,sqlite3.connect(out) as dst:src.backup(dst)
        os.chmod(out,0o600);print('Database backup completed')
    else:
        if not args.dev and not args.origin.startswith('https://'):parser.error('Production requires --origin https://your-domain (use --dev only for local HTTP)')
        if args.dev and (args.host not in ('127.0.0.1','localhost') or urlsplit(args.origin).hostname not in ('127.0.0.1','localhost')):parser.error('--dev must bind to loopback with a loopback origin')
        server=make_server(args.db,args.host,args.port,args.origin,not args.dev)
        print(f'ZY server listening on {args.host}:{args.port}',flush=True)
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()


if __name__=='__main__':main()
