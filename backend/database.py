from sqlmodel import create_engine, SQLModel, Session
import os

# SQLite 데이터베이스 설정
# backend 디렉토리에 DB 파일을 고정 위치로 생성
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "game.db")
# macOS에서 안정적으로 작동하도록 절대 경로 사용
sqlite_url = f"sqlite:///{DB_PATH}"
engine = create_engine(
    sqlite_url,
    connect_args={
        "check_same_thread": False,
        "timeout": 20,  # 타임아웃 설정
    },
    pool_pre_ping=True,  # 연결 상태 확인
    echo=False
)

def create_db_and_tables():
    """데이터베이스와 모든 테이블 생성"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """세션 제너레이터"""
    with Session(engine) as session:
        yield session