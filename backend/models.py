from sqlmodel import SQLModel, Field
from typing import Optional

class Country(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    gold: int = 10000
    population: int = 50000
    happiness: int = 20
    military: int = 5
    total_score: int = (gold/10000 +population/10000 + happiness/10 + military/10) 