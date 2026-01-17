import os
import json
import httpx
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
# .env 파일에 GEMINI_API_KEY를 설정해야 합니다.
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-3.0-flash')

# Flux 모델이 구동 중인 GPU 서버 주소 (예시)
FLUX_SERVER_URL = "http://172.10.5.110:11434/generate-image"

async def get_gemini_game_data(user_input: str, current_stats: dict):
    """
    Gemini를 통해 시나리오, 뉴스, Flux용 영어 프롬프트 및 스탯 변화를 생성합니다.
    """
    prompt = f"""
    당신은 삼국시대 게임의 시스템 AI입니다. 유저의 명령을 분석해 다음을 JSON으로만 응답하세요.
    [현재 스탯] {current_stats}
    [유저 명령] "{user_input}"
    
    응답 JSON 형식:
    {{
        "scenario": "이번 턴의 상황 전개 (한국어, 3-4문장)",
        "news": ["뉴스 속보 1", "뉴스 속보 2", "뉴스 속보 3"],
        "image_prompt": "Detailed English prompt for Flux image model. Focus on ancient Korean/Oriental aesthetics, cinematic lighting, and the current scenario.",
        "changes": {{"gold": 숫자, "population": 숫자, "military": 숫자, "happiness": 숫자}}
    }}
    """
    response = model.generate_content(prompt)
    # JSON 문자열만 추출하여 파싱
    clean_json = response.text.replace('```json', '').replace('```', '').strip()
    return json.loads(clean_json)

async def generate_flux_image(prompt: str):
    """
    GPU 서버의 Flux 모델에 이미지 생성을 요청합니다.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                FLUX_SERVER_URL,
                json={"prompt": prompt},
                timeout=60.0
            )
            return response.json().get("image_url")
        except Exception as e:
            print(f"이미지 생성 실패: {e}")
            return None