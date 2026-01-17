from fastapi import FastAPI, Depends, HTTPException, Body
from sqlmodel import Session, select
from database import get_session
from models import Country
from ai_service import get_gemini_game_data, generate_flux_image

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

    with Session(engine) as session:
        #데이터가 이미 있는지 확인
        statement = select(Country)
        if not session.exec(statement).first():
            #초기 삼국 데이터 삽입
            countries = [
                Country(name="고구려", gold=15000, population=80000, military=15),
                Country(name="백제", gold=18000, population = 60000, military=10),
                Country(name="신라", gold=12000, population=40000, military=12)
            ]
            session.add_all(countries)
            session.commit()
            print("--- 삼국 초기 데이터가 생성되었습니다 ---")

@app.get("/status/{country_name}")
def get_country_status(country_name: str, session: Session = Depends(get_session)):
    statement = select(Country).where(Country.name == country_name)
    country = session.exec(statement).first()
    if not country:
        raise HTTPException(status_code = 404, detail="국가를 찾을 수 없습니다.")
    return country

@app.post("/api/action")
async def handle_game_turn(
    user_input: str = Body(..., embed=True),
    country_name: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    # 1. DB에서 현재 국가 조회
    statement = select(Country).where(Country.name == country_name)
    country = session.exec(statement).first()
    if not country:
        raise HTTPException(status_code=404, detail="국가를 찾을 수 없습니다.")

    # 2. Gemini 기획 (시나리오, 프롬프트 등)
    ai_data = await get_gemini_game_data(user_input, country.dict())

    # 3. DB 수치 업데이트 및 저장
    changes = ai_data['changes']
    country.gold += changes.get('gold', 0)
    country.population += changes.get('population', 0)
    country.military += changes.get('military', 0)
    country.happiness += changes.get('happiness', 0)
    
    session.add(country)
    session.commit()
    session.refresh(country)

    # 4. Flux 이미지 생성
    image_url = await generate_flux_image(ai_data['image_prompt'])

    return {
        "scenario": ai_data['scenario'],
        "news": ai_data['news'],
        "image_url": image_url,
        "updated_stats": {
            "finance": country.gold,
            "population": country.population,
            "happiness": country.happiness,
            "military": country.military
        }
    }