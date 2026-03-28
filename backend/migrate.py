import sqlite3
import os

import urllib.parse

settings_db_path = '/opt/hivoid-panel/data/hivoid_panel.db'
env_db_url = os.getenv('DATABASE_URL', '')

DB_PATH = settings_db_path
if env_db_url.startswith('sqlite'):
    parsed = urllib.parse.urlparse(env_db_url)
    path = parsed.path
    if path.startswith('/'):
         if os.name == 'nt' and path[2] == ':':
             path = path[1:]
    DB_PATH = path

def migrate():
    global DB_PATH
    print(f"Migrating database at: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print(f"Database file not found at {DB_PATH}. Exiting.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [col[1] for col in cursor.fetchall()]

    new_columns = [
        ('bandwidth_limit', 'INTEGER DEFAULT 0'),
        ('expire_at', 'TEXT'),
        ('bytes_in', 'INTEGER DEFAULT 0'),
        ('bytes_out', 'INTEGER DEFAULT 0'),
        ('mode', 'TEXT DEFAULT "performance"'),
        ('obfs', 'TEXT DEFAULT "none"'),
        ('max_ips', 'INTEGER DEFAULT 0'),
        ('bind_ip', 'TEXT'),
        ('pool_size', 'INTEGER DEFAULT 4'),
        ('bypass_domains', 'TEXT DEFAULT "localhost"'),
        ('bypass_ips', 'TEXT DEFAULT "127.0.0.1/32,192.168.1.0/24"'),
        ('geoip_path', 'TEXT DEFAULT "./geoip.dat"'),
        ('geosite_path', 'TEXT DEFAULT "./geosite.dat"'),
        ('direct_route', 'TEXT DEFAULT "category-ads"'),
        ('cert_pin', 'TEXT DEFAULT ""')
    ]

    for col_name, col_def in new_columns:
        if col_name not in existing_columns:
            print(f"Adding column: {col_name}")
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            except Exception as e:
                print(f"Error adding {col_name} to users: {e}")

    cursor.execute("PRAGMA table_info(admins)")
    admin_cols = [col[1] for col in cursor.fetchall()]
    for col_name, col_def in [('totp_secret', 'TEXT'), ('totp_enabled', 'BOOLEAN DEFAULT 0')]:
        if col_name not in admin_cols:
            print(f"Adding column {col_name} to admins")
            try:
                cursor.execute(f"ALTER TABLE admins ADD COLUMN {col_name} {col_def}")
            except Exception as e:
                print(f"Error adding {col_name} to admins: {e}")

    conn.commit()
    conn.close()
    print("Database Migration Complete.")

if __name__ == "__main__":
    migrate()
