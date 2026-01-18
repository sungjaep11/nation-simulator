from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from database import engine, create_db_and_tables, get_session
from models import Country
from ai_service import get_gemini_game_data

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Nation Simulator API is running"}

@app.get("/status")
async def status():
    return {"status": "ok"}

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    with Session(engine) as session:
        if not session.exec(select(Country)).first():
            # 초기 데이터 삽입 로직
            countries = [
                Country(name="고구려", gold=15000, population=80000, military=15, happiness=50),
                Country(name="백제", gold=18000, population=60000, military=10, happiness=50),
                Country(name="신라", gold=12000, population=40000, military=12, happiness=50)
            ]
            session.add_all(countries)
            session.commit()

@app.post("/api/action")
async def handle_game_turn(
    user_input: str = Body(..., embed=True),
    country_name: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    statement = select(Country).where(Country.name == country_name)
    country = session.exec(statement).first()
    if not country:
        raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")

    # Gemini API 호출
    ai_data = await get_gemini_game_data(user_input, country.dict())

    # DB 수치 업데이트
    changes = ai_data['changes']
    country.gold += changes.get('gold', 0)
    country.population += changes.get('population', 0)
    country.military += changes.get('military', 0)
    country.happiness += changes.get('happiness', 0)
    
    session.add(country)
    session.commit()
    session.refresh(country)

    return {
        "scenario": ai_data['scenario'],
        "news": ai_data['news'],
        "updated_stats": {
            "finance": country.gold,
            "population": country.population,
            "happiness": country.happiness,
            "military": country.military
        }
    }