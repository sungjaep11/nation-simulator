from sqlmodel import SQLModel, Field
from typing import Optional, List
from datetime import datetime
import json

class Country(SQLModel, table=True):
    id: str = Field(primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)  # 게임 데이터를 사용자별로 분리
    name: str = Field(index=True)
    finance: int = 10000
    population: int = 50000
    happiness: int = 50
    military: int = 10
    totalScore: int = 0
    turn: int = 1
    title: str = ""
    color: str = ""
    is_active: bool = True  # 국가 활성 상태 (False면 멸망)
    provinces: str = "[]"  # 보유 영토 목록 (JSON 문자열: ["서울특별시", "경기도", ...])
    
    # 지난 턴의 상태 변화값 저장 (AI 턴 처리 후 반영)
    last_finance_change: int = 0
    last_population_change: int = 0
    last_military_change: int = 0
    last_happiness_change: int = 0
    
    def get_provinces(self) -> List[str]:
        """보유 영토 목록 반환"""
        if not self.provinces:
            return []
        return json.loads(self.provinces)
    
    def set_provinces(self, provinces: List[str]):
        """보유 영토 목록 설정"""
        self.provinces = json.dumps(provinces, ensure_ascii=False)
    
    def add_province(self, province: str):
        """영토 추가"""
        provinces = self.get_provinces()
        if province not in provinces:
            provinces.append(province)
            self.set_provinces(provinces)
    
    def remove_province(self, province: str):
        """영토 제거"""
        provinces = self.get_provinces()
        if province in provinces:
            provinces.remove(province)
            self.set_provinces(provinces)
    
    def calculate_total_score(self) -> int:
        """국가의 종합 점수 계산
        
        재정, 인구, 군사력, 행복도를 종합하여 점수를 산출합니다.
        - 재정: 100당 1점
        - 인구: 100당 1점
        - 군사력: 1당 50점
        - 행복도: 1당 10점
        """
        score = (
            (self.finance // 100) +
            (self.population // 100) +
            (self.military * 50) +
            (self.happiness * 10)
        )
        return score
    
    def update_total_score(self):
        """totalScore를 현재 상태 기반으로 업데이트"""
        self.totalScore = self.calculate_total_score()


class CommandLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    countryID: str = Field(foreign_key="country.id")
    command: str
    response: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class NewsItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    countryID: str = Field(foreign_key="country.id")
    title: str
    content: str
    type: str  # "general", "ai_turn", "public_only"
    is_public: bool = True  # False면 비밀 정보 (뉴스로 공개 안 됨)


class SecretIntelligence(SQLModel, table=True):
    """비밀 정보 - 공개되지 않는 민감한 정보"""
    id: Optional[int] = Field(default=None, primary_key=True)
    countryID: str = Field(foreign_key="country.id")  # 정보의 소유자
    title: str
    content: str
    intelligence_type: str  # "military_plan", "diplomacy_plot", "spy_operation" 등
    shared_with: str = ""  # JSON 형식: ["baekje", "silla"] - 공유할 국가들
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    def get_shared_countries(self) -> List[str]:
        """공유하는 국가 목록 반환"""
        if not self.shared_with:
            return []
        return json.loads(self.shared_with)
    
    def set_shared_countries(self, countries: List[str]):
        """공유할 국가 목록 설정"""
        self.shared_with = json.dumps(countries, ensure_ascii=False)
    
    def is_shared_with(self, country_id: str) -> bool:
        """특정 국가와 공유 여부 확인"""
        return country_id in self.get_shared_countries()


class MilitaryUnit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    countryID: str = Field(foreign_key="country.id")
    name: str
    count: int
    icon: str
    unit_type: str = "regular"  # "regular", "spy", "assassin" 등
    
    def is_spy(self) -> bool:
        """스파이 여부 확인"""
        return self.unit_type in ["spy", "assassin", "scout", "infiltrator"]


class Diplomacy(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sourceID: str = Field(foreign_key="country.id")
    targetName: str
    status: str
    favorability: int = 0


class Territory(SQLModel, table=True):
    """영토 소유권 정보"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)  # 사용자별로 영토 분리
    province_name: str = Field(index=True)  # 지역명 (예: "인천광역시", "서울특별시")
    owner: str = Field(index=True)  # 소유 국가 ID (예: "goguryeo", "baekje", "silla")
    
    class Config:
        # user_id와 province_name의 조합이 고유해야 함
        pass


class User(SQLModel, table=True):
    """사용자 정보 - Google OAuth 및 이메일/비밀번호 인증"""
    id: Optional[int] = Field(default=None, primary_key=True)
    google_id: Optional[str] = Field(default=None, unique=True, index=True)  # Google user ID (optional)
    email: str = Field(unique=True, index=True)  # 이메일 (고유)
    name: str
    password_hash: Optional[str] = Field(default=None)  # 비밀번호 해시 (이메일 로그인용)
    picture: Optional[str] = None  # Profile picture URL
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)