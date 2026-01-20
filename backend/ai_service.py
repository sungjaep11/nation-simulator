import os
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv

# Prefer new google.genai client; fallback to legacy only if unavailable
try:
    from google.genai import Client as GenaiClient  # type: ignore
    _GENAI_LIB = "google.genai"
except Exception:
    GenaiClient = None  # type: ignore
    _GENAI_LIB = None
    try:
        import google.generativeai as genai_legacy  # type: ignore
        _GENAI_LIB = "google.generativeai"
    except Exception:
        genai_legacy = None  # type: ignore
        _GENAI_LIB = None

load_dotenv()

# AI 모델 설정
AI_MODEL = "gemma-3-4b-it"

_api_key = None
_client = None

def _get_api_key():
    global _api_key
    if _api_key is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            raise ValueError("GEMINI_API_KEY not configured in .env file")
        _api_key = api_key
    return _api_key

def _get_client():
    global _client
    if _client is None:
        api_key = _get_api_key()
        if _GENAI_LIB == "google.genai" and GenaiClient is not None:
            _client = GenaiClient(api_key=api_key)
        elif _GENAI_LIB == "google.generativeai" and genai_legacy is not None:
            genai_legacy.configure(api_key=api_key)  # type: ignore
            _client = genai_legacy  # module acts as client; use per-call model
        else:
            raise RuntimeError("No Gemini client available. Install google-genai.")
    return _client

def _generate_text(prompt: str, model_name: str = AI_MODEL) -> str:
    client = _get_client()
    if _GENAI_LIB == "google.genai":
        response = client.models.generate_content(model=model_name, contents=prompt)
        return response.text
    elif _GENAI_LIB == "google.generativeai":
        model = client.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        return response.text
    else:
        raise RuntimeError("Unsupported Gemini client configuration")

def _is_retryable_error(msg: str) -> bool:
    lower = msg.lower()
    return any(key in lower for key in ["429", "resource_exhausted", "quota", "rate limit", "too many requests", "503", "unavailable", "overloaded"])

async def _generate_text_with_retry(prompt: str, model_name: str = AI_MODEL, retries: int = 2, base_delay: float = 1.5) -> str:
    for attempt in range(retries + 1):
        try:
            return _generate_text(prompt, model_name)
        except Exception as e:
            if attempt < retries and _is_retryable_error(str(e)):
                await asyncio.sleep(base_delay * (2 ** attempt))
                continue
            raise

def _get_mock_response(user_input: str, current_stats: dict) -> dict:
    """Return mock response for testing/quota limits"""
    return {
        "scenario": "천천히 세력을 키우는 중입니다. 경제는 안정적이고 군사력도 강화되고 있습니다. 주변국과의 관계는 평화롭습니다.",
        "mood": "neutral",
        "public_news": ["금 50개 획득", "인구 100명 증가", "군대 사기 향상"],
        "secret_news": [],
        "changes": {"finance": 50, "population": 100, "military": 1, "happiness": 5},
        "actions": []
    }

async def get_gemini_game_data(user_input: str, current_stats: dict, all_countries: Optional[dict] = None):
    """
    Gemini를 통해 시나리오, 뉴스, 스탯 변화 및 액션을 JSON으로 생성합니다.
    
    Args:
        user_input: 사용자 입력 명령
        current_stats: 현재 국가의 스탯
        all_countries: 모든 국가의 현재 상태 (dict)
    """
    try:
        _get_client()  # Ensure client is configured
        
        other_countries_info = ""
        if all_countries:
            # 다른 국가들의 외교 및 군사 정보도 포함
            other_countries_with_info = {}
            for country_id, country_data in all_countries.items():
                other_countries_with_info[country_id] = {
                    k: v for k, v in country_data.items() 
                    if k not in ['diplomacy', 'military_units']
                }
                if "diplomacy" in country_data:
                    other_countries_with_info[country_id]["diplomacy"] = country_data["diplomacy"]
                if "military_units" in country_data:
                    other_countries_with_info[country_id]["military_units"] = country_data["military_units"]
            other_countries_info = f"\n[다른 국가들 현황] {json.dumps(other_countries_with_info, ensure_ascii=False)}"
        
        # 외교 및 군사 정보 추출
        diplomacy_info = ""
        military_info = ""
        if "diplomacy" in current_stats and current_stats["diplomacy"]:
            diplomacy_info = f"\n[현재 외교 관계] {json.dumps(current_stats['diplomacy'], ensure_ascii=False)}"
        if "military_units" in current_stats and current_stats["military_units"]:
            military_info = f"\n[현재 군사 유닛] {json.dumps(current_stats['military_units'], ensure_ascii=False)}"
        
        prompt = f"""
당신은 삼국시대 게임의 시스템 AI입니다. 
현재 유저는 "{current_stats.get('name', '')}" 국가를 플레이하고 있습니다.
유저의 명령과 현재 판세를 바탕으로 '이번 턴의 결과'를 작성하고, 공개/비밀 뉴스, 수치 변화, 그리고 실행할 액션을 JSON으로만 응답하세요.

[유저 국가: {current_stats.get('name', '')}]
[현재 스탯] {json.dumps({k: v for k, v in current_stats.items() if k not in ['diplomacy', 'military_units']}, ensure_ascii=False)}{diplomacy_info}{military_info}{other_countries_info}
[유저 명령] "{user_input}"

### 필수 규칙 ###
1. changes 필드는 유저의 명령과 현재 상황에 맞게 설정하세요:
   - 적극적인 명령(전쟁, 개혁, 건설): 큰 변화 (finance/population: -100~100, happiness, military: -10~10)
   - 소극적인 명령(내정, 평화): 작은 변화 (finance/population: -20~20, happiness, military: -5~5)
   - 군사 증강: military 1~5 증가, finance 감소
   - 외교: happiness, favorability 변화
   - 실패/저항: 음수 변화

2. 명령 해석 (이것이 매우 중요):
   - "전쟁", "침략", "공격", "정복" → war 액션 생성 필수. military 크게 감소 가능
   - "외교", "동맹", "강화" → diplomacy 액션 생성. favorability 증가
   - "군사 증강", "모집", "병사", "군대" → add_military 액션 생성. finance 감소
   - "내정", "개혁", "정치" → finance/population/happiness 증가, military 변화 없음
   - "스파이", "암살", "정보" → secret_operation 액션 생성

3. 다양한 Mood 생성 (angry만 아님):
   - happy: 전쟁 승리, 외교 성공, 경제 성장, 영토 확장
   - neutral: 평상시 내정, 소극적 외교, 정체된 상황
   - angry: 패배, 도발 받음, 경제 위기, 반란/저항
   - depressed: 큰 손실, 전쟁 패배, 영토 상실, 동맹 깨짐

4. 시나리오와 뉴스는 변화값과 일관성 있어야 함:
   - 군대 추가 → "신병 모집", "병영 확대" 같은 뉴스
   - 재정 감소 → "세금 인상", "전쟁 비용" 같은 원인
   - 인구 증가 → "인구 유입", "농업 발전" 같은 원인
   - 행복도 변화 → 백성 감정과 연관된 뉴스

액션 형식:
- war: {{"type": "war", "target": "적국명", "outcome": "승리/패배/교착", "land_gained": 영토, "land_lost": 영토, "casualties": 전사자}}
  * outcome에 따라 수치 자동 반영
- add_military: {{"type": "add_military", "name": "군대명", "count": 수량, "icon": "아이콘", "unit_type": "regular/spy"}}
  * 반드시 생성하면 finance에서 비용 공제 필수
- diplomacy: {{"type": "diplomacy", "target": "국가명", "status": "동맹/중립/적대", "favorability": -100~100}}
- secret_operation: {{"type": "secret_operation", "title": "작전명", "content": "내용", "operation_type": "암살/스파이/선동", "target_country": "목표국가"}}

응답 형식 (JSON만):
{{
    "scenario": "이번 턴에 일어난 일을 3-4문장으로 설명. 명령과 결과를 명확히 드러내야 함",
    "mood": "happy/neutral/angry/depressed (다양하게)",
    "public_news": [
        "{current_stats.get('name', '')}의 신병 모집 완료",
        "타국의 도발에 {current_stats.get('name', '')}가 경고",
        "평화로운 외교 담판 진행"
    ],
    "secret_news": ["비밀 정보나 작전 내용"],
    "changes": {{"finance": 0, "population": 0, "military": 0, "happiness": 0}},
    "actions": [
        {{"type": "add_military", "name": "철기병", "count": 50, "icon": "🐎", "unit_type": "regular"}},
        {{"type": "war", "target": "고구려", "outcome": "승리", "land_gained": 2, "land_lost": 0, "casualties": 100}}
    ]
}}

### 중요 ###
- 모든 명령에 대해 논리적 결과를 제시하세요
- 군대 추가 시 재정 비용을 반영하세요 (50명 당 재정 -50 정도)
- 전쟁 시뮬레이션: 아군 군사력 vs 적군 군사력으로 승패 결정
- 절대 공란 액션을 생성하지 마세요
        """
        
        # 텍스트 생성 요청
        response_text = await _generate_text_with_retry(prompt, model_name=AI_MODEL)
        
        # JSON 문자열 추출 및 파싱
        clean_json = response_text.replace('```json', '').replace('```', '').strip()
        result = json.loads(clean_json)
        
        # 디버깅: Gemini API 응답 출력
        print("=" * 80)
        print("🤖 Gemini API Response:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print("=" * 80)
        
        # actions 필드가 없으면 빈 배열로 초기화
        if 'actions' not in result:
            result['actions'] = []
        if 'public_news' not in result:
            result['public_news'] = result.get('news', [])  # 하위 호환성
        if 'secret_news' not in result:
            result['secret_news'] = []
        if 'mood' not in result:
            result['mood'] = 'neutral'  # 기본값
        
        return result
    except Exception as e:
        # API 오류 발생 시 모의 응답 반환
        print(f"Gemini API Error: {e}")
        return _get_mock_response(user_input, current_stats)


async def get_ai_country_turn(country_stats: dict, all_countries: dict) -> dict:
    """
    AI가 운영하는 국가의 자동 턴 진행
    
    Args:
        country_stats: AI 국가의 현재 스탯
        all_countries: 모든 국가의 현재 상태
    
    Returns:
        턴 결과 (scenario, public_news, secret_news, changes, actions)
    """
    try:
        _get_client()  # Ensure client is configured
        
        # 외교 및 군사 정보 추출
        diplomacy_info = ""
        military_info = ""
        if "diplomacy" in country_stats and country_stats["diplomacy"]:
            diplomacy_info = f"\n[내 외교 관계] {json.dumps(country_stats['diplomacy'], ensure_ascii=False)}"
        if "military_units" in country_stats and country_stats["military_units"]:
            military_info = f"\n[내 군사 유닛] {json.dumps(country_stats['military_units'], ensure_ascii=False)}"
        
        # 다른 국가들의 외교 및 군사 정보도 포함
        other_countries_with_info = {}
        for country_id, country_data in all_countries.items():
            other_countries_with_info[country_id] = {
                k: v for k, v in country_data.items() 
                if k not in ['diplomacy', 'military_units']
            }
            if "diplomacy" in country_data:
                other_countries_with_info[country_id]["diplomacy"] = country_data["diplomacy"]
            if "military_units" in country_data:
                other_countries_with_info[country_id]["military_units"] = country_data["military_units"]
        
        prompt = f"""
당신은 삼국시대 게임에서 "{country_stats['name']}" 국가를 운영하는 AI입니다.
현재 상황을 전략적으로 분석하고, 이번 턴의 행동과 결과를 결정하세요.

[내 국가: {country_stats['name']}]
[내 스탯] {json.dumps({k: v for k, v in country_stats.items() if k not in ['diplomacy', 'military_units']}, ensure_ascii=False)}{diplomacy_info}{military_info}
[다른 국가들] {json.dumps(other_countries_with_info, ensure_ascii=False)}

### AI 전략 지침 ###
1. 자율적 의사결정:
   - 정기적으로 군사 증강, 외교 활동, 전쟁/도발을 시도하세요
   - 약한 국가가 있으면 도발하거나 침략 고려
   - 외교 관계에 따라 동맹 또는 배신 결정
   - 기회가 되면 전쟁 시작 (50% 확률)

2. 수치 설정:
   - finance: -500 ~ 1000 (군사비, 경제활동)
   - population: -200 ~ 500 (이민, 전쟁 피해)
   - military: -5 ~ 5 (전쟁, 모집)
   - happiness: -30 ~ 20 (전쟁, 세금, 외교)

3. 다양한 Mood 생성 (균형있게):
   - happy (30%): 전쟁 승리, 영토 확장, 외교 성공, 경제 호황
   - neutral (40%): 평상시 운영, 소극적 외교, 정상적 발전
   - angry (20%): 전쟁 패배, 침략당함, 동맹 깨짐, 경제 위기
   - depressed (10%): 큰 손실, 영토 상실, 멸망 위기

4. 액션 선택 (충동적으로):
   - add_military: 군력이 약하면 자주 (50% 이상 생성)
   - war: 군력이 우수하면 약한 국가에 선제 공격 (주기적)
   - diplomacy: 관계 변경, 동맹 제안, 우호도 조정
   - secret_operation: 도발, 암살, 스파이 활동

응답 JSON 형식:
{{
    "scenario": "이번 턴의 전략적 선택과 결과 (명확하게)",
    "mood": "happy/neutral/angry/depressed (다양하게)",
    "public_news": [
        "{country_stats['name']}의 신규 군대 모집",
        "타국과의 외교 담판",
        "경제 정책 발표"
    ],
    "secret_news": ["비밀 작전, 전쟁 계획 등"],
    "changes": {{"finance": 100, "population": 50, "military": 1, "happiness": 5}},
    "actions": [
        {{"type": "add_military", "name": "철기병", "count": 100, "icon": "🐎", "unit_type": "regular"}},
        {{"type": "war", "target": "약한_국가명", "outcome": "승리", "land_gained": 2, "land_lost": 0, "casualties": 50}},
        {{"type": "diplomacy", "target": "국가명", "status": "동맹", "favorability": 50}}
    ]
}}
        """
        
        # 텍스트 생성 요청
        response_text = await _generate_text_with_retry(prompt, model_name=AI_MODEL)
        
        clean_json = response_text.replace('```json', '').replace('```', '').strip()
        result = json.loads(clean_json)
        
        if 'actions' not in result:
            result['actions'] = []
        if 'public_news' not in result:
            result['public_news'] = result.get('news', [])
        if 'secret_news' not in result:
            result['secret_news'] = []
        if 'mood' not in result:
            result['mood'] = 'neutral'
        
        return result
    except Exception as e:
        print(f"AI Country Turn Error: {e}")
        # 기본 턴 진행
        return {
            "scenario": f"{country_stats['name']}이(가) 내정에 집중하고 있습니다.",
            "mood": "neutral",
            "public_news": ["안정적인 발전 중"],
            "secret_news": [],
            "changes": {"finance": 100, "population": 50, "military": 0, "happiness": 1},
            "actions": []
        }