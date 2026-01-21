#!/usr/bin/env python3
"""
사용자 데이터 초기화 스크립트

사용법:
    python reset_user_data.py <user_id>          - 사용자 ID로 초기화
    python reset_user_data.py --email <email>    - 이메일로 초기화
    python reset_user_data.py --all              - 모든 사용자 데이터 초기화
    python reset_user_data.py --list             - 사용자 목록 보기
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
    from sqlalchemy import delete
    
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
        
        print(f"🔄 사용자 '{user.name}' (ID: {user_id}, Email: {user.email})의 게임 데이터 및 계정 정보를 초기화합니다...")
        
        try:
            # 이메일 저장 (삭제 후 확인용)
            user_email = user.email
            
            # 해당 사용자의 기존 게임 데이터 삭제 (국가 생성 없이)
            user_countries = session.exec(select(Country).where(Country.user_id == user_id)).all()
            country_ids = [c.id for c in user_countries]
            
            if country_ids:
                # CommandLog bulk delete
                session.exec(delete(CommandLog).where(CommandLog.countryID.in_(country_ids)))  # type: ignore
                # NewsItem bulk delete
                session.exec(delete(NewsItem).where(NewsItem.countryID.in_(country_ids)))  # type: ignore
                # SecretIntelligence bulk delete
                session.exec(delete(SecretIntelligence).where(SecretIntelligence.countryID.in_(country_ids)))  # type: ignore
                # MilitaryUnit bulk delete
                session.exec(delete(MilitaryUnit).where(MilitaryUnit.countryID.in_(country_ids)))  # type: ignore
                # Diplomacy bulk delete
                session.exec(delete(Diplomacy).where(Diplomacy.sourceID.in_(country_ids)))  # type: ignore
                # 해당 사용자의 국가 이름 목록으로 targetName 기준 삭제
                country_names = [c.name for c in user_countries]
                if country_names:
                    session.exec(delete(Diplomacy).where(Diplomacy.targetName.in_(country_names)))  # type: ignore
                # Country bulk delete
                session.exec(delete(Country).where(Country.user_id == user_id))  # type: ignore
                
                print(f"🗑️ [데이터 초기화] 사용자 {user_id}의 기존 게임 데이터 삭제 완료")
            
            # Territory bulk delete
            session.exec(delete(Territory).where(Territory.user_id == user_id))  # type: ignore
            
            # 사용자 계정 정보 삭제 (일반 회원가입 정보 포함)
            # session.delete()를 사용하여 더 확실하게 삭제
            session.delete(user)
            
            # 커밋
            session.commit()
            
            # 삭제 확인
            deleted_user = session.exec(select(User).where(User.id == user_id)).first()
            if deleted_user:
                print(f"⚠️  경고: 사용자 삭제 후에도 여전히 존재합니다. 강제 삭제를 시도합니다...")
                session.delete(deleted_user)
                session.commit()
            
            # 이메일로도 확인
            email_check = session.exec(select(User).where(User.email == user_email)).first()
            if email_check:
                print(f"⚠️  경고: 이메일 '{user_email}'로 사용자가 여전히 존재합니다. 강제 삭제를 시도합니다...")
                session.delete(email_check)
                session.commit()
            
            print(f"✅ 사용자 '{user.name}' (Email: {user_email})의 게임 데이터 및 계정 정보가 성공적으로 삭제되었습니다.")
            print("💡 해당 사용자는 완전히 삭제되었으며, 다시 회원가입이 필요합니다.")
            return True
        except Exception as e:
            print(f"❌ 초기화 중 오류 발생: {e}")
            import traceback
            print(traceback.format_exc())
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

def reset_user_by_email(email: str):
    """이메일로 사용자의 게임 데이터를 초기화합니다."""
    with Session(engine) as session:
        try:
            user = session.exec(select(User).where(User.email == email)).first()
        except Exception as e:
            print(f"❌ 데이터베이스 오류: {e}")
            return False
        
        if not user:
            print(f"❌ 이메일 '{email}'에 해당하는 사용자를 찾을 수 없습니다.")
            print("💡 사용자 목록을 보려면: python reset_user_data.py --list")
            return False
        
        return reset_user_data(user.id)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법:")
        print("  python reset_user_data.py <user_id>          - 특정 사용자 데이터 초기화 (ID로)")
        print("  python reset_user_data.py --email <email>    - 특정 사용자 데이터 초기화 (이메일로)")
        print("  python reset_user_data.py --all              - 모든 사용자 데이터 초기화")
        print("  python reset_user_data.py --list             - 사용자 목록 보기")
        sys.exit(1)
    
    arg = sys.argv[1]
    
    if arg == "--all":
        reset_all_users()
    elif arg == "--list":
        list_users()
    elif arg == "--email":
        if len(sys.argv) < 3:
            print("❌ 이메일 주소를 입력해주세요.")
            print("사용법: python reset_user_data.py --email <email>")
            sys.exit(1)
        email = sys.argv[2]
        reset_user_by_email(email)
    else:
        try:
            user_id = int(arg)
            reset_user_data(user_id)
        except ValueError:
            print(f"❌ 잘못된 사용자 ID: {arg}")
            print("사용자 ID는 숫자여야 합니다.")
            print("이메일로 초기화하려면: python reset_user_data.py --email <email>")
            sys.exit(1)
