from sqlmodel import create_engine, SQLModel, Session
import os
import sqlite3
import stat

# SQLite 데이터베이스 설정
# backend 디렉토리에 DB 파일을 고정 위치로 생성
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "game.db")
# macOS에서 안정적으로 작동하도록 절대 경로 사용
sqlite_url = f"sqlite:///{DB_PATH}"

# Ensure the database directory exists and has write permissions
os.makedirs(BASE_DIR, exist_ok=True)

engine = create_engine(
    sqlite_url,
    connect_args={
        "check_same_thread": False,
        "timeout": 20,  # 타임아웃 설정
    },
    pool_pre_ping=True,  # 연결 상태 확인
    echo=False
)

def migrate_add_last_change_columns():
    """country 테이블에 last_*_change 컬럼 추가 (마이그레이션)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 컬럼이 이미 존재하는지 확인하고 없으면 추가
        cursor.execute("PRAGMA table_info(country)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "last_finance_change" not in columns:
            cursor.execute("ALTER TABLE country ADD COLUMN last_finance_change INTEGER DEFAULT 0")
        
        if "last_population_change" not in columns:
            cursor.execute("ALTER TABLE country ADD COLUMN last_population_change INTEGER DEFAULT 0")
        
        if "last_military_change" not in columns:
            cursor.execute("ALTER TABLE country ADD COLUMN last_military_change INTEGER DEFAULT 0")
        
        if "last_happiness_change" not in columns:
            cursor.execute("ALTER TABLE country ADD COLUMN last_happiness_change INTEGER DEFAULT 0")
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Migration error: {e}")
    finally:
        conn.close()

def create_db_and_tables():
    """데이터베이스와 모든 테이블 생성"""
    # Ensure the directory is writable
    if not os.access(BASE_DIR, os.W_OK):
        raise PermissionError(f"Database directory is not writable: {BASE_DIR}")
    
    # Ensure database file exists and has write permissions
    if not os.path.exists(DB_PATH):
        # Create an empty database file with write permissions
        conn = sqlite3.connect(DB_PATH)
        conn.close()
    
    # Always ensure database file has write permissions (fixes existing files with wrong permissions)
    try:
        os.chmod(DB_PATH, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH)
    except OSError as e:
        print(f"Warning: Could not set database file permissions: {e}")
    
    SQLModel.metadata.create_all(engine)
    # 마이그레이션 실행
    migrate_add_last_change_columns()
    
    # Ensure database file still has write permissions after operations
    try:
        os.chmod(DB_PATH, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IWGRP | stat.S_IROTH | stat.S_IWOTH)
    except OSError as e:
        print(f"Warning: Could not set database file permissions after creation: {e}")

def get_session():
    """세션 제너레이터"""
    with Session(engine) as session:
        yield session