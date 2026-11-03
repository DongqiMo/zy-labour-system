import base64
import json
import unittest
from scripts.configure_static import build


class StaticConfigTests(unittest.TestCase):
    def test_public_keys_only(self):
        self.assertEqual(build('https://project.supabase.co/','sb_publishable_example')['provider'],'supabase')
        anon='a.'+base64.urlsafe_b64encode(json.dumps({'role':'anon'}).encode()).decode().rstrip('=')+'.z'
        self.assertEqual(build('https://project.supabase.co',anon)['supabaseAnonKey'],anon)
        service='a.'+base64.urlsafe_b64encode(json.dumps({'role':'service_role'}).encode()).decode().rstrip('=')+'.z'
        for key in ['sb_secret_private',service,'']:
            with self.assertRaises(ValueError):build('https://project.supabase.co',key)

    def test_https_origin_only(self):
        for url in ['http://project.supabase.co','https://user:password@project.supabase.co','https://project.supabase.co/path','https://project.supabase.co?key=secret','']:
            with self.assertRaises(ValueError):build(url,'sb_publishable_example')
