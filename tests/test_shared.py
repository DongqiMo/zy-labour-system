import http.cookiejar
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from server.app import create_user, make_server, connect, password_ok


class SharedServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.db=Path(cls.temp.name)/'zy.sqlite3'
        cls.server=make_server(cls.db,port=0,secure=False)
        cls.url='http://127.0.0.1:'+str(cls.server.server_address[1])
        cls.server.public_origin=cls.url
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        create_user(cls.db,'owner','owner-password-123','admin')
        create_user(cls.db,'colleague','staff-password-123','staff')

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()

    def client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self,client,path,method='GET',body=None,csrf=None,origin=None):
        headers={}
        if body is not None:headers['Content-Type']='application/json'
        if csrf:headers['X-CSRF-Token']=csrf
        if origin:headers['Origin']=origin
        req=urllib.request.Request(self.url+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
        try:
            with client.open(req) as r:return r.status,json.loads(r.read())
        except urllib.error.HTTPError as r:return r.code,json.loads(r.read())

    def login(self,name='owner',password='owner-password-123'):
        client=self.client();code,data=self.call(client,'/api/login','POST',{'username':name,'password':password},origin=self.url)
        self.assertEqual(code,200);return client,data['csrf']

    def test_01_authentication_csrf_and_access(self):
        anonymous=self.client()
        for path in ['/api/orders','/api/workers','/api/users']:
            self.assertEqual(self.call(anonymous,path)[0],401)
        self.assertEqual(self.call(anonymous,'/api/login','POST',{'username':'owner','password':'wrong'})[0],401)
        self.assertEqual(self.call(anonymous,'/api/login','POST',{'username':'owner','password':'owner-password-123'},origin='https://evil.example')[0],403)
        c,csrf=self.login()
        self.assertEqual(self.call(c,'/api/orders','PUT',{'orders':[],'revision':0})[0],403)
        staff,token=self.login('colleague','staff-password-123')
        self.assertEqual(self.call(staff,'/api/users')[0],403)
        self.assertEqual(self.call(staff,'/api/users','POST',{'username':'hacker','password':'hacker-password-123','role':'admin'},token)[0],403)
        self.assertEqual(self.call(c,'/api/logout','POST',{},csrf)[0],200)
        self.assertEqual(self.call(c,'/api/orders')[0],401)

    def test_02_shared_orders_conflicts_and_raw(self):
        a,ca=self.login();b,cb=self.login('colleague','staff-password-123')
        _,initial=self.call(a,'/api/orders');rev=initial['revision']
        order={'id':'test-order','code':'ZY-26-1102-01','title':'共享厨师','raw':'原单 HKD 18,799','salary':'HKD 18,799','createdAt':'2026-11-02T15:00:00Z','price':'3.8w','status':'ready'}
        status,data=self.call(b,'/api/orders','PUT',{'orders':[order],'revision':rev},cb)
        self.assertEqual(status,200)
        _,seen=self.call(a,'/api/orders');self.assertEqual(seen['orders'][0]['title'],'共享厨师')
        self.assertEqual(self.call(a,'/api/orders','PUT',{'orders':[],'revision':rev},ca)[0],409)
        order['raw']='不能覆盖原文'
        self.assertEqual(self.call(a,'/api/orders','PUT',{'orders':[order],'revision':data['revision']},ca)[0],400)
        _,current=self.call(a,'/api/orders');order=current['orders'][0]
        duplicate={**order,'id':'duplicate'}
        self.assertEqual(self.call(a,'/api/orders','PUT',{'orders':[order,duplicate],'revision':current['revision']},ca)[0],409)
        malicious={**order,'id':"bad');alert(1)//"}
        self.assertEqual(self.call(a,'/api/orders','PUT',{'orders':[malicious],'revision':current['revision']},ca)[0],400)
        with connect(self.db) as db:self.assertIn('共享厨师',db.execute('SELECT orders FROM state').fetchone()[0])

    def test_03_workers_conflicts_and_persistence(self):
        a,ca=self.login();b,cb=self.login('colleague','staff-password-123')
        w={'id':'worker-one','name':'共享劳工','createdAt':'2026-11-02T15:00:00Z','updatedAt':'2026-11-02T15:00:00Z','educationHistory':[],'workHistory':[]}
        self.assertEqual(self.call(b,'/api/workers','PUT',{'worker':w},cb)[0],200)
        _,result=self.call(a,'/api/workers');self.assertEqual(result['workers'][0]['name'],'共享劳工')
        self.assertEqual(result['workers'][0]['_version'],1)
        self.assertEqual(self.call(a,'/api/workers','PUT',{'worker':w},ca)[0],409)
        w=result['workers'][0];w['name']='已修订劳工'
        self.assertEqual(self.call(a,'/api/workers','PUT',{'worker':w},ca)[0],200)
        self.assertEqual(self.call(b,'/api/workers','DELETE',{'id':w['id'],'version':1},cb)[0],409)
        w['photo']='data:image/svg+xml;base64,AA';w['_version']=2
        self.assertEqual(self.call(a,'/api/workers','PUT',{'worker':w},ca)[0],400)
        with connect(self.db) as db:self.assertIn('已修订劳工',db.execute('SELECT data FROM workers').fetchone()[0])
        self.assertEqual(self.call(a,'/api/workers','DELETE',{'id':w['id'],'version':2},ca)[0],200)
        self.assertEqual(self.call(b,'/api/workers')[1]['workers'],[])

    def test_04_admin_disable_password_and_secrets(self):
        a,ca=self.login()
        self.assertEqual(self.call(a,'/api/users','POST',{'username':'temporary','password':'temporary-password-123','role':'staff'},ca)[0],201)
        b,cb=self.login('temporary','temporary-password-123')
        users=self.call(a,'/api/users')[1]['users'];uid=next(u['id'] for u in users if u['username']=='temporary')
        self.assertTrue(all('password' not in u for u in users))
        self.assertEqual(self.call(a,'/api/users/disable','POST',{'id':uid},ca)[0],200)
        self.assertEqual(self.call(b,'/api/session')[0],401)
        self.assertEqual(self.call(a,'/api/users','POST',{'username':'password-test','password':'original-password-123','role':'staff'},ca)[0],201)
        c,cc=self.login('password-test','original-password-123')
        self.assertEqual(self.call(c,'/api/password','POST',{'current':'original-password-123','password':'changed-password-123'},cc)[0],200)
        self.assertEqual(self.call(c,'/api/session')[0],401)
        self.login('password-test','changed-password-123')
        with connect(self.db) as db:
            saved=db.execute("SELECT password FROM users WHERE username='password-test'").fetchone()[0]
            self.assertNotIn('changed-password-123',saved);self.assertTrue(password_ok('changed-password-123',saved))
        self.assertEqual(self.call(a,'/var/zy.sqlite3')[0],404)

    def test_05_backup_and_server_restart(self):
        import subprocess
        backup=Path(self.temp.name)/'backup.sqlite3'
        subprocess.run(['python3','server/app.py','backup','--db',str(self.db),'--output',str(backup)],check=True,capture_output=True)
        restored=make_server(backup,port=0,secure=False)
        restored_url='http://127.0.0.1:'+str(restored.server_address[1]);restored.public_origin=restored_url
        threading.Thread(target=restored.serve_forever,daemon=True).start()
        old_url=self.url
        try:
            self.url=restored_url
            c,csrf=self.login()
            self.assertEqual(self.call(c,'/api/orders')[1]['orders'][0]['title'],'共享厨师')
            self.assertIn('colleague',[u['username'] for u in self.call(c,'/api/users')[1]['users']])
        finally:
            self.url=old_url;restored.shutdown();restored.server_close()


if __name__=='__main__':unittest.main()
