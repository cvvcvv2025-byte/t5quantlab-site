"""SQLite-backed local D1 test transport. Never accesses a remote database."""
import json
import sqlite3
import sys

payload = json.load(sys.stdin)
db = sqlite3.connect(sys.argv[1])
db.row_factory = sqlite3.Row
try:
    results = []
    with db:
        for stmt in payload:
            before = db.total_changes
            cur = db.execute(stmt['sql'], stmt.get('values', []))
            rows = [dict(row) for row in cur.fetchall()] if cur.description else []
            results.append({'success': True, 'results': rows, 'meta': {'changes': db.total_changes - before}})
    print(json.dumps(results))
finally:
    db.close()
