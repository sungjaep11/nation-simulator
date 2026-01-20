#!/usr/bin/env python3
"""
사용자 데이터 초기화 스크립트

사용법:
    python reset_user_data.py <user_id>
    
또는 모든 사용자 데이터 초기화:
    python reset_user_data.py --all
"""

import sys
import os
from sqlmodel import Session, select
from database import engine, get_session, create_db_and_tables
from main import initialize_game_data
from models import User, Country, CommandLog, NewsItem, SecretIntelligence, MilitaryUnit, Diplomacy, Territory

# 데이터베이스 테이블 생성 (없는 경우)
create_db_and_tables()

def reset_user_data(user_id: int):
    """특정 사용자의 게임 데이터를 초기화합니다."""
    with Session(engine) as session:
        # 사용자 존재 확인
        try:
            user = session.exec(select(User).where(User.id == user_id)).first()
        except Exception as e:
            print(f"❌ 데이터베이스 오류: {e}")
            print("💡 데이터베이스 테이블을 생성했습니다. 사용자가 없습니다.")
            return False
        
        if not user:
            print(f"❌ 사용자 ID {user_id}를 찾을 수 없습니다.")
            print("💡 사용자 목록을 보려면: python reset_user_data.py --list")
            return False
        
        print(f"🔄 사용자 '{user.name}' (ID: {user_id}, Email: {user.email})의 게임 데이터를 초기화합니다...")
        
        try:
            initialize_game_data(session, user_id)
            print(f"✅ 사용자 '{user.name}'의 게임 데이터가 성공적으로 초기화되었습니다.")
            return True
        except Exception as e:
            print(f"❌ 초기화 중 오류 발생: {e}")
            return False

def reset_all_users():
    """모든 사용자의 게임 데이터를 초기화합니다."""
    with Session(engine) as session:
        try:
            users = session.exec(select(User)).all()
        except Exception as e:
            print(f"❌ 데이터베이스 오류: {e}")
            print("💡 데이터베이스 테이블을 생성했습니다. 사용자가 없습니다.")
            return
        
        if not users:
            print("❌ 데이터베이스에 사용자가 없습니다.")
            return
        
        print(f"⚠️  {len(users)}명의 사용자 데이터를 모두 초기화합니다.")
        confirm = input("계속하시겠습니까? (yes/no): ")
        if confirm.lower() != "yes":
            print("취소되었습니다.")
            return
        
        success_count = 0
        for user in users:
            if user.id:
                if reset_user_data(user.id):
                    success_count += 1
        
        print(f"\n✅ {success_count}/{len(users)}명의 사용자 데이터가 초기화되었습니다.")

def list_users():
    """모든 사용자 목록을 출력합니다."""
    with Session(engine) as session:
        try:
            users = session.exec(select(User)).all()
        except Exception as e:
            print(f"❌ 데이터베이스 오류: {e}")
            print("💡 데이터베이스 테이블을 생성했습니다. 사용자가 없습니다.")
            return
        
        if not users:
            print("❌ 데이터베이스에 사용자가 없습니다.")
            return
        
        print("\n📋 사용자 목록:")
        print("-" * 80)
        print(f"{'ID':<5} {'이름':<20} {'이메일':<30} {'Google ID':<20}")
        print("-" * 80)
        for user in users:
            google_id = user.google_id[:17] + "..." if user.google_id and len(user.google_id) > 20 else (user.google_id or "N/A")
            print(f"{user.id:<5} {user.name:<20} {user.email:<30} {google_id:<20}")
        print("-" * 80)
        print(f"총 {len(users)}명의 사용자")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법:")
        print("  python reset_user_data.py <user_id>     - 특정 사용자 데이터 초기화")
        print("  python reset_user_data.py --all         - 모든 사용자 데이터 초기화")
        print("  python reset_user_data.py --list        - 사용자 목록 보기")
        sys.exit(1)
    
    arg = sys.argv[1]
    
    if arg == "--all":
        reset_all_users()
    elif arg == "--list":
        list_users()
    else:
        try:
            user_id = int(arg)
            reset_user_data(user_id)
        except ValueError:
            print(f"❌ 잘못된 사용자 ID: {arg}")
            print("사용자 ID는 숫자여야 합니다.")
            sys.exit(1)
