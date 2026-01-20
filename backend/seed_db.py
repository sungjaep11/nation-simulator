import os
import sqlite3

def init_db():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "game.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. 테이블 생성
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            score INTEGER
        )
    ''')

    # 2. 초기 데이터 삽입 (필요한 경우)
    sample_data = [('player1', 100), ('player2', 200)]
    cursor.executemany('INSERT INTO users (username, score) VALUES (?, ?)', sample_data)

    conn.commit()
    conn.close()
    print("Database initialized successfully!")

if __name__ == "__main__":
    init_db()