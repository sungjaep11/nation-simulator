from fastapi import FastAPI, Depends, HTTPException, Body, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from datetime import datetime, timedelta
import random
import asyncio
import re
from database import engine, create_db_and_tables, get_session
from models import Country, CommandLog, NewsItem, MilitaryUnit, Diplomacy, SecretIntelligence, User, Territory
from ai_service import get_gemini_game_data, get_ai_country_turn
import httpx
import os
import jwt
from dotenv import load_dotenv
import traceback
import bcrypt
import hashlib
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    """
    비밀번호 해싱 (SHA-256 사전 해싱 + Bcrypt)
    Bcrypt의 72바이트 제한을 피하기 위해 SHA-256으로 먼저 해싱한 후 Bcrypt 적용
    """
    # 1단계: SHA-256으로 사전 해싱 (64글자 고정)
    # hexdigest()로 문자열을 얻은 뒤, bcrypt가 처리할 수 있게 다시 bytes로 인코딩
    sha256_hash = hashlib.sha256(password.encode('utf-8')).hexdigest().encode('utf-8')
    
    # 2단계: Bcrypt로 암호화
    # bcrypt.hashpw는 bytes를 반환하므로, DB 저장을 위해 .decode()로 문자열로 변환
    return bcrypt.hashpw(sha256_hash, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    비밀번호 검증 (SHA-256 사전 해싱 + Bcrypt)
    """
    # 1단계: 입력값 SHA-256 사전 해싱
    sha256_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest().encode('utf-8')
    
    # 2단계: Bcrypt 검증
    # DB에 저장된 hashed_password는 문자열이므로 bytes로 인코딩해서 비교
    # checkpw(입력된_비밀번호_bytes, 저장된_해시_bytes)
    return bcrypt.checkpw(sha256_hash, hashed_password.encode('utf-8'))

load_dotenv()

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_ISSUER = "https://accounts.google.com"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

app = FastAPI()

# CORS configuration for frontend-backend communication
# Allow all origins in development if ALLOW_ALL_ORIGINS is set to "true"
# Otherwise, use specific origins from env or default localhost origins
allow_all_origins = os.getenv("ALLOW_ALL_ORIGINS", "false").lower() == "true"

if allow_all_origins:
    # Development mode: allow all origins
    origins = ["*"]
else:
    # Production/restricted mode: use specific origins
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # Add additional origins from environment variable (comma-separated)
    additional_origins = os.getenv("CORS_ORIGINS", "")
    if additional_origins:
        origins.extend([origin.strip() for origin in additional_origins.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if not allow_all_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== JWT Validation =====

async def verify_google_jwt(token: str) -> dict:
    """
    Google JWT 토큰을 Google의 공개 키로 검증
    Google tokeninfo API를 사용하여 토큰 검증
    
    Args:
        token: Google에서 받은 JWT 토큰
        
    Returns:
        검증된 토큰의 payload (사용자 정보 포함)
        
    Raises:
        HTTPException: 토큰 검증 실패 시
    """
    try:
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=500, 
                detail="GOOGLE_CLIENT_ID가 설정되지 않았습니다. backend/.env 파일을 확인하세요."
            )
        
        # Google tokeninfo API를 사용하여 토큰 검증
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token},
                timeout=10.0
            )
            
            if response.status_code != 200:
                error_text = response.text
                raise HTTPException(
                    status_code=401,
                    detail=f"Google 토큰 검증에 실패했습니다: {error_text}"
                )
            
            token_data = response.json()
            
            # Audience (Client ID) 검증
            if token_data.get("aud") != GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=401,
                    detail="토큰의 Client ID가 일치하지 않습니다."
                )
            
            # Issuer 검증
            if token_data.get("iss") not in [GOOGLE_ISSUER, "accounts.google.com", "https://accounts.google.com"]:
                raise HTTPException(
                    status_code=401,
                    detail="유효하지 않은 토큰 발행자입니다."
                )
            
            # Expiration 검증 (tokeninfo API가 이미 검증하지만, 추가 확인)
            exp = token_data.get("exp")
            if exp:
                import time
                # exp가 문자열일 수 있으므로 int로 변환
                exp_int = int(exp) if isinstance(exp, (int, str)) else None
                current_time = int(time.time())
                if exp_int and current_time > exp_int:
                    raise HTTPException(status_code=401, detail="토큰이 만료되었습니다.")
            
            return token_data
        
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        error_msg = f"Google API 호출 중 오류가 발생했습니다: {str(e)}"
        print(f"Google API Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)
    except Exception as e:
        error_msg = f"토큰 검증 중 오류가 발생했습니다: {str(e)}"
        print(f"JWT Verification Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


def create_session_token(user_id: int, email: str) -> str:
    """
    사용자 세션을 위한 JWT 토큰 생성
    
    Args:
        user_id: 사용자 ID
        email: 사용자 이메일
        
    Returns:
        세션 JWT 토큰
    """
    secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    expiration = datetime.utcnow() + timedelta(days=7)  # 7일 유효
    
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": expiration,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, secret_key, algorithm="HS256")
    return token


def verify_session_token(token: str) -> dict:
    """
    세션 토큰 검증
    
    Args:
        token: 세션 JWT 토큰
        
    Returns:
        검증된 토큰의 payload
        
    Raises:
        HTTPException: 토큰 검증 실패 시
    """
    try:
        secret_key = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="세션이 만료되었습니다.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")


# ===== 유틸리티 함수 =====

def check_spy_intelligence_leak(country_id: str, session: Session) -> dict:
    """
    스파이 정보 유출 체크
    모든 스파이는 동일한 확률(3%)로 정보 유출 가능
    
    Args:
        country_id: user_specific_country_id (예: 'goguryeo_1')
    
    Returns:
        leaked_intel: 유출된 비밀 정보 목록
    """
    SPY_LEAK_PROBABILITY = 0.03  # 3% 확률로 정보 유출
    
    leaked_intel = {}
    
    # 이 국가의 모든 스파이 검색
    # Fix: country_id should already be user_specific_country_id
    # SQLModel columns support .in_() method - type checker limitation, works at runtime
    spy_units = session.exec(
        select(MilitaryUnit).where(
            (MilitaryUnit.countryID == country_id) &  # Fix: This now correctly uses user_specific_country_id
            (MilitaryUnit.unit_type.in_(["spy", "assassin", "scout", "infiltrator"]))  # type: ignore
        )
    ).all()
    
    if not spy_units:
        return {"leaked": False, "details": []}
    
    # 각 스파이마다 유출 확률 체크
    leaked_details = []
    for spy_unit in spy_units:
        # 스파이 수만큼 시도 (더 많은 스파이 = 더 높은 유출 확률)
        for _ in range(min(spy_unit.count, 10)):  # 최대 10번만 체크
            if random.random() < SPY_LEAK_PROBABILITY:
                # 정보 유출 발생
                secrets = session.exec(
                    select(SecretIntelligence).where(
                        SecretIntelligence.countryID == country_id  # Fix: This now correctly uses user_specific_country_id
                    )
                ).all()
                
                if secrets:
                    leaked_secret = random.choice(secrets)
                    leaked_details.append({
                        "title": leaked_secret.title,
                        "content": leaked_secret.content,
                        "type": leaked_secret.intelligence_type,
                        "leaked_by": spy_unit.name
                    })
    
    return {
        "leaked": len(leaked_details) > 0,
        "details": leaked_details
    }


SPY_UNIT_TYPES = {"spy", "assassin", "scout", "infiltrator"}

# 외교 상태 영문 -> 한글 변환 매핑
DIPLOMACY_STATUS_EN_TO_KR = {
    "neutral": "중립",
    "alliance": "동맹",
    "ally": "동맹",
    "allied": "동맹",
    "hostile": "적대",
    "enemy": "적대",
    "war": "적대",
    "friendly": "우호",
    "friend": "우호",
}

def normalize_diplomacy_status(status: str) -> str:
    """
    외교 상태값을 한글로 정규화합니다.
    AI가 영문으로 반환한 경우 한글로 변환합니다.
    
    Args:
        status: 외교 상태값 (영문 또는 한글)
    
    Returns:
        한글로 정규화된 상태값 ("동맹", "중립", "적대" 중 하나)
    """
    if not status:
        return "중립"
    
    # 이미 한글인 경우 그대로 반환
    if status in ["동맹", "중립", "적대", "우호"]:
        return status
    
    # 영문인 경우 변환
    status_lower = status.lower().strip()
    return DIPLOMACY_STATUS_EN_TO_KR.get(status_lower, "중립")


def sanitize_ai_response_diplomacy(ai_data: dict) -> dict:
    """
    AI 응답에서 diplomacy 액션의 status 값을 한글로 보정합니다.
    
    Args:
        ai_data: AI가 반환한 응답 데이터
    
    Returns:
        status 값이 한글로 보정된 응답 데이터
    """
    if 'actions' not in ai_data:
        return ai_data
    
    for action in ai_data.get('actions', []):
        if action.get('type') == 'diplomacy':
            original_status = action.get('status', '')
            normalized_status = normalize_diplomacy_status(original_status)
            if original_status != normalized_status:
                print(f"🔄 [데이터 보정] 외교 status 변환: '{original_status}' -> '{normalized_status}'")
            action['status'] = normalized_status
    
    return ai_data


def adjust_military_for_spy(country: Country, unit_type: str, unit_count: int):
    """스파이 계열 유닛이 늘면 군사력을 함께 증가시킨다."""
    if unit_type in SPY_UNIT_TYPES:
        country.military += unit_count

# 지역 간 인접 관계 정의 (지리적 위치 기반)
TERRITORY_ADJACENCY: dict[str, list[str]] = {
    # 고구려 영토 (북한)
    "자강도": ["평안북도", "함경북도"],
    "함경북도": ["자강도", "함경남도", "량강도"],
    "함경남도": ["함경북도", "강원특별자치도"],
    "황해북도": ["평안남도", "황해남도", "개성특별시"],
    "황해남도": ["황해북도", "경기도"],
    "개성특별시": ["황해북도", "경기도"],
    "강원특별자치도": ["함경남도", "경기도", "충청북도"],
    "평안북도": ["자강도", "평안남도"],
    "평안남도": ["평안북도", "황해북도", "평양직할시"],
    "평양직할시": ["평안남도", "황해북도"],
    "량강도": ["함경북도"],
    "신의주시": ["평안북도"],
    "남포특별시": ["평안남도"],
    "라선특별시": ["함경북도"],
    
    # 백제 영토 (서남부)
    "서울특별시": ["인천광역시", "경기도", "강원특별자치도"],
    "인천광역시": ["서울특별시", "경기도"],
    "경기도": ["서울특별시", "인천광역시", "강원특별자치도", "충청북도", "충청남도"],
    "충청북도": ["경기도", "강원특별자치도", "충청남도", "세종특별자치시", "대전광역시"],
    "충청남도": ["경기도", "충청북도", "세종특별자치시", "대전광역시", "전라북도", "전북특별자치도"],
    "세종특별자치시": ["충청북도", "충청남도", "대전광역시"],
    "대전광역시": ["충청북도", "충청남도", "세종특별자치시"],
    "전라북도": ["충청남도", "전라남도", "광주광역시"],
    "전북특별자치도": ["충청남도", "전라남도", "광주광역시"],
    "전라남도": ["전라북도", "전북특별자치도", "광주광역시", "제주특별자치도"],
    "광주광역시": ["전라북도", "전북특별자치도", "전라남도"],
    "제주특별자치도": ["전라남도"],
    
    # 신라 영토 (동남부)
    "경상북도": ["강원특별자치도", "충청북도", "경상남도", "대구광역시"],
    "경상남도": ["경상북도", "대구광역시", "부산광역시", "울산광역시"],
    "대구광역시": ["경상북도", "경상남도"],
    "울산광역시": ["경상남도", "부산광역시"],
    "부산광역시": ["경상남도", "울산광역시"],
}

# 모든 지역명 목록
ALL_PROVINCE_NAMES = [
    "자강도", "함경북도", "함경남도", "황해북도", "황해남도", "개성특별시",
    "강원특별자치도", "평안북도", "평안남도", "평양직할시", "량강도", "신의주시",
    "남포특별시", "라선특별시", "서울특별시", "인천광역시", "경기도", "충청북도",
    "충청남도", "세종특별자치시", "대전광역시", "전라북도", "전북특별자치도",
    "전라남도", "광주광역시", "제주특별자치도", "경상북도", "경상남도",
    "대구광역시", "울산광역시", "부산광역시"
]


def extract_province_name_from_text(text: str) -> str | None:
    """텍스트에서 지역명을 추출합니다."""
    if not text:
        return None
    
    # 모든 지역명을 긴 것부터 정렬 (예: "서울특별시"가 "서울"보다 먼저 매칭되도록)
    sorted_provinces = sorted(ALL_PROVINCE_NAMES, key=len, reverse=True)
    
    for province in sorted_provinces:
        # 정확한 매칭 또는 "지역", "을", "를", "의" 등이 뒤에 오는 경우도 포함
        if province in text:
            # "경기도 지역", "인천광역시를" 같은 패턴도 매칭
            return province
    
    return None


def find_adjacent_territories(
    attacker_territories: list[Territory],
    target_territories: list[Territory],
    count: int
) -> list[Territory]:
    """공격자의 영토와 인접한 상대방 영토를 찾습니다."""
    if not attacker_territories or not target_territories:
        return []
    
    # 공격자의 지역명 목록
    attacker_province_names = {t.province_name for t in attacker_territories}
    
    # 각 상대방 영토의 인접도 계산
    territory_scores = []
    for target_territory in target_territories:
        score = 0
        # 이 영토와 인접한 공격자 영토 개수 계산
        adjacent_to_attacker = TERRITORY_ADJACENCY.get(target_territory.province_name, [])
        for adjacent in adjacent_to_attacker:
            if adjacent in attacker_province_names:
                score += 1
        
        territory_scores.append((score, target_territory))
    
    # 인접도가 높은 순으로 정렬
    territory_scores.sort(key=lambda x: x[0], reverse=True)
    
    # 인접도가 높은 영토 선택 (최대 count개)
    selected = [t for _, t in territory_scores[:count] if _ > 0]
    
    # 인접한 영토가 부족하면 나머지는 랜덤 선택
    if len(selected) < count:
        remaining = [t for t in target_territories if t not in selected]
        if remaining:
            import random
            additional = random.sample(remaining, min(count - len(selected), len(remaining)))
            selected.extend(additional)
    
    return selected
def categorize_news(text: str) -> str:
    """뉴스 텍스트를 war/diplomacy/economy/event로 분류"""
    lower = text.lower()
    war_kw = ["전투", "전쟁", "침공", "군사", "병력", "공격", "방어", "전황", "전선", "포격", "기습", "전투력"]
    dip_kw = ["외교", "동맹", "휴전", "협상", "조약", "국교", "사절", "회담", "관계", "우호"]
    eco_kw = ["재정", "경제", "무역", "금", "곡물", "세금", "물가", "수입", "지출", "시장", "상업"]
    if any(k in lower for k in war_kw):
        return "war"
    if any(k in lower for k in dip_kw):
        return "diplomacy"
    if any(k in lower for k in eco_kw):
        return "economy"
    return "event"


def news_title_for_type(news_type: str) -> str:
    return {
        "war": "전황 보고",
        "diplomacy": "외교 보고",
        "economy": "경제 보고",
        "event": "국내 소식",
    }.get(news_type, "국내 소식")


@app.get("/")
async def root():
    return {"message": "Nation Simulator API is running"}

@app.get("/status")
async def status():
    return {"status": "ok"}

@app.post("/api/reset")
async def reset_game(
    session_token: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """게임 데이터 초기화 - 사용자별로 초기화"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        initialize_game_data(session, user_id)
        return {"message": "게임 데이터가 초기화되었습니다.", "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"초기화 중 오류가 발생했습니다: {str(e)}")

@app.post("/api/auth/google")
async def verify_google_token(
    credential: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """
    Google JWT 토큰 검증 및 사용자 세션 생성
    
    1. Google의 공개 키로 JWT 검증
    2. 사용자 정보 추출 및 DB 저장/업데이트
    3. 세션 토큰 생성 및 반환
    """
    try:
        # Google의 공개 키로 JWT 검증
        token_payload = await verify_google_jwt(credential)
        
        # 토큰에서 사용자 정보 추출
        google_id = token_payload.get("sub")
        email = token_payload.get("email")
        name = token_payload.get("name") or token_payload.get("given_name") or "User"
        picture = token_payload.get("picture")
        
        if not google_id or not email:
            raise HTTPException(
                status_code=400,
                detail="토큰에서 필요한 사용자 정보를 가져올 수 없습니다."
            )
        
        # 기존 사용자 확인 (Google ID로 먼저 확인)
        statement = select(User).where(User.google_id == google_id)
        user = session.exec(statement).first()
        is_new_user = False
        
        if user:
            # 기존 Google 사용자 정보 업데이트
            user.email = email
            user.name = name
            user.picture = picture
            user.last_login = datetime.utcnow()
        else:
            # 이메일로도 확인 (이메일 계정이 이미 있는 경우)
            existing_email_user = session.exec(select(User).where(User.email == email)).first()
            if existing_email_user:
                # 이메일 계정이 있으면 Google ID 연결
                existing_email_user.google_id = google_id
                existing_email_user.name = name
                existing_email_user.picture = picture
                existing_email_user.last_login = datetime.utcnow()
                user = existing_email_user
            else:
                # 완전히 새 사용자 생성
                is_new_user = True
                user = User(
                    google_id=google_id,
                    email=email,
                    name=name,
                    picture=picture
                )
                session.add(user)
        
        session.commit()
        session.refresh(user)
        
        # user.id가 None인 경우 에러 처리
        if user.id is None:
            raise HTTPException(
                status_code=500,
                detail="사용자 ID를 가져올 수 없습니다."
            )
        
        user_id = user.id  # Type narrowing
        
        # 세션 토큰 생성
        session_token = create_session_token(user_id, user.email)
        
        # 사용자명이 필요한지 확인 (새 사용자이거나 이름이 기본값인 경우)
        needs_username = is_new_user or (user.name == "User" or not user.name or len(user.name.strip()) < 2)
        
        # 게임 데이터 확인 및 초기화 (사용자명이 이미 설정된 경우에만)
        existing_countries = session.exec(
            select(Country).where(Country.user_id == user_id)
        ).first()
        
        # 게임 데이터가 없고 사용자명이 이미 설정된 경우에만 초기화
        # (사용자명이 필요한 경우는 create-username 페이지에서 초기화됨)
        if not existing_countries and not needs_username:
            initialize_game_data(session, user_id)
        
        return {
            "message": "Google 로그인 성공",
            "status": "success",
            "session_token": session_token,
            "is_new_user": is_new_user,
            "needs_username": needs_username,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture
            }
        }
            
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"로그인 처리 중 오류가 발생했습니다: {str(e)}"
        print(f"Google Auth Error: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=error_msg
        )

@app.post("/api/user/username")
async def update_username(
    username: str = Body(..., embed=True),
    session_token: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """사용자명 업데이트 및 게임 초기화"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 사용자명 검증
        if not username or len(username.strip()) < 2:
            raise HTTPException(status_code=400, detail="사용자명은 최소 2자 이상이어야 합니다.")
        if len(username.strip()) > 20:
            raise HTTPException(status_code=400, detail="사용자명은 20자 이하여야 합니다.")
        
        # 사용자 정보 업데이트
        user = session.exec(select(User).where(User.id == user_id)).first()
        if user:
            user.name = username.strip()
            session.add(user)
            session.commit()
        
        # 게임 데이터 초기화 (없을 때만)
        existing_countries = session.exec(
            select(Country).where(Country.user_id == user_id)
        ).first()
        if not existing_countries:
            initialize_game_data(session, user_id)
        
        return {
            "message": "사용자명이 설정되었습니다.",
            "status": "success",
            "username": username.strip()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"사용자명 설정 중 오류가 발생했습니다: {str(e)}"
        )

@app.post("/api/register")
async def register_user(
    email: str = Body(..., embed=True),
    username: str = Body(..., embed=True),
    password: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """이메일/비밀번호로 회원가입"""
    try:
        # 입력 검증
        if not email or not username or not password:
            raise HTTPException(status_code=400, detail="모든 필드를 입력해주세요.")
        
        if len(username.strip()) < 2 or len(username.strip()) > 20:
            raise HTTPException(status_code=400, detail="사용자명은 2-20자 사이여야 합니다.")
        
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="비밀번호는 최소 6자 이상이어야 합니다.")
        
        # 사전 해싱 방식을 사용하므로 비밀번호 길이 제한 없음 (SHA-256으로 처리)
        
        # 이메일 중복 확인
        existing_user = session.exec(select(User).where(User.email == email)).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        
        # 비밀번호 해싱 (hash_password 함수 내에서도 안전하게 처리됨)
        password_hash = hash_password(password)
        
        # 새 사용자 생성
        new_user = User(
            email=email.strip(),
            name=username.strip(),
            password_hash=password_hash,
            google_id=None
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        if new_user.id is None:
            raise HTTPException(status_code=500, detail="사용자 생성에 실패했습니다.")
        
        user_id = new_user.id  # Type narrowing
        
        # 세션 토큰 생성
        session_token = create_session_token(user_id, new_user.email)
        
        # 게임 데이터 초기화
        initialize_game_data(session, user_id)
        
        return {
            "message": "회원가입 성공",
            "status": "success",
            "session_token": session_token,
            "user": {
                "id": new_user.id,
                "email": new_user.email,
                "name": new_user.name
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"회원가입 중 오류가 발생했습니다: {str(e)}"
        )

@app.post("/api/login")
async def login_user(
    email: str = Body(..., embed=True),
    password: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """이메일/비밀번호로 로그인"""
    try:
        if not email or not password:
            raise HTTPException(status_code=400, detail="이메일과 비밀번호를 입력해주세요.")
        
        # 사용자 찾기
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            logger.info(f"로그인 실패: 이메일을 찾을 수 없음 - {email}")
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        
        # 비밀번호 확인
        if not user.password_hash:
            logger.info(f"로그인 실패: 비밀번호 해시가 없음 - {email}")
            raise HTTPException(status_code=401, detail="이 계정은 비밀번호 로그인을 지원하지 않습니다.")
        
        if not verify_password(password, user.password_hash):
            logger.info(f"로그인 실패: 비밀번호 불일치 - {email}")
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        
        # 로그인 시간 업데이트
        user.last_login = datetime.utcnow()
        session.add(user)
        session.commit()
        
        if user.id is None:
            raise HTTPException(status_code=500, detail="사용자 ID를 가져올 수 없습니다.")
        
        user_id = user.id  # Type narrowing
        
        # 세션 토큰 생성
        session_token = create_session_token(user_id, user.email)
        
        # 게임 데이터 확인 및 초기화 (없으면 초기화)
        existing_countries = session.exec(
            select(Country).where(Country.user_id == user_id)
        ).first()
        
        if not existing_countries:
            initialize_game_data(session, user_id)
        
        logger.info(f"로그인 성공: {email} (user_id: {user_id})")
        
        return {
            "message": "로그인 성공",
            "status": "success",
            "session_token": session_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"로그인 중 오류가 발생했습니다: {str(e)}"
        )

@app.get("/api/country/{country_id}")
async def get_country(
    country_id: str, 
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """특정 국가의 현재 상태 조회 (사용자별)"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        # 예: 'goguryeo' -> 'goguryeo_2' (user_id가 2인 경우)
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가만 조회
        statement = select(Country).where(
            (Country.id == user_specific_country_id) & (Country.user_id == user_id)
        )
        country = session.exec(statement).first()
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"국가 조회 중 오류가 발생했습니다: {str(e)}")
    
    # 프론트엔드에 반환할 때는 원래 country_id만 반환 (user_id 제거)
    return {
        "id": country_id,  # 원래 country_id 반환 (goguryeo, baekje, silla)
        "name": country.name,
        "finance": country.finance,
        "population": country.population,
        "happiness": country.happiness,
        "military": country.military,
        "totalScore": country.totalScore,
        "turn": country.turn,
        "title": country.title,
        "color": country.color,
        "lastFinanceChange": country.last_finance_change,
        "lastPopulationChange": country.last_population_change,
        "lastMilitaryChange": country.last_military_change,
        "lastHappinessChange": country.last_happiness_change
    }

@app.get("/api/countries")
async def get_all_countries(
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """사용자별 모든 국가 조회"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 해당 사용자의 국가만 조회
        countries = session.exec(select(Country).where(Country.user_id == user_id)).all()
        
        return [
            {
                "id": c.id.rsplit("_", 1)[0] if "_" in c.id else c.id,  # user_id 제거하여 원래 형식으로 반환
                "name": c.name,
                "finance": c.finance,
                "population": c.population,
                "happiness": c.happiness,
                "military": c.military,
                "totalScore": c.totalScore,
                "turn": c.turn,
                "title": c.title,
                "color": c.color,
                "lastFinanceChange": c.last_finance_change,
                "lastPopulationChange": c.last_population_change,
                "lastMilitaryChange": c.last_military_change,
                "lastHappinessChange": c.last_happiness_change
            }
            for c in countries
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"국가 조회 중 오류가 발생했습니다: {str(e)}")

@app.get("/api/country/{country_id}/news")
async def get_country_news(
    country_id: str,
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """특정 국가의 뉴스 조회 (사용자별)"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가인지 확인
        country = session.exec(
            select(Country).where(
                (Country.id == user_specific_country_id) & (Country.user_id == user_id)
            )
        ).first()
        
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
        
        statement = select(NewsItem).where(NewsItem.countryID == user_specific_country_id)
        news_items = session.exec(statement).all()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"뉴스 조회 중 오류가 발생했습니다: {str(e)}")
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "type": n.type
        }
        for n in news_items
    ]

@app.get("/api/country/{country_id}/military")
async def get_military_units(
    country_id: str,
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """특정 국가의 군대 구성 조회 (사용자별)"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가인지 확인
        country = session.exec(
            select(Country).where(
                (Country.id == user_specific_country_id) & (Country.user_id == user_id)
            )
        ).first()
        
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
        
        statement = select(MilitaryUnit).where(MilitaryUnit.countryID == user_specific_country_id)
        units = session.exec(statement).all()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"군대 구성 조회 중 오류가 발생했습니다: {str(e)}")
    
    return [
        {
            "id": u.id,
            "name": u.name,
            "count": u.count,
            "icon": u.icon
        }
        for u in units
    ]

@app.get("/api/country/{country_id}/diplomacy")
async def get_diplomacy(
    country_id: str,
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """특정 국가의 외교 관계 조회 (사용자별)"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가인지 확인
        country = session.exec(
            select(Country).where(
                (Country.id == user_specific_country_id) & (Country.user_id == user_id)
            )
        ).first()
        
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
        
        statement = select(Diplomacy).where(Diplomacy.sourceID == user_specific_country_id)
        relations = session.exec(statement).all()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"외교 관계 조회 중 오류가 발생했습니다: {str(e)}")
    
    return [
        {
            "id": d.id,
            "targetName": d.targetName,
            "status": normalize_diplomacy_status(d.status),
            "favorability": d.favorability
        }
        for d in relations
    ]

@app.get("/api/country/{country_id}/logs")
async def get_command_logs(
    country_id: str,
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """특정 국가의 명령 기록 조회 (사용자별)"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가인지 확인
        country = session.exec(
            select(Country).where(
                (Country.id == user_specific_country_id) & (Country.user_id == user_id)
            )
        ).first()
        
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
        
        # Use SQLModel column's desc() method - type checker may show error but works at runtime
        statement = select(CommandLog).where(CommandLog.countryID == user_specific_country_id).order_by(CommandLog.timestamp.desc())  # type: ignore
        logs = session.exec(statement).all()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"명령 기록 조회 중 오류가 발생했습니다: {str(e)}")
    
    return [
        {
            "id": l.id,
            "command": l.command,
            "response": l.response,
            "timestamp": l.timestamp.isoformat()
        }
        for l in logs
    ]

def initialize_game_data(session: Session, user_id: int):
    """사용자별 게임 데이터 초기화 함수"""
    # 해당 사용자의 기존 게임 데이터 삭제
    user_countries = session.exec(select(Country).where(Country.user_id == user_id)).all()
    country_ids = [c.id for c in user_countries]
    
    if country_ids:
        # 해당 사용자의 모든 게임 데이터 삭제
        for country_id in country_ids:
            # CommandLog 삭제
            logs = session.exec(select(CommandLog).where(CommandLog.countryID == country_id)).all()
            for log in logs:
                session.delete(log)
            # NewsItem 삭제
            news = session.exec(select(NewsItem).where(NewsItem.countryID == country_id)).all()
            for item in news:
                session.delete(item)
            # SecretIntelligence 삭제
            intel = session.exec(select(SecretIntelligence).where(SecretIntelligence.countryID == country_id)).all()
            for item in intel:
                session.delete(item)
            # MilitaryUnit 삭제
            units = session.exec(select(MilitaryUnit).where(MilitaryUnit.countryID == country_id)).all()
            for unit in units:
                session.delete(unit)
            # Diplomacy 삭제
            diplomacy = session.exec(select(Diplomacy).where(Diplomacy.sourceID == country_id)).all()
            for d in diplomacy:
                session.delete(d)
            # Country 삭제
            for country in user_countries:
                session.delete(country)
    
    # Territory 삭제
    territories = session.exec(select(Territory).where(Territory.user_id == user_id)).all()
    for territory in territories:
        session.delete(territory)
    
    session.commit()
    
    # 초기 데이터 삽입 (사용자별로 고유한 국가 ID 생성)
    countries = [
        Country(
            id=f"goguryeo_{user_id}",
            user_id=user_id,
            name="고구려",
            finance=14000,
            population=51000,
            military=17,
            happiness=50,
            turn=1,
            title="호전적인 국가",
            color="#FF6B6B"
        ),
        Country(
            id=f"baekje_{user_id}",
            user_id=user_id,
            name="백제",
            finance=50000,
            population=35000,
            military=13,
            happiness=50,
            turn=1,
            title="문화 강국",
            color="#4ECDC4"
        ),
        Country(
            id=f"silla_{user_id}",
            user_id=user_id,
            name="신라",
            finance=10000,
            population=70000,
            military=14,
            happiness=50,
            turn=1,
            title="균형잡힌 국가",
            color="#FFD93D"
        )
    ]
    # 각 국가의 초기 totalScore 계산
    for country in countries:
        country.update_total_score()
    
    session.add_all(countries)
    session.commit()
    
    # 초기 영토 소유권 설정 (KoreaMap.tsx의 provinceToKingdom 매핑과 일치)
    initial_territories = [
        # 고구려 영토 (북한 지역)
        ("자강도", "goguryeo"),
        ("함경북도", "goguryeo"),
        ("함경남도", "goguryeo"),
        ("황해북도", "goguryeo"),
        ("황해남도", "goguryeo"),
        ("개성특별시", "goguryeo"),
        ("강원특별자치도", "goguryeo"),  # 강원도는 고구려
        ("금강산", "goguryeo"),
        ("남포특별시", "goguryeo"),
        ("평안북도", "goguryeo"),
        ("평안남도", "goguryeo"),
        ("평양직할시", "goguryeo"),
        ("라선특별시", "goguryeo"),
        ("량강도", "goguryeo"),
        ("신의주시", "goguryeo"),
        
        # 백제 영토 (서남부)
        ("서울특별시", "baekje"),
        ("인천광역시", "baekje"),
        ("경기도", "baekje"),
        ("충청북도", "baekje"),
        ("충청남도", "baekje"),
        ("세종특별자치시", "baekje"),
        ("대전광역시", "baekje"),
        ("전라북도", "baekje"),
        ("전북특별자치도", "baekje"),
        ("전라남도", "baekje"),
        ("광주광역시", "baekje"),
        ("제주특별자치도", "baekje"),
        
        # 신라 영토 (동남부)
        ("경상북도", "silla"),
        ("경상남도", "silla"),
        ("대구광역시", "silla"),
        ("울산광역시", "silla"),
        ("부산광역시", "silla"),
    ]
    
    territories = [
        Territory(
            user_id=user_id,
            province_name=province_name,
            owner=owner
        )
        for province_name, owner in initial_territories
    ]
    session.add_all(territories)
    session.commit()

@app.on_event("startup")
def on_startup():
    from database import ensure_db_permissions
    create_db_and_tables()
    ensure_db_permissions()  # Ensure permissions after creation
    # 게임 데이터는 사용자별로 초기화되므로 여기서는 초기화하지 않음

@app.post("/api/action")
async def handle_game_turn(
    user_input: str = Body(..., embed=True),
    country_id: str = Body(..., embed=True),
    session_token: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """게임 턴 처리 - 유저 국가 + AI 국가들 자동 업데이트 (사용자별)"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가만 조회
        statement = select(Country).where(
            (Country.id == user_specific_country_id) & (Country.user_id == user_id)
        )
        country = session.exec(statement).first()
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")

        # 해당 사용자의 모든 국가 정보 가져오기
        all_countries_db = session.exec(select(Country).where(Country.user_id == user_id)).all()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"게임 턴 처리 중 오류가 발생했습니다: {str(e)}")
    all_countries_dict = {
        c.id.rsplit("_", 1)[0] if "_" in c.id else c.id: {  # user_id 제거하여 프론트엔드 형식으로 변환
            "id": c.id.rsplit("_", 1)[0] if "_" in c.id else c.id,
            "name": c.name,
            "finance": c.finance,
            "population": c.population,
            "military": c.military,
            "happiness": c.happiness,
            "turn": c.turn
        }
        for c in all_countries_db
    }
    
    # 유저 국가의 외교 정보 가져오기
    diplomacy_relations = session.exec(
        select(Diplomacy).where(Diplomacy.sourceID == user_specific_country_id)
    ).all()
    user_diplomacy = [
        {
            "targetName": d.targetName,
            "status": normalize_diplomacy_status(d.status),
            "favorability": d.favorability
        }
        for d in diplomacy_relations
    ]
    
    # 유저 국가의 군사 유닛 정보 가져오기
    military_units = session.exec(
        select(MilitaryUnit).where(MilitaryUnit.countryID == user_specific_country_id)
    ).all()
    user_military = [
        {
            "name": u.name,
            "count": u.count,
            "icon": u.icon,
            "unit_type": u.unit_type
        }
        for u in military_units
    ]
    
    # 다른 국가들의 외교 및 군사 정보도 수집
    for other_country in all_countries_db:
        # other_country.id는 user_specific 형식 (예: 'goguryeo_2')
        # all_countries_dict의 키는 원래 형식 (예: 'goguryeo')
        other_country_original_id = other_country.id.rsplit("_", 1)[0] if "_" in other_country.id else other_country.id
        
        if other_country.id != user_specific_country_id:
            # 다른 국가의 외교 정보
            other_diplomacy = session.exec(
                select(Diplomacy).where(Diplomacy.sourceID == other_country.id)
            ).all()
            all_countries_dict[other_country_original_id]["diplomacy"] = [
                {
                    "targetName": d.targetName,
                    "status": normalize_diplomacy_status(d.status),
                    "favorability": d.favorability
                }
                for d in other_diplomacy
            ]
            
            # 다른 국가의 군사 유닛 정보
            other_military = session.exec(
                select(MilitaryUnit).where(MilitaryUnit.countryID == other_country.id)
            ).all()
            all_countries_dict[other_country_original_id]["military_units"] = [
                {
                    "name": u.name,
                    "count": u.count,
                    "icon": u.icon,
                    "unit_type": u.unit_type
                }
                for u in other_military
            ]
    
    # 유저 국가 Gemini API 호출
    current_stats = all_countries_dict[country_id]
    current_stats["diplomacy"] = user_diplomacy
    current_stats["military_units"] = user_military
    
    ai_data = await get_gemini_game_data(user_input, current_stats, all_countries_dict)
    
    # AI 응답 데이터 보정 (영문 status -> 한글 변환)
    ai_data = sanitize_ai_response_diplomacy(ai_data)

    # 유저 국가 DB 수치 업데이트
    changes = ai_data.get('changes', {})
    actions = ai_data.get('actions', [])

    # DB에 변화값 저장
    country.last_finance_change = changes.get('finance', 0)
    country.last_population_change = changes.get('population', 0)
    country.last_military_change = changes.get('military', 0)
    country.last_happiness_change = changes.get('happiness', 0)
    
    # 스탯에 변화값 적용 (군사력: changes로 기존 병력 숙련도 향상, add_military 액션으로 신규 모집 추가 반영)
    country.finance += changes.get('finance', 0)
    country.population += changes.get('population', 0)
    country.military += changes.get('military', 0)
    country.happiness += changes.get('happiness', 0)
    
    # 행복도 100% 제한, 군사력 최소값 0 제한
    country.happiness = min(100, max(0, country.happiness))
    country.military = max(0, country.military)
    
    country.turn += 1
    
    # totalScore 자동 계산
    country.update_total_score()
    
    # 명령 로그 저장 (비밀 뉴스 우선)
    secret_text = "\n".join(ai_data.get('secret_news', []) or [])
    command_response_text = secret_text if secret_text else ai_data.get('scenario', '')
    command_log = CommandLog(
        countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
        command=user_input,
        response=command_response_text,
        timestamp=datetime.utcnow()
    )
    session.add(command_log)
    
    # 공개 뉴스 저장 및 응답용 목록
    public_news_items = []
    for news_text in ai_data.get('public_news', []):
        news_type = categorize_news(news_text)
        news_item = NewsItem(
            countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
            title=news_title_for_type(news_type),
            content=news_text,
            type=news_type,
            is_public=True
        )
        session.add(news_item)
        public_news_items.append({
            "title": news_item.title,
            "content": news_text,
            "type": news_type,
        })
    
    # 비밀 뉴스 저장 (공개 안 됨)
    for news_text in ai_data.get('secret_news', []):
        news_item = NewsItem(
            countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
            title=news_text,
            content=news_text,
            type="secret",
            is_public=False
        )
        session.add(news_item)
    
    # AI가 반환한 액션 처리
    for action in ai_data.get('actions', []):
        action_type = action.get('type')
        
        if action_type == 'add_military':
            # 군대 유닛 추가/업데이트
            unit_name = action.get('name')
            unit_count = action.get('count', 0)
            unit_icon = action.get('icon', '⚔️')
            unit_type = action.get('unit_type', 'regular')  # regular, spy, assassin 등

            # 첩자/스파이 추가 시 count가 0으로 올 수 있어 보정
            if unit_count <= 0:
                inferred = changes.get('military', 0)
                unit_count = inferred if inferred > 0 else 1
            
            # 모병 비용 정산: 유닛 1명당 재정 50 소모
            recruitment_cost = unit_count * 50
            country.finance -= recruitment_cost
            country.last_finance_change -= recruitment_cost  # 사용자에게 보여줄 변화량에 합산
            
            stmt = select(MilitaryUnit).where(
                (MilitaryUnit.countryID == user_specific_country_id) &  # Fix: Use user_specific_country_id
                (MilitaryUnit.name == unit_name)
            )
            existing_unit = session.exec(stmt).first()
            
            if existing_unit:
                existing_unit.count += unit_count
            else:
                new_unit = MilitaryUnit(
                    countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
                    name=unit_name,
                    count=unit_count,
                    icon=unit_icon,
                    unit_type=unit_type
                )
                session.add(new_unit)
            # 신규 병력 모집 효과: unit_count를 군사력 스탯에 추가로 반영
            # (changes.military는 기존 병력의 숙련도 향상, unit_count는 신규 모집 효과)
            country.military += unit_count
        
        elif action_type == 'diplomacy':
            # 외교 관계 업데이트 (우호 형성 완화)
            target_name = action.get('target')
            status = normalize_diplomacy_status(action.get('status', '중립'))
            # 기본 우호도 변화폭을 +15로 높여 우호 형성을 쉽게 함
            favorability = action.get('favorability', 15)
            
            stmt = select(Diplomacy).where(
                (Diplomacy.sourceID == user_specific_country_id) &  # Fix: Use user_specific_country_id
                (Diplomacy.targetName == target_name)
            )
            existing_diplomacy = session.exec(stmt).first()
            
            if existing_diplomacy:
                existing_diplomacy.status = status
                existing_diplomacy.favorability = max(-100, min(100, existing_diplomacy.favorability + favorability))
            else:
                new_diplomacy = Diplomacy(
                    sourceID=user_specific_country_id,  # Fix: Use user_specific_country_id
                    targetName=target_name,
                    status=status,
                    favorability=max(-100, min(100, favorability))
                )
                session.add(new_diplomacy)
        
        elif action_type == 'secret_operation':
            # 비밀 작전 저장
            title = action.get('title', '비밀 작전')
            content = action.get('content', '')
            operation_type = action.get('operation_type', '기타')
            shared_with = action.get('shared_with', [])
            target_country = action.get('target_country', '')
            
            secret_intel = SecretIntelligence(
                countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
                title=title,
                content=content,
                intelligence_type=operation_type
            )
            secret_intel.set_shared_countries(shared_with)
            session.add(secret_intel)
        
        elif action_type == 'war':
            # 전쟁 처리
            target_country_name = action.get('target', '')
            outcome = action.get('outcome', 'draw')
            land_gained = action.get('land_gained', 0)
            land_lost = action.get('land_lost', 0)
            casualties = action.get('casualties', 0)
            
            # 전쟁 뉴스 저장
            war_news = f"{current_stats.get('name', '')}와 {target_country_name}의 전쟁 발발! 결과: {outcome}"
            news_item = NewsItem(
                countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
                title="전쟁",
                content=war_news,
                type="war",
                is_public=True
            )
            session.add(news_item)
            
            # 전쟁으로 인한 추가 수치 조정 (선택사항)
            if outcome == "승리":
                country.military -= int(casualties * 0.3)  # 피해
            elif outcome == "패배":
                country.military -= int(casualties * 0.8)  # 큰 피해
            # 군사력 최소값 0 제한
            country.military = max(0, country.military)
            
            # 영토 소유권 변경 처리
            if outcome == "승리" and land_gained > 0:
                # 상대방 국가 ID 찾기 (target_country_name으로)
                target_country_id_map = {
                    "고구려": "goguryeo",
                    "백제": "baekje",
                    "신라": "silla",
                    "goguryeo": "goguryeo",
                    "baekje": "baekje",
                    "silla": "silla"
                }
                target_country_id = target_country_id_map.get(target_country_name, target_country_name.lower())
                
                # 상대방 국가의 영토 찾기
                target_territories = session.exec(
                    select(Territory).where(
                        (Territory.user_id == user_id) &
                        (Territory.owner == target_country_id)
                    )
                ).all()
                
                # 영토 부족 예외 처리: 상대방 영토보다 많이 점령하려는 경우 제한
                available_territories = len(target_territories)
                if land_gained > available_territories:
                    print(f"⚠️ [전투] 영토 부족 예외: land_gained({land_gained}) > 상대 영토({available_territories}), {available_territories}개로 제한")
                    land_gained = available_territories
                
                if target_territories:
                    territories_to_conquer = []
                    
                    # AI 응답에서 target_provinces 필드 우선 사용
                    target_provinces = action.get('target_provinces', [])
                    
                    if target_provinces:
                        # target_provinces가 명시되어 있으면 해당 지역들을 정복
                        print(f"🎯 [전투] AI 지정 점령 대상 지역: {target_provinces}")
                        for province_name in target_provinces:
                            matching_territory = next(
                                (t for t in target_territories if t.province_name == province_name),
                                None
                            )
                            if matching_territory:
                                territories_to_conquer.append(matching_territory)
                                print(f"✅ [전투] {province_name} 정복 대상 추가 (소유권 변경 예정: {target_country_id} -> {country_id})")
                            else:
                                print(f"⚠️ [전투] {province_name}를 상대방 영토에서 찾을 수 없음")
                        
                        # target_provinces 수가 land_gained보다 적으면 인접 지역에서 추가 선택
                        if len(territories_to_conquer) < land_gained:
                            remaining_count = land_gained - len(territories_to_conquer)
                            remaining_targets = [t for t in target_territories if t not in territories_to_conquer]
                            if remaining_targets:
                                attacker_territories = list(session.exec(
                                    select(Territory).where(
                                        (Territory.user_id == user_id) &
                                        (Territory.owner == country_id)
                                    )
                                ).all())
                                adjacent = find_adjacent_territories(
                                    attacker_territories,
                                    remaining_targets,
                                    remaining_count
                                )
                                territories_to_conquer.extend(adjacent)
                                print(f"📍 [전투] 인접 지역 {len(adjacent)}개 추가 선택")
                    else:
                        # target_provinces가 없으면 시나리오 텍스트에서 지역명 추출 (폴백)
                        scenario_text = ai_data.get('scenario', '')
                        public_news_text = ' '.join(ai_data.get('public_news', []))
                        combined_text = f"{scenario_text} {public_news_text}"
                        
                        specified_province = extract_province_name_from_text(combined_text)
                        
                        print(f"🔍 [전투] 폴백: 시나리오에서 추출된 지역명: {specified_province}")
                        print(f"🔍 [전투] 검색 텍스트: {combined_text[:300]}")
                        print(f"🔍 [전투] 상대방 영토 목록: {[t.province_name for t in target_territories]}")
                        
                        if specified_province:
                            specified_territory = next(
                                (t for t in target_territories if t.province_name == specified_province),
                                None
                            )
                            if specified_territory:
                                territories_to_conquer.append(specified_territory)
                                print(f"✅ [전투] {specified_province} 정복 성공!")
                            
                            # 추가로 필요한 영토는 인접 지역에서 선택
                            if len(territories_to_conquer) < land_gained:
                                remaining_count = land_gained - len(territories_to_conquer)
                                remaining_targets = [t for t in target_territories if t not in territories_to_conquer]
                                if remaining_targets:
                                    attacker_territories = list(session.exec(
                                        select(Territory).where(
                                            (Territory.user_id == user_id) &
                                            (Territory.owner == country_id)
                                        )
                                    ).all())
                                    adjacent = find_adjacent_territories(
                                        attacker_territories,
                                        remaining_targets,
                                        remaining_count
                                    )
                                    territories_to_conquer.extend(adjacent)
                        else:
                            # 특정 지역이 명시되지 않았으면 인접한 지역 선택
                            attacker_territories = list(session.exec(
                                select(Territory).where(
                                    (Territory.user_id == user_id) &
                                    (Territory.owner == country_id)
                                )
                            ).all())
                            
                            territories_to_conquer = find_adjacent_territories(
                                attacker_territories,
                                list(target_territories),
                                land_gained
                            )
                    
                    # 공격자 국가 ID (현재 국가)
                    attacker_country_id = country_id  # 원래 country_id (goguryeo, baekje, silla)
                    
                    # 영토 소유권 변경
                    if territories_to_conquer:
                        print(f"📋 [전투] 정복할 영토 수: {len(territories_to_conquer)}")
                        for territory in territories_to_conquer:
                            old_owner = territory.owner
                            territory.owner = attacker_country_id
                            session.add(territory)
                            print(f"🗺️ [영토 변경] {territory.province_name}: {old_owner} -> {attacker_country_id}")
                    else:
                        print(f"⚠️ [전투] 정복할 영토가 없습니다. land_gained={land_gained}, target_territories={len(target_territories)}")
            
            elif outcome == "패배" and land_lost > 0:
                # 공격자가 패배하여 영토를 잃음
                attacker_territories = list(session.exec(
                    select(Territory).where(
                        (Territory.user_id == user_id) &
                        (Territory.owner == country_id)  # 원래 country_id
                    )
                ).all())
                
                if attacker_territories:
                    # 상대방 국가 ID 찾기
                    target_country_id_map = {
                        "고구려": "goguryeo",
                        "백제": "baekje",
                        "신라": "silla",
                        "goguryeo": "goguryeo",
                        "baekje": "baekje",
                        "silla": "silla"
                    }
                    target_country_id = target_country_id_map.get(target_country_name, target_country_name.lower())
                    
                    if target_country_id:  # 타입 체커를 위한 None 체크
                        import random
                        territories_to_lose = random.sample(
                            attacker_territories,
                            min(land_lost, len(attacker_territories))
                        )
                        
                        # 영토 소유권 변경
                        for territory in territories_to_lose:
                            territory.owner = target_country_id
                            session.add(territory)
    
    session.add(country)
    session.commit()
    
    # 스파이 정보 유출 체크
    spy_leak_info = check_spy_intelligence_leak(user_specific_country_id, session)
    
    # 다른 두 국가 자동 AI 턴 진행 (Gemini 호출 병렬화)
    other_countries_news = {}
    ai_targets = []
    for other_country_db in all_countries_db:
        if other_country_db.id != user_specific_country_id:
            # other_country_db.id는 user_specific 형식, all_countries_dict의 키는 원래 형식
            other_country_original_id = other_country_db.id.rsplit("_", 1)[0] if "_" in other_country_db.id else other_country_db.id
            other_stats = all_countries_dict[other_country_original_id].copy()
            ai_targets.append((other_country_db, other_stats))
    ai_results = await asyncio.gather(
        *(get_ai_country_turn(stats, all_countries_dict) for _, stats in ai_targets)
    ) if ai_targets else []

    for (other_country_db, _), ai_turn_data in zip(ai_targets, ai_results):
        # AI 응답 데이터 보정 (영문 status -> 한글 변환)
        ai_turn_data = sanitize_ai_response_diplomacy(ai_turn_data)
        
        # 스탯 업데이트
        other_changes = ai_turn_data.get('changes', {})
        
        # changes가 없거나 모두 0이면 더 작은 기본값으로 완만하게 변화
        if not other_changes or all(v == 0 for v in other_changes.values()):
            other_changes = {
                "finance": 10,
                "population": 2,
                "military": 0,
                "happiness": 0,
            }
            ai_turn_data['changes'] = other_changes
        
        # DB에 변화값 저장
        other_country_db.last_finance_change = other_changes.get('finance', 0)
        other_country_db.last_population_change = other_changes.get('population', 0)
        other_country_db.last_military_change = other_changes.get('military', 0)
        other_country_db.last_happiness_change = other_changes.get('happiness', 0)
        
        # 스탯에 변화값 적용 (군사력: changes로 기존 병력 숙련도 향상, add_military 액션으로 신규 모집 추가 반영)
        other_country_db.finance += other_changes.get('finance', 0)
        other_country_db.population += other_changes.get('population', 0)
        other_country_db.military += other_changes.get('military', 0)
        other_country_db.happiness += other_changes.get('happiness', 0)
        
        # 행복도 100% 제한, 군사력 최소값 0 제한
        other_country_db.happiness = min(100, max(0, other_country_db.happiness))
        other_country_db.military = max(0, other_country_db.military)
        
        other_country_db.turn += 1
        other_country_db.update_total_score()
        
        # 공개 뉴스 저장 (타입 분류)
        for news_text in ai_turn_data.get('public_news', []):
            news_type = categorize_news(news_text)
            news_item = NewsItem(
                countryID=other_country_db.id,
                title=news_title_for_type(news_type),
                content=news_text,
                type=news_type,
                is_public=True
            )
            session.add(news_item)
        
        # 비밀 뉴스 저장 (공개 안 됨)
        for news_text in ai_turn_data.get('secret_news', []):
            news_item = NewsItem(
                countryID=other_country_db.id,
                title=news_text,
                content=news_text,
                type="secret",
                is_public=False
            )
            session.add(news_item)
        
        # AI 액션 처리
        for action in ai_turn_data.get('actions', []):
            action_type = action.get('type')
            
            if action_type == 'add_military':
                unit_name = action.get('name')
                unit_count = action.get('count', 0)
                unit_icon = action.get('icon', '⚔️')
                unit_type = action.get('unit_type', 'regular')

                if unit_count <= 0:
                    inferred = other_changes.get('military', 0)
                    unit_count = inferred if inferred > 0 else 1
                
                # 모병 비용 정산: 유닛 1명당 재정 50 소모
                recruitment_cost = unit_count * 50
                other_country_db.finance -= recruitment_cost
                other_country_db.last_finance_change -= recruitment_cost  # 변화량에 합산
                
                stmt = select(MilitaryUnit).where(
                    (MilitaryUnit.countryID == other_country_db.id) & 
                    (MilitaryUnit.name == unit_name)
                )
                existing_unit = session.exec(stmt).first()
                
                if existing_unit:
                    existing_unit.count += unit_count
                else:
                    new_unit = MilitaryUnit(
                        countryID=other_country_db.id,
                        name=unit_name,
                        count=unit_count,
                        icon=unit_icon,
                        unit_type=unit_type
                    )
                    session.add(new_unit)
                # 신규 병력 모집 효과: unit_count를 군사력 스탯에 추가로 반영
                # (changes.military는 기존 병력의 숙련도 향상, unit_count는 신규 모집 효과)
                other_country_db.military += unit_count
            
            elif action_type == 'diplomacy':
                target_name = action.get('target')
                status = normalize_diplomacy_status(action.get('status', '중립'))
                # AI도 기본 우호도 변화폭을 +15로 높여 관계 형성을 쉽게 함
                favorability = action.get('favorability', 15)
                
                stmt = select(Diplomacy).where(
                    (Diplomacy.sourceID == other_country_db.id) & 
                    (Diplomacy.targetName == target_name)
                )
                existing_diplomacy = session.exec(stmt).first()
                
                if existing_diplomacy:
                    existing_diplomacy.status = status
                    existing_diplomacy.favorability = max(-100, min(100, existing_diplomacy.favorability + favorability))
                else:
                    new_diplomacy = Diplomacy(
                        sourceID=other_country_db.id,
                        targetName=target_name,
                        status=status,
                        favorability=max(-100, min(100, favorability))
                    )
                    session.add(new_diplomacy)
            
            elif action_type == 'war':
                # AI 국가의 전쟁 처리
                target_country_name = action.get('target', '')
                outcome = action.get('outcome', 'draw')
                land_gained = action.get('land_gained', 0)
                land_lost = action.get('land_lost', 0)
                casualties = action.get('casualties', 0)
                
                # 전쟁 뉴스 저장
                war_news = f"{other_country_db.name}와 {target_country_name}의 전쟁 발발! 결과: {outcome}"
                news_item = NewsItem(
                    countryID=other_country_db.id,
                    title="전쟁",
                    content=war_news,
                    type="war",
                    is_public=True
                )
                session.add(news_item)
                
                # 영토 소유권 변경 처리
                other_country_original_id = other_country_db.id.rsplit("_", 1)[0] if "_" in other_country_db.id else other_country_db.id
                
                if outcome == "승리" and land_gained > 0:
                    # 상대방 국가 ID 찾기
                    target_country_id_map = {
                        "고구려": "goguryeo",
                        "백제": "baekje",
                        "신라": "silla",
                        "goguryeo": "goguryeo",
                        "baekje": "baekje",
                        "silla": "silla"
                    }
                    target_country_id = target_country_id_map.get(target_country_name, target_country_name.lower())
                    
                    # 상대방 국가의 영토 찾기
                    target_territories = session.exec(
                        select(Territory).where(
                            (Territory.user_id == user_id) &
                            (Territory.owner == target_country_id)
                        )
                    ).all()
                    
                    # 영토 부족 예외 처리: 상대방 영토보다 많이 점령하려는 경우 제한
                    available_territories = len(target_territories)
                    if land_gained > available_territories:
                        print(f"⚠️ [AI 전투] 영토 부족 예외: land_gained({land_gained}) > 상대 영토({available_territories}), {available_territories}개로 제한")
                        land_gained = available_territories
                    
                    if target_territories:
                        territories_to_conquer = []
                        
                        # AI 응답에서 target_provinces 필드 우선 사용
                        target_provinces = action.get('target_provinces', [])
                        
                        if target_provinces:
                            # target_provinces가 명시되어 있으면 해당 지역들을 정복
                            print(f"🎯 [AI 전투] {other_country_db.name} 지정 점령 대상: {target_provinces}")
                            for province_name in target_provinces:
                                matching_territory = next(
                                    (t for t in target_territories if t.province_name == province_name),
                                    None
                                )
                                if matching_territory:
                                    territories_to_conquer.append(matching_territory)
                                    print(f"✅ [AI 전투] {province_name} 정복 대상 추가")
                                else:
                                    print(f"⚠️ [AI 전투] {province_name}를 상대방 영토에서 찾을 수 없음")
                            
                            # target_provinces 수가 land_gained보다 적으면 인접 지역에서 추가 선택
                            if len(territories_to_conquer) < land_gained:
                                remaining_count = land_gained - len(territories_to_conquer)
                                remaining_targets = [t for t in target_territories if t not in territories_to_conquer]
                                if remaining_targets:
                                    ai_territories = list(session.exec(
                                        select(Territory).where(
                                            (Territory.user_id == user_id) &
                                            (Territory.owner == other_country_original_id)
                                        )
                                    ).all())
                                    adjacent = find_adjacent_territories(
                                        ai_territories,
                                        remaining_targets,
                                        remaining_count
                                    )
                                    territories_to_conquer.extend(adjacent)
                        else:
                            # target_provinces가 없으면 시나리오에서 지역명 추출 (폴백)
                            scenario_text = ai_turn_data.get('scenario', '')
                            public_news_text = ' '.join(ai_turn_data.get('public_news', []))
                            combined_text = f"{scenario_text} {public_news_text}"
                            
                            specified_province = extract_province_name_from_text(combined_text)
                            
                            if specified_province:
                                specified_territory = next(
                                    (t for t in target_territories if t.province_name == specified_province),
                                    None
                                )
                                if specified_territory:
                                    territories_to_conquer.append(specified_territory)
                                    # 추가로 필요한 영토는 인접 지역에서 선택
                                    if len(territories_to_conquer) < land_gained:
                                        remaining_count = land_gained - len(territories_to_conquer)
                                        remaining_targets = [t for t in target_territories if t not in territories_to_conquer]
                                        if remaining_targets:
                                            ai_territories = list(session.exec(
                                                select(Territory).where(
                                                    (Territory.user_id == user_id) &
                                                    (Territory.owner == other_country_original_id)
                                                )
                                            ).all())
                                            adjacent = find_adjacent_territories(
                                                ai_territories,
                                                list(remaining_targets),
                                                remaining_count
                                            )
                                            territories_to_conquer.extend(adjacent)
                            else:
                                # 특정 지역이 명시되지 않았으면 인접한 지역 선택
                                ai_territories = list(session.exec(
                                    select(Territory).where(
                                        (Territory.user_id == user_id) &
                                        (Territory.owner == other_country_original_id)
                                    )
                                ).all())
                                
                                territories_to_conquer = find_adjacent_territories(
                                    ai_territories,
                                    list(target_territories),
                                    land_gained
                                )
                        
                        # 영토 소유권 변경
                        for territory in territories_to_conquer:
                            territory.owner = other_country_original_id
                            print(f"🗺️ [AI 영토 변경] {territory.province_name}: {target_country_id} -> {other_country_original_id}")
                            session.add(territory)
                
                elif outcome == "패배" and land_lost > 0:
                    # AI 국가가 패배하여 영토를 잃음
                    ai_territories = list(session.exec(
                        select(Territory).where(
                            (Territory.user_id == user_id) &
                            (Territory.owner == other_country_original_id)
                        )
                    ).all())
                    
                    if ai_territories:
                        # 상대방 국가 ID 찾기
                        target_country_id_map = {
                            "고구려": "goguryeo",
                            "백제": "baekje",
                            "신라": "silla",
                            "goguryeo": "goguryeo",
                            "baekje": "baekje",
                            "silla": "silla"
                        }
                        target_country_id = target_country_id_map.get(target_country_name, target_country_name.lower())
                        
                        if target_country_id:  # 타입 체커를 위한 None 체크
                            import random
                            territories_to_lose = random.sample(
                                ai_territories,
                                min(land_lost, len(ai_territories))
                            )
                            
                            # 영토 소유권 변경
                            for territory in territories_to_lose:
                                territory.owner = target_country_id
                                session.add(territory)
            
            elif action_type == 'secret_operation':
                # 비밀 작전 저장
                title = action.get('title', '비밀 작전')
                content = action.get('content', '')
                operation_type = action.get('operation_type', '기타')
                shared_with = action.get('shared_with', [])
                
                secret_intel = SecretIntelligence(
                    countryID=other_country_db.id,
                    title=title,
                    content=content,
                    intelligence_type=operation_type
                )
                secret_intel.set_shared_countries(shared_with)
                session.add(secret_intel)
        
        session.add(other_country_db)
        
        # 다른 국가 뉴스를 반환 데이터에 포함 + 최신 스탯 반영
        # 프론트엔드에 반환할 때는 원래 country_id 형식 사용
        other_country_original_id = other_country_db.id.rsplit("_", 1)[0] if "_" in other_country_db.id else other_country_db.id
        other_countries_news[other_country_original_id] = {
            "name": other_country_db.name,
            "scenario": ai_turn_data.get('scenario', ''),
            "public_news": ai_turn_data.get('public_news', []),
            "finance": other_country_db.finance,
            "population": other_country_db.population,
            "happiness": other_country_db.happiness,
            "military": other_country_db.military,
            "turn": other_country_db.turn,
            "totalScore": other_country_db.totalScore,
            "color": other_country_db.color,
        }
    
    # 국가 멸망(영토 소진) 체크 로직
    fallen_countries = []
    country_names = {
        "goguryeo": "고구려",
        "baekje": "백제",
        "silla": "신라"
    }
    
    for check_country in all_countries_db:
        check_country_original_id = check_country.id.rsplit("_", 1)[0] if "_" in check_country.id else check_country.id
        
        # 해당 국가의 영토 수 확인
        territory_count = session.exec(
            select(Territory).where(
                (Territory.user_id == user_id) &
                (Territory.owner == check_country_original_id)
            )
        ).all()
        
        if len(territory_count) == 0 and check_country.is_active:
            # 영토가 0이면 국가 멸망 처리
            check_country.is_active = False
            session.add(check_country)
            
            country_display_name = country_names.get(check_country_original_id, check_country.name)
            fallen_countries.append(country_display_name)
            print(f"💀 [멸망] {country_display_name}의 영토가 모두 소진되어 역사 속으로 사라졌습니다.")
            
            # 멸망 뉴스 생성
            fall_news = NewsItem(
                countryID=check_country.id,
                title="국가 멸망",
                content=f"{country_display_name}이(가) 모든 영토를 잃고 역사 속으로 사라졌습니다.",
                type="public_only",
                is_public=True
            )
            session.add(fall_news)
    
    session.commit()
    session.refresh(country)

    # 멸망한 국가가 있으면 시나리오에 메시지 추가
    scenario_text = ai_data.get('scenario', '')
    if fallen_countries:
        fall_message = "\n\n⚔️ **역사적 순간** ⚔️\n" + "\n".join([
            f"🏴 {name}이(가) 역사 속으로 사라졌습니다..."
            for name in fallen_countries
        ])
        scenario_text = scenario_text + fall_message
    
    return {
        "scenario": scenario_text,
        "mood": ai_data.get('mood', 'neutral'),
        "public_news": ai_data.get('public_news', []),
        "public_news_items": public_news_items,
        "secret_news": ai_data.get('secret_news', []),
        "spy_leak_info": spy_leak_info,
        "fallen_countries": fallen_countries,  # 멸망한 국가 목록 추가
        "updated_stats": {
            "finance": country.finance,
            "population": country.population,
            "happiness": country.happiness,
            "military": country.military,
            "lastFinanceChange": country.last_finance_change,
            "lastPopulationChange": country.last_population_change,
            "lastMilitaryChange": country.last_military_change,
            "lastHappinessChange": country.last_happiness_change,
            "turn": country.turn,
            "totalScore": country.totalScore,
            "color": country.color,
        },
        "other_countries": other_countries_news
    }

@app.post("/api/country/{country_id}/diplomacy")
async def update_diplomacy(
    country_id: str,
    target_name: str = Body(..., embed=True),
    status: str = Body(..., embed=True),
    favorability: int = Body(0, embed=True),
    session_token: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """외교 관계 업데이트"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가인지 확인
        country = session.exec(
            select(Country).where(
                (Country.id == user_specific_country_id) & (Country.user_id == user_id)
            )
        ).first()
        
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
        
        # 영문 status를 한글로 정규화
        status = normalize_diplomacy_status(status)
        
        # 기존 외교 관계 찾기
        statement = select(Diplomacy).where(
            (Diplomacy.sourceID == user_specific_country_id) &  # Fix: Use user_specific_country_id
            (Diplomacy.targetName == target_name)
        )
        diplomacy = session.exec(statement).first()
        
        if diplomacy:
            diplomacy.status = status
            diplomacy.favorability = favorability
        else:
            diplomacy = Diplomacy(
                sourceID=user_specific_country_id,  # Fix: Use user_specific_country_id
                targetName=target_name,
                status=status,
                favorability=favorability
            )
            session.add(diplomacy)
        
        session.commit()
        session.refresh(diplomacy)
        
        return {
            "id": diplomacy.id,
            "targetName": diplomacy.targetName,
            "status": normalize_diplomacy_status(diplomacy.status),
            "favorability": diplomacy.favorability
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"외교 관계 업데이트 중 오류가 발생했습니다: {str(e)}")

@app.get("/api/territories")
async def get_territories(
    session_token: str = Query(..., description="Session token"),
    session: Session = Depends(get_session)
):
    """사용자별 모든 영토 소유권 조회"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 해당 사용자의 모든 영토 조회
        territories = session.exec(select(Territory).where(Territory.user_id == user_id)).all()
        
        return [
            {
                "id": t.id,
                "name": t.province_name,
                "owner": t.owner
            }
            for t in territories
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"영토 조회 중 오류가 발생했습니다: {str(e)}")

@app.post("/api/country/{country_id}/military")
async def add_military_unit(
    country_id: str,
    name: str = Body(..., embed=True),
    count: int = Body(..., embed=True),
    icon: str = Body("", embed=True),
    session_token: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """군대 유닛 추가"""
    try:
        # 세션 토큰에서 사용자 ID 추출
        token_payload = verify_session_token(session_token)
        user_id = token_payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 세션 토큰입니다.")
        
        # 프론트엔드에서 받은 country_id를 사용자별 고유 ID로 변환
        user_specific_country_id = f"{country_id}_{user_id}"
        
        # 해당 사용자의 국가인지 확인
        country = session.exec(
            select(Country).where(
                (Country.id == user_specific_country_id) & (Country.user_id == user_id)
            )
        ).first()
        
        if not country:
            raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
        
        # 기존 유닛 찾기
        statement = select(MilitaryUnit).where(
            (MilitaryUnit.countryID == user_specific_country_id) &  # Fix: Use user_specific_country_id
            (MilitaryUnit.name == name)
        )
        unit = session.exec(statement).first()
        
        if unit:
            unit.count += count
        else:
            unit = MilitaryUnit(
                countryID=user_specific_country_id,  # Fix: Use user_specific_country_id
                name=name,
                count=count,
                icon=icon
            )
            session.add(unit)
        
        # 모든 유닛 추가 시 군사력 증가 (handle_game_turn과 일관성 유지)
        country.military += count
        country.update_total_score()
        
        session.commit()
        session.refresh(unit)
        
        return {
            "id": unit.id,
            "name": unit.name,
            "count": unit.count,
            "icon": unit.icon
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"군대 유닛 추가 중 오류가 발생했습니다: {str(e)}")