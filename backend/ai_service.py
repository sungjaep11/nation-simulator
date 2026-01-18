import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Initialize client lazily when function is called
_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            raise ValueError("GEMINI_API_KEY not configured in .env file")
        _client = genai.Client(api_key=api_key)
    return _client

def _get_mock_response(user_input: str, current_stats: dict) -> dict:
    """Return mock response for testing/quota limits"""
    return {
        "scenario": "천천히 세력을 키우는 중입니다. 경제는 안정적이고 군사력도 강화되고 있습니다. 주변국과의 관계는 평화롭습니다.",
        "news": ["금 50개 획득", "인구 100명 증가", "군대 사기 향상"],
        "changes": {"gold": 50, "population": 100, "military": 1, "happiness": 5}
    }

async def get_gemini_game_data(user_input: str, current_stats: dict):
    """
    Gemini를 통해 시나리오, 뉴스 및 스탯 변화량만 JSON으로 생성합니다.
    """
    try:
        client = _get_client()
        
        prompt = f"""
        당신은 삼국시대 게임의 시스템 AI입니다. 유저의 명령을 분석해 다음을 JSON으로만 응답하세요.
        [현재 스탯] {current_stats}
        [유저 명령] "{user_input}"
        
        응답 JSON 형식:
        {{
            "scenario": "이번 턴의 상황 전개 (한국어, 3-4문장)",
            "news": ["뉴스 속보 1", "뉴스 속보 2", "뉴스 속보 3"],
            "changes": {{"gold": 숫자, "population": 숫자, "military": 숫자, "happiness": 숫자}}
        }}
        """
        
        # 텍스트 생성 요청
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        # JSON 문자열 추출 및 파싱
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    except Exception as e:
        # API 오류 발생 시 모의 응답 반환
        print(f"Gemini API Error: {e}")
        return _get_mock_response(user_input, current_stats)