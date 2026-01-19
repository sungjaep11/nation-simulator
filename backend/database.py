from sqlmodel import create_engine, SQLModel, Session
import os

# SQLite 데이터베이스 설정 (Alembic과 동일 경로 사용)
sqlite_url = "sqlite:///backend/game.db"
engine = create_engine(
    sqlite_url,
    connect_args={"check_same_thread": False},
    echo=False
)

def create_db_and_tables():
    """데이터베이스와 모든 테이블 생성"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """세션 제너레이터"""
    with Session(engine) as session:
        yield session