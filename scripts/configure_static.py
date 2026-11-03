"""Build PUBLIC static configuration from repository variables, never admin secrets."""
import base64
import json
import os
from pathlib import Path
from urllib.parse import urlsplit


def build(url,key):
    parsed=urlsplit(url)
    if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.path not in ('','/') or parsed.query or parsed.fragment:
        raise ValueError('SUPABASE_URL must be an HTTPS origin only')
    if not key or key.startswith('sb_secret_'):
        raise ValueError('Use only a public publishable/anon key; never service_role or sb_secret')
    if key.startswith('sb_publishable_'):
        if any(c.isspace() for c in key):raise ValueError('Public key has whitespace')
    else:
        try:
            part=key.split('.')[1];payload=json.loads(base64.urlsafe_b64decode(part+'='*(-len(part)%4)))
            if payload.get('role')!='anon':raise ValueError('not anon')
        except Exception:raise ValueError('Use a Supabase publishable key or legacy anon key')
    return {'provider':'supabase','supabaseUrl':url.rstrip('/'),'supabaseAnonKey':key}


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]/'dist'
    url,key=os.environ.get('SUPABASE_URL',''),os.environ.get('SUPABASE_ANON_KEY','')
    try:
        if not url and not key:
            existing=(root/'config.js').read_text().strip()
            if not existing.startswith('window.ZY_CONFIG='):raise ValueError('Public configuration is missing')
            current=json.loads(existing[len('window.ZY_CONFIG='):].rstrip(';'))
            url,key=current.get('supabaseUrl',''),current.get('supabaseAnonKey','')
        config=build(url,key)
    except (ValueError,OSError) as e:raise SystemExit(str(e))
    (root/'config.js').write_text('window.ZY_CONFIG='+json.dumps(config)+';\n')
    policy="default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' "+config['supabaseUrl']+" https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; worker-src 'self' blob: https://cdn.jsdelivr.net; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    (root/'_headers').write_text('/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: same-origin\n  Content-Security-Policy: '+policy+'\n')
    print('Public static configuration generated; no admin credentials included')
