from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from datetime import datetime
import random
from database import engine, create_db_and_tables, get_session
from models import Country, CommandLog, NewsItem, MilitaryUnit, Diplomacy, SecretIntelligence
from ai_service import get_gemini_game_data, get_ai_country_turn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 유틸리티 함수 =====

def check_spy_intelligence_leak(country_id: str, session: Session) -> dict:
    """
    스파이 정보 유출 체크
    모든 스파이는 동일한 확률(3%)로 정보 유출 가능
    
    Returns:
        leaked_intel: 유출된 비밀 정보 목록
    """
    SPY_LEAK_PROBABILITY = 0.03  # 3% 확률로 정보 유출
    
    leaked_intel = {}
    
    # 이 국가의 모든 스파이 검색
    spy_units = session.exec(
        select(MilitaryUnit).where(
            (MilitaryUnit.countryID == country_id) & 
            (MilitaryUnit.unit_type.in_(["spy", "assassin", "scout", "infiltrator"]))
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
                        SecretIntelligence.countryID == country_id
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


@app.get("/")
async def root():
    return {"message": "Nation Simulator API is running"}

@app.get("/status")
async def status():
    return {"status": "ok"}

@app.get("/api/country/{country_id}")
async def get_country(country_id: str, session: Session = Depends(get_session)):
    """특정 국가의 현재 상태 조회"""
    statement = select(Country).where(Country.id == country_id)
    country = session.exec(statement).first()
    if not country:
        raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")
    
    return {
        "id": country.id,
        "name": country.name,
        "finance": country.finance,
        "population": country.population,
        "happiness": country.happiness,
        "military": country.military,
        "totalScore": country.totalScore,
        "turn": country.turn,
        "title": country.title,
        "color": country.color
    }

@app.get("/api/countries")
async def get_all_countries(session: Session = Depends(get_session)):
    """모든 국가 조회"""
    countries = session.exec(select(Country)).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "finance": c.finance,
            "population": c.population,
            "happiness": c.happiness,
            "military": c.military,
            "totalScore": c.totalScore,
            "turn": c.turn,
            "title": c.title,
            "color": c.color
        }
        for c in countries
    ]

@app.get("/api/country/{country_id}/news")
async def get_country_news(country_id: str, session: Session = Depends(get_session)):
    """특정 국가의 뉴스 조회"""
    statement = select(NewsItem).where(NewsItem.countryID == country_id)
    news_items = session.exec(statement).all()
    
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
async def get_military_units(country_id: str, session: Session = Depends(get_session)):
    """특정 국가의 군대 구성 조회"""
    statement = select(MilitaryUnit).where(MilitaryUnit.countryID == country_id)
    units = session.exec(statement).all()
    
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
async def get_diplomacy(country_id: str, session: Session = Depends(get_session)):
    """특정 국가의 외교 관계 조회"""
    statement = select(Diplomacy).where(Diplomacy.sourceID == country_id)
    relations = session.exec(statement).all()
    
    return [
        {
            "id": d.id,
            "targetName": d.targetName,
            "status": d.status,
            "favorability": d.favorability
        }
        for d in relations
    ]

@app.get("/api/country/{country_id}/logs")
async def get_command_logs(country_id: str, session: Session = Depends(get_session)):
    """특정 국가의 명령 기록 조회"""
    statement = select(CommandLog).where(CommandLog.countryID == country_id).order_by(CommandLog.timestamp.desc())
    logs = session.exec(statement).all()
    
    return [
        {
            "id": l.id,
            "command": l.command,
            "response": l.response,
            "timestamp": l.timestamp.isoformat()
        }
        for l in logs
    ]

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    with Session(engine) as session:
        if not session.exec(select(Country)).first():
            # 초기 데이터 삽입
            countries = [
                Country(
                    id="goguryeo",
                    name="고구려",
                    finance=15000,
                    population=80000,
                    military=15,
                    happiness=50,
                    turn=1,
                    title="호전적인 국가",
                    color="#FF6B6B"
                ),
                Country(
                    id="baekje",
                    name="백제",
                    finance=18000,
                    population=60000,
                    military=10,
                    happiness=50,
                    turn=1,
                    title="문화 강국",
                    color="#4ECDC4"
                ),
                Country(
                    id="silla",
                    name="신라",
                    finance=12000,
                    population=45000,
                    military=12,
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

@app.post("/api/action")
async def handle_game_turn(
    user_input: str = Body(..., embed=True),
    country_id: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    """게임 턴 처리 - 유저 국가 + AI 국가들 자동 업데이트"""
    statement = select(Country).where(Country.id == country_id)
    country = session.exec(statement).first()
    if not country:
        raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")

    # 모든 국가 정보 가져오기
    all_countries_db = session.exec(select(Country)).all()
    all_countries_dict = {
        c.id: {
            "id": c.id,
            "name": c.name,
            "finance": c.finance,
            "population": c.population,
            "military": c.military,
            "happiness": c.happiness,
            "turn": c.turn
        }
        for c in all_countries_db
    }
    
    # 유저 국가 Gemini API 호출
    current_stats = all_countries_dict[country_id]
    ai_data = await get_gemini_game_data(user_input, current_stats, all_countries_dict)

    # 유저 국가 DB 수치 업데이트
    changes = ai_data.get('changes', {})
    country.finance += changes.get('finance', 0)
    country.population += changes.get('population', 0)
    country.military += changes.get('military', 0)
    country.happiness += changes.get('happiness', 0)
    country.turn += 1
    
    # totalScore 자동 계산
    country.update_total_score()
    
    # 명령 로그 저장
    command_log = CommandLog(
        countryID=country_id,
        command=user_input,
        response=ai_data.get('scenario', ''),
        timestamp=datetime.utcnow()
    )
    session.add(command_log)
    
    # 공개 뉴스 저장
    for news_text in ai_data.get('public_news', []):
        news_item = NewsItem(
            countryID=country_id,
            title=news_text,
            content=news_text,
            type="general",
            is_public=True
        )
        session.add(news_item)
    
    # 비밀 뉴스 저장 (공개 안 됨)
    for news_text in ai_data.get('secret_news', []):
        news_item = NewsItem(
            countryID=country_id,
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
            
            stmt = select(MilitaryUnit).where(
                (MilitaryUnit.countryID == country_id) & 
                (MilitaryUnit.name == unit_name)
            )
            existing_unit = session.exec(stmt).first()
            
            if existing_unit:
                existing_unit.count += unit_count
            else:
                new_unit = MilitaryUnit(
                    countryID=country_id,
                    name=unit_name,
                    count=unit_count,
                    icon=unit_icon,
                    unit_type=unit_type
                )
                session.add(new_unit)
        
        elif action_type == 'diplomacy':
            # 외교 관계 업데이트
            target_name = action.get('target')
            status = action.get('status', '중립')
            favorability = action.get('favorability', 0)
            
            stmt = select(Diplomacy).where(
                (Diplomacy.sourceID == country_id) & 
                (Diplomacy.targetName == target_name)
            )
            existing_diplomacy = session.exec(stmt).first()
            
            if existing_diplomacy:
                existing_diplomacy.status = status
                existing_diplomacy.favorability += favorability
            else:
                new_diplomacy = Diplomacy(
                    sourceID=country_id,
                    targetName=target_name,
                    status=status,
                    favorability=favorability
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
                countryID=country_id,
                title=title,
                content=content,
                intelligence_type=operation_type
            )
            secret_intel.set_shared_countries(shared_with)
            session.add(secret_intel)
    
    session.add(country)
    session.commit()
    
    # 스파이 정보 유출 체크
    spy_leak_info = check_spy_intelligence_leak(country_id, session)
    
    # 다른 두 국가 자동 AI 턴 진행
    other_countries_news = {}
    for other_country_db in all_countries_db:
        if other_country_db.id != country_id:
            # AI 턴 진행
            other_stats = all_countries_dict[other_country_db.id]
            ai_turn_data = await get_ai_country_turn(other_stats, all_countries_dict)
            
            # 스탯 업데이트
            other_changes = ai_turn_data.get('changes', {})
            other_country_db.finance += other_changes.get('finance', 0)
            other_country_db.population += other_changes.get('population', 0)
            other_country_db.military += other_changes.get('military', 0)
            other_country_db.happiness += other_changes.get('happiness', 0)
            other_country_db.turn += 1
            other_country_db.update_total_score()
            
            # 공개 뉴스 저장
            for news_text in ai_turn_data.get('public_news', []):
                news_item = NewsItem(
                    countryID=other_country_db.id,
                    title=news_text,
                    content=news_text,
                    type="ai_turn",
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
                
                elif action_type == 'diplomacy':
                    target_name = action.get('target')
                    status = action.get('status', '중립')
                    favorability = action.get('favorability', 0)
                    
                    stmt = select(Diplomacy).where(
                        (Diplomacy.sourceID == other_country_db.id) & 
                        (Diplomacy.targetName == target_name)
                    )
                    existing_diplomacy = session.exec(stmt).first()
                    
                    if existing_diplomacy:
                        existing_diplomacy.status = status
                        existing_diplomacy.favorability += favorability
                    else:
                        new_diplomacy = Diplomacy(
                            sourceID=other_country_db.id,
                            targetName=target_name,
                            status=status,
                            favorability=favorability
                        )
                        session.add(new_diplomacy)
                
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
            
            # 다른 국가 뉴스를 반환 데이터에 포함
            other_countries_news[other_country_db.id] = {
                "name": other_country_db.name,
                "scenario": ai_turn_data.get('scenario', ''),
                "public_news": ai_turn_data.get('public_news', [])
            }
    
    session.commit()
    session.refresh(country)

    return {
        "scenario": ai_data.get('scenario', ''),
        "public_news": ai_data.get('public_news', []),
        "secret_news": ai_data.get('secret_news', []),
        "spy_leak_info": spy_leak_info,
        "updated_stats": {
            "finance": country.finance,
            "population": country.population,
            "happiness": country.happiness,
            "military": country.military,
            "turn": country.turn,
            "totalScore": country.totalScore
        },
        "other_countries": other_countries_news
    }

@app.post("/api/country/{country_id}/diplomacy")
async def update_diplomacy(
    country_id: str,
    target_name: str = Body(..., embed=True),
    status: str = Body(..., embed=True),
    favorability: int = Body(0, embed=True),
    session: Session = Depends(get_session)
):
    """외교 관계 업데이트"""
    # 기존 외교 관계 찾기
    statement = select(Diplomacy).where(
        (Diplomacy.sourceID == country_id) & 
        (Diplomacy.targetName == target_name)
    )
    diplomacy = session.exec(statement).first()
    
    if diplomacy:
        diplomacy.status = status
        diplomacy.favorability = favorability
    else:
        diplomacy = Diplomacy(
            sourceID=country_id,
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
        "status": diplomacy.status,
        "favorability": diplomacy.favorability
    }

@app.post("/api/country/{country_id}/military")
async def add_military_unit(
    country_id: str,
    name: str = Body(..., embed=True),
    count: int = Body(..., embed=True),
    icon: str = Body("", embed=True),
    session: Session = Depends(get_session)
):
    """군대 유닛 추가"""
    # 기존 유닛 찾기
    statement = select(MilitaryUnit).where(
        (MilitaryUnit.countryID == country_id) & 
        (MilitaryUnit.name == name)
    )
    unit = session.exec(statement).first()
    
    if unit:
        unit.count += count
    else:
        unit = MilitaryUnit(
            countryID=country_id,
            name=name,
            count=count,
            icon=icon
        )
        session.add(unit)
    
    session.commit()
    session.refresh(unit)
    
    return {
        "id": unit.id,
        "name": unit.name,
        "count": unit.count,
        "icon": unit.icon
    }