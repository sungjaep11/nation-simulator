from sqlmodel import create_engine, SQLModel, Session
import os
import sqlite3
import stat

# SQLite 데이터베이스 설정
# backend 디렉토리에 DB 파일을 고정 위치로 생성
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "game.db"))  # Ensure absolute path
# macOS에서 안정적으로 작동하도록 절대 경로 사용
# Normalize path separators for SQLite URL
sqlite_url = f"sqlite:///{DB_PATH.replace(os.sep, '/')}"

# Ensure the database directory exists and has write permissions
os.makedirs(BASE_DIR, exist_ok=True)
# Ensure directory is writable
if not os.access(BASE_DIR, os.W_OK):
    raise PermissionError(f"Database directory is not writable: {BASE_DIR}")

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
        
        if "is_active" not in columns:
            cursor.execute("ALTER TABLE country ADD COLUMN is_active INTEGER DEFAULT 1")
        
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
    
    # Create database file explicitly with proper permissions BEFORE SQLAlchemy uses it
    if not os.path.exists(DB_PATH):
        # Create an empty database file
        conn = sqlite3.connect(DB_PATH)
        # Test write access immediately
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")  # Enable WAL mode for better concurrency
        conn.commit()
        conn.close()
        # Set file permissions to be writable (rw-rw-rw-)
        try:
            os.chmod(DB_PATH, 0o666)  # rw-rw-rw-
        except OSError as e:
            print(f"Warning: Could not set database file permissions: {e}")
    else:
        # File exists - ensure it's writable
        try:
            # Test if file is writable
            if not os.access(DB_PATH, os.W_OK):
                print(f"Database file exists but is not writable. Attempting to fix permissions...")
            # Set file permissions to be writable
            os.chmod(DB_PATH, 0o666)  # rw-rw-rw-
        except OSError as e:
            print(f"Warning: Could not set database file permissions: {e}")
            # Try to remove and recreate if permissions can't be fixed
            try:
                os.remove(DB_PATH)
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                conn.commit()
                conn.close()
                os.chmod(DB_PATH, 0o666)
                print("Recreated database file with proper permissions")
            except Exception as recreate_error:
                raise PermissionError(f"Could not fix database permissions: {recreate_error}")
    
    # Now create tables using SQLAlchemy
    SQLModel.metadata.create_all(engine)
    
    # 마이그레이션 실행
    migrate_add_last_change_columns()
    
    # Final check: ensure database file still has write permissions after operations
    if os.path.exists(DB_PATH):
        try:
            os.chmod(DB_PATH, 0o666)  # rw-rw-rw-
            # Verify write access
            if not os.access(DB_PATH, os.W_OK):
                raise PermissionError(f"Database file is not writable after creation: {DB_PATH}")
        except OSError as e:
            print(f"Warning: Could not verify database file permissions: {e}")

def ensure_db_permissions():
    """데이터베이스 파일의 쓰기 권한을 확인하고 수정"""
    if os.path.exists(DB_PATH):
        try:
            # Check if file is writable
            if not os.access(DB_PATH, os.W_OK):
                print(f"Database file is not writable. Fixing permissions...")
                os.chmod(DB_PATH, 0o666)
            else:
                # Ensure permissions are correct even if writable
                os.chmod(DB_PATH, 0o666)
            
            # Test actual write access by opening the database
            test_conn = sqlite3.connect(DB_PATH)
            test_cursor = test_conn.cursor()
            test_cursor.execute("PRAGMA journal_mode=WAL")
            test_conn.commit()
            test_conn.close()
        except (OSError, sqlite3.Error) as e:
            print(f"Warning: Could not verify/fix database file permissions: {e}")
            raise

def get_session():
    """세션 제너레이터"""
    with Session(engine) as session:
        yield session