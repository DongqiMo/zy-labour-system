"""Export/import business data between SQLite and the Supabase portable JSON format."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server.app import APIError,connect,initialize
from server.portable import export_db,import_db,validate


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['export-sqlite','import-sqlite','inspect'])
    parser.add_argument('--db');parser.add_argument('--input');parser.add_argument('--output')
    args=parser.parse_args();os.umask(0o077)
    try:
        if args.command=='export-sqlite':
            if not args.db or not args.output:parser.error('--db and --output are required')
            if not Path(args.db).is_file():parser.error('Source database does not exist')
            out=Path(args.output).resolve();public=Path(__file__).resolve().parents[1]/'dist'
            if out.is_relative_to(public):parser.error('Never export private data inside dist')
            with connect(args.db) as db:
                db.execute('BEGIN');payload=export_db(db)
            text=json.dumps(payload,ensure_ascii=False,indent=2)+'\n'
            fd=os.open(out,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as f:f.write(text)
        else:
            if not args.input:parser.error('--input is required')
            text=Path(args.input).read_text();payload=validate(json.loads(text))
            if args.command=='import-sqlite':
                if not args.db:parser.error('--db is required')
                target=Path(args.db).resolve();public=Path(__file__).resolve().parents[1]/'dist'
                if target.is_relative_to(public):parser.error('Never put a private database inside dist')
                initialize(target)
                with connect(target) as db:
                    db.execute('BEGIN IMMEDIATE');import_db(db,payload)
        print(json.dumps({'format':payload['format'],'version':payload['version'],'orders':len(payload['orders']),'workers':len(payload['workers']),'sha256':hashlib.sha256(text.encode()).hexdigest()}))
    except (APIError,ValueError,OSError) as e:parser.exit(1,'Migration failed: '+getattr(e,'message',str(e))+'\n')


if __name__=='__main__':main()
