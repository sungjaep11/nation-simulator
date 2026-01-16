from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session, select
from database import engine, create_db_and_tables, get_session
from models import Country
from fastapi.middleware.cors import CORSMiddleware

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