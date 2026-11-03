import json
from pathlib import Path
import tempfile
import unittest
from server.app import APIError,connect,initialize
from server.portable import export_db,import_db,validate,require_writable


class PortableTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'db.sqlite3';initialize(self.path)
        self.order={'id':'order-one','code':'ZY-26-1102-01','title':'厨师','salary':'HKD 18,799','raw':'原单\nDJ: 80000','createdAt':'2026-11-02T15:00:00Z','status':'draft','price':''}
        self.worker={'id':'worker-one','name':'测试劳工','createdAt':'2026-11-02T15:00:00Z','updatedAt':'2026-11-02T15:00:00Z','photo':'data:image/jpeg;base64,AA==','sourcePdfData':'data:application/pdf;base64,JVBERg==','educationHistory':[],'workHistory':[{'period':'2020-2026','employer':'餐厅','position':'厨师','duties':'工作'}]}
        self.payload={'format':'zy-labour-portable','version':1,'exportedAt':'2026-11-02T15:00:00Z','orders':[self.order],'workers':[self.worker]}

    def tearDown(self):self.temp.cleanup()

    def test_roundtrip_preserves_full_business_data(self):
        with connect(self.path) as db:
            db.execute('BEGIN IMMEDIATE');counts=import_db(db,self.payload,0)
        self.assertEqual(counts,{'orders':1,'workers':1,'revision':1})
        with connect(self.path) as db:
            db.execute('BEGIN');result=export_db(db)
        self.assertEqual(result['orders'],self.payload['orders']);self.assertEqual(result['workers'],self.payload['workers']);self.assertNotIn('users',result);self.assertNotIn('sessions',result)
        with connect(self.path) as db:
            db.execute('BEGIN IMMEDIATE')
            with self.assertRaisesRegex(APIError,'') as error:import_db(db,self.payload,1)
            self.assertIn('空数据库',error.exception.message)
        with connect(self.path) as db:self.assertEqual(export_db(db)['orders'],[self.order])

    def test_invalid_backup_no_partial_restore(self):
        with connect(self.path) as db:
            db.execute('BEGIN IMMEDIATE')
            for payload in [{**self.payload,'version':2},{**self.payload,'workers':[self.worker,self.worker]},{**self.payload,'workers':[{'id':'invalid'}]}]:
                with self.assertRaises(APIError):import_db(db,payload,0)
            self.assertEqual(export_db(db)['orders'],[]);self.assertEqual(export_db(db)['workers'],[])
            with self.assertRaises(APIError):import_db(db,self.payload,9)

    def test_readonly_allows_export_blocks_restore(self):
        with connect(self.path) as db:db.execute('UPDATE settings SET read_only=1 WHERE id=1')
        with connect(self.path) as db:
            db.execute('BEGIN IMMEDIATE')
            with self.assertRaises(APIError):require_writable(db)
            with self.assertRaises(APIError):import_db(db,self.payload,0)
            self.assertEqual(export_db(db)['orders'],[])
