import sqlite3
import os

# Updated path from config.py
DB_PATH = '/opt/hivoid-panel/data/hivoid_panel.db'

def migrate():
    global DB_PATH
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        # Try relative fallback
        rel_path = os.path.join(os.path.dirname(__file__), 'data', 'hivoid_panel.db')
        if os.path.exists(rel_path):
             DB_PATH = rel_path
        else:
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
        ('obfs', 'TEXT DEFAULT "none"')
    ]

    for col_name, col_def in new_columns:
        if col_name not in existing_columns:
            print(f"Adding column: {col_name}")
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Database Migration Complete.")

if __name__ == "__main__":
    migrate()
