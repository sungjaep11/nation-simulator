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
        text = response.text
        if not text:
            raise RuntimeError("Gemini API returned empty or None response text")
        return str(text)
    elif _GENAI_LIB == "google.generativeai":
        model = client.GenerativeModel(model_name)  # type: ignore
        response = model.generate_content(prompt)
        text = response.text
        if not text:
            raise RuntimeError("Gemini API returned empty or None response text")
        return str(text)
    else:
        raise RuntimeError("Unsupported Gemini client configuration")

def _is_retryable_error(msg: str) -> bool:
    lower = msg.lower()
    return any(key in lower for key in ["429", "resource_exhausted", "quota", "rate limit", "too many requests", "503", "unavailable", "overloaded"])

async def _generate_text_with_retry(prompt: str, model_name: str = AI_MODEL, retries: int = 2, base_delay: float = 1.5) -> str:
    last_exception: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return _generate_text(prompt, model_name)
        except Exception as e:
            last_exception = e
            if attempt < retries and _is_retryable_error(str(e)):
                await asyncio.sleep(base_delay * (2 ** attempt))
                continue
            raise
    # Type checker fallback (should never be reached)
    raise last_exception if last_exception else RuntimeError("Failed to generate text after retries")

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


def _find_complete_json(text: str) -> str:
    """중괄호 균형을 맞춰 완전한 JSON 객체를 찾습니다."""
    start = text.find('{')
    if start == -1:
        return ""
    
    depth = 0
    in_string = False
    escape_next = False
    
    for i, char in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if char == '\\':
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1]
    return ""


def _extract_json_from_response(response_text: str) -> str:
    """AI 응답에서 JSON 객체를 추출합니다."""
    clean_json = response_text.strip()
    
    # JSON 코드 블록 제거
    if '```json' in clean_json:
        start = clean_json.find('```json') + 7
        end = clean_json.find('```', start)
        if end != -1:
            clean_json = clean_json[start:end].strip()
    elif '```' in clean_json:
        start = clean_json.find('```') + 3
        end = clean_json.find('```', start)
        if end != -1:
            clean_json = clean_json[start:end].strip()
    
    # 완전한 JSON 객체 찾기 (중괄호 균형 맞추기)
    return _find_complete_json(clean_json)

async def get_gemini_game_data(user_input: str, current_stats: dict, all_countries: Optional[dict] = None):
    """
    Gemini를 통해 시나리오, 뉴스, 스탯 변화 및 액션을 JSON으로 생성합니다.
    
    Args:
        user_input: 사용자 입력 명령
        current_stats: 현재 국가의 스탯 (provinces 포함)
        all_countries: 모든 국가의 현재 상태 (dict, provinces 포함)
    """
    try:
        _get_client()  # Ensure client is configured
        
        other_countries_info = ""
        if all_countries:
            # 다른 국가들의 외교, 군사, 영토 정보도 포함
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
                # 영토 정보 추가
                if "provinces" in country_data:
                    other_countries_with_info[country_id]["provinces"] = country_data["provinces"]
            other_countries_info = f"\n[다른 국가들 현황] {json.dumps(other_countries_with_info, ensure_ascii=False)}"
        
        # 현재 스탯에서 핵심 정보만 추출 (lite 버전)
        current_stats_lite = {k: v for k, v in current_stats.items() if k not in ['diplomacy', 'military_units', 'provinces']}
        
        # 다른 국가들의 핵심 정보만 추출 (lite 버전)
        other_countries_lite = {}
        if all_countries:
            for country_id, country_data in all_countries.items():
                other_countries_lite[country_id] = {
                    k: v for k, v in country_data.items() 
                    if k not in ['diplomacy', 'military_units']
                }
                # 영토 정보는 포함 (점령 시 필요)
                if "provinces" in country_data:
                    other_countries_lite[country_id]["provinces"] = country_data["provinces"]
        
        prompt = f"""
[역할] 삼국시대 전략 게임 마스터 AI. 유저 명령을 데이터 기반 JSON으로 변환.

[핵심 규칙]
1. 영토 점령: 'war' 액션 시 'captured_provinces'는 반드시 제공된 [상대국 영토 리스트] 내에서만 선택할 것.
2. 전쟁 인과관계: 전쟁(`type: war`)이 포함된 경우 'population' 변화량은 반드시 0 이하(음수)로 설정할 것.
3. 외교 상태: 'status' 필드는 반드시 "동맹", "중립", "적대" 중 하나만 사용(영문 절대 금지).
4. 유닛 생성: 명령이 없을 때 무분별한 유닛(첩자 등) 생성을 자제하고, 유저가 요청한 유닛(해군 등)을 우선 반영할 것.

[입력 데이터 정보]
- 내 국가: {current_stats.get('name')}
- 내 스탯: {json.dumps(current_stats_lite, ensure_ascii=False)}
- 타국 현황: {json.dumps(other_countries_lite, ensure_ascii=False)}
- 유저 명령: "{user_input}"

[출력 JSON 형식]
{{
    "scenario": "상황 요약 (2-3문장)",
    "mood": "happy/neutral/angry/depressed",
    "changes": {{
        "finance": 수치,
        "population": 수치(전쟁 시 <= 0),
        "military": 수치,
        "happiness": 수치
    }},
    "actions": [
        {{
            "type": "war",
            "target": "국가명",
            "outcome": "승리/패배",
            "land_gained": 점령수,
            "captured_provinces": ["지역명1", "지역명2"],
            "casualties": 사상자수
        }},
        {{
            "type": "add_military",
            "name": "유닛명(해군/철기병 등)",
            "count": 수량,
            "icon": "아이콘",
            "unit_type": "regular/spy/navy"
        }},
        {{
            "type": "diplomacy",
            "target": "국가명",
            "status": "동맹/중립/적대",
            "favorability": 수치
        }}
    ]
}}
**반드시 JSON 객체 하나만 출력하고 추가 설명은 생략하세요.**
        """
        
        # 텍스트 생성 요청
        response_text = await _generate_text_with_retry(prompt, model_name=AI_MODEL)
        
        # 디버깅: 원본 응답 출력
        print("=" * 80)
        print("🤖 Gemini API Raw Response:")
        print(response_text)
        print("=" * 80)
        
        # JSON 문자열 추출 및 파싱
        clean_json = _extract_json_from_response(response_text)
        
        if not clean_json:
            raise ValueError("응답에서 JSON을 찾을 수 없습니다.")
        
        result = json.loads(clean_json)
        
        # 디버깅: 파싱된 JSON 출력
        print("=" * 80)
        print("🤖 Parsed JSON:")
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
    except json.JSONDecodeError as e:
        # JSON 파싱 오류 발생 시 상세 정보 출력
        print(f"JSON 파싱 오류: {e}")
        # 변수 접근 (try 블록에서 정의되었을 수 있음)
        response_text_val = locals().get('response_text', 'N/A')
        clean_json_val = locals().get('clean_json', 'N/A')
        print(f"응답 텍스트: {response_text_val}")
        print(f"정리된 JSON: {clean_json_val}")
        # 모의 응답 반환
        return _get_mock_response(user_input, current_stats)
    except Exception as e:
        # API 오류 발생 시 모의 응답 반환
        print(f"Gemini API Error: {e}")
        import traceback
        traceback.print_exc()
        return _get_mock_response(user_input, current_stats)


async def get_ai_country_turn(country_stats: dict, all_countries: dict) -> dict:
    """
    AI가 운영하는 국가의 자동 턴 진행
    
    Args:
        country_stats: AI 국가의 현재 스탯 (provinces 포함)
        all_countries: 모든 국가의 현재 상태 (provinces 포함)
    
    Returns:
        턴 결과 (scenario, public_news, secret_news, changes, actions)
    """
    try:
        _get_client()  # Ensure client is configured
        
        # 외교, 군사, 영토 정보 추출
        diplomacy_info = ""
        military_info = ""
        provinces_info = ""
        if "diplomacy" in country_stats and country_stats["diplomacy"]:
            diplomacy_info = f"\n[내 외교 관계] {json.dumps(country_stats['diplomacy'], ensure_ascii=False)}"
        if "military_units" in country_stats and country_stats["military_units"]:
            military_info = f"\n[내 군사 유닛] {json.dumps(country_stats['military_units'], ensure_ascii=False)}"
        if "provinces" in country_stats and country_stats["provinces"]:
            provinces_info = f"\n[내 보유 영토] {json.dumps(country_stats['provinces'], ensure_ascii=False)}"
        
        # 다른 국가들의 외교, 군사, 영토 정보도 포함
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
            # 영토 정보 추가
            if "provinces" in country_data:
                other_countries_with_info[country_id]["provinces"] = country_data["provinces"]
        
        prompt = f"""
당신은 삼국시대 게임에서 "{country_stats['name']}" 국가를 운영하는 AI입니다.
현재 상황을 전략적으로 분석하고, 이번 턴의 행동과 결과를 결정하세요.

[내 국가: {country_stats['name']}]
[내 스탯] {json.dumps({k: v for k, v in country_stats.items() if k not in ['diplomacy', 'military_units', 'provinces']}, ensure_ascii=False)}{provinces_info}{diplomacy_info}{military_info}
[다른 국가들] {json.dumps(other_countries_with_info, ensure_ascii=False)}

### AI 전략 지침 ###
1. 자율적 의사결정:
   - **균형잡힌 발전을 추구하세요. 매 턴마다 무조건 큰 액션을 할 필요는 없습니다.**
   - 상황에 따라 내정, 외교, 군사 증강 중 적절히 선택 (모든 턴에 액션 필수 아님)
   - 약한 국가가 있으면 도발 고려하되, 무리한 전쟁은 피하세요
   - 외교 관계에 따라 동맹 또는 협력 결정 (배신은 5%의 확률로만)
   - 군사력이 크게 우위일 때만 전쟁 고려
   - **전쟁은 소규모 충돌부터 시작 가능 (전면전만 강제하지 않음)**

2. 수치 설정 (플레이어 국가보다 낮은 성장 속도 유지):
   - 적극적인 행동(전쟁, 개혁, 건설): 작은 변화 (finance/population: -30~30, happiness: -2~2, military: -1~1)
   - 소극적인 행동(내정, 평화): 매우 작은 변화 (finance/population: -10~15, happiness: -1~1, military: 0)
   - 군사 증강: military 0~1 증가 (극도로 제한적), finance 적절히 감소
   - 외교: happiness, favorability 변화
   - 실패/저항: 음수 변화
   - **중요: 플레이어 국가보다 낮은 성장 속도를 유지하세요. AI 국가는 플레이어를 따라잡거나 초과하지 않아야 합니다.**
   - **교역/무역 활동: finance는 반드시 양수(+) (예: +10~+30). AI 국가도 교역으로 재정이 감소하는 것은 불가능합니다.**
   - **전쟁 시: 승리하더라도 happiness는 -3~-8 감소 가능, population은 -50~-150 감소 가능 (전쟁의 현실적 피해)**

3. 다양한 Mood 생성 (균형있게):
   - happy (25%): 전쟁 승리, 영토 확장, 외교 성공, 경제 호황
   - neutral (50%): 평상시 운영, 소극적 외교, 정상적 발전, 내정 집중
   - angry (15%): 전쟁 패배, 침략당함, 동맹 깨짐, 경제 위기
   - depressed (10%): 큰 손실, 영토 상실, 멸망 위기

4. 액션 선택 (균형있게):
   - add_military: **극도로 드물게만 생성 (5% 확률, 5~6턴에 한 번 정도)**, **유닛명을 구체적으로 (철기병, 궁병, 해군 등), 수량은 5~15명 정도로 극도로 제한적. unit_type은 "regular", "spy", "navy" 중 하나**
   - **[절대 금지] "첩자"나 "철기병"을 매 턴 자동으로 생성하지 마세요. 정당한 전략적 이유가 있을 때만 매우 드물게 생성하세요.**
   - war: **정당한 이유가 있을 때만 전쟁 시작. outcome은 50% 확률로 승리/패배. land_gained/land_lost는 1~3 영토 (플레이어보다 작은 규모). captured_provinces에 실제 점령한 적국 영토명 명시 필수!**
   - diplomacy: **50% 확률로 성공(favorability +15~25) 또는 실패(favorability -10~15), status는 반드시 한글 "동맹", "중립", "적대" 사용**
   - secret_operation: 가끔 사용 (5% 확률)
   - **액션은 선택적입니다. 매 턴마다 액션이 필요하지 않습니다. 대부분의 턴(70% 이상)은 액션 없이 내정에 집중하세요.**
   - **군사 증강은 극도로 드물게만 하세요 (5% 확률). 대부분의 턴은 내정이나 외교에 집중하세요.**
   - **war 액션 시 captured_provinces 필수!** 적국의 provinces 목록에서만 선택 가능. captured_provinces 개수 = land_gained 값과 일치해야 함

5. **균형잡힌 게임 진행 (중요!)**:
   - 플레이어 국가보다 낮은 성장 속도를 유지하세요. AI는 플레이어를 따라잡거나 초과하지 않아야 합니다.
   - 인과관계의 명확성: 모든 수치 변화(changes)와 액션(actions)은 앞서 작성한 scenario와 논리적으로 일치해야 합니다.
   - 선택적 액션: actions 배열은 비어있을 수 있습니다. 억지로 전쟁이나 대규모 액션을 끼워 넣지 마세요.
   - 외교는 정확히 50% 확률로 성공/실패
   - **군사 증강은 극도로 드물게만 하세요 (5% 확률, 5~6턴에 한 번). 수량은 5~15명으로 극도로 제한적. 과도한 군사 증강은 절대 금지**
   - **[절대 금지] "첩자"나 "철기병"을 매 턴 자동으로 생성하지 마세요. 정당한 전략적 이유가 있을 때만 매우 드물게 생성하세요.**
   - 전쟁 casualties는 30~100명 정도로 제한 (플레이어보다 작은 규모)
   - **중요: 이 함수는 AI가 자율적으로 운영하는 국가의 턴을 처리합니다. 유저 명령과는 무관합니다.**
   - **군사력 증가를 최소화하고, 대부분의 턴(70% 이상)은 액션 없이 내정(재정, 인구, 행복도)에 집중하세요.**
   - **교역/무역 활동 시 finance는 반드시 양수(+)가 되어야 합니다.**
   - **전쟁 시 승리하더라도 happiness와 population 감소는 현실적인 현상입니다.**

응답 JSON 형식:
{{
    "scenario": "이번 턴의 전략적 선택과 결과 (명확하게). 전쟁/외교는 극적으로 묘사",
    "mood": "happy/neutral/angry/depressed (다양하게)",
    "public_news": [
        "{country_stats['name']}의 신규 군대 모집",
        "타국과의 외교 담판",
        "경제 정책 발표"
    ],
    "secret_news": ["비밀 작전, 전쟁 계획 등"],
    "changes": {{"finance": 15, "population": 10, "military": 0, "happiness": 1}},
    "actions": [
        {{"type": "add_military", "name": "철기병", "count": 15, "icon": "🐎", "unit_type": "regular"}},
        {{"type": "add_military", "name": "해군", "count": 10, "icon": "⛵", "unit_type": "navy"}},
        {{"type": "war", "target": "약한_국가명", "outcome": "승리", "land_gained": 2, "land_lost": 0, "casualties": 100, "captured_provinces": ["경기도", "인천광역시"]}},
        {{"type": "diplomacy", "target": "국가명", "status": "동맹", "favorability": 25}}
     * status는 반드시 한글 "동맹", "중립", "적대" 중 하나 사용
     * add_military는 매우 드물게만 포함 (대부분의 턴에는 actions가 비어있거나 다른 액션만 포함)
     * war 액션의 captured_provinces는 실제로 점령한 적국 영토명 리스트 (적국의 provinces에서 선택, 시나리오와 일치해야 함)
    ]
}}

**[절대 규칙] 반드시 위의 JSON 형식으로만 응답하세요. 설명, 마크다운, 추가 텍스트 없이 오직 JSON 객체 하나만 출력하세요.**

**[매우 중요 - 언어 규칙]**
- diplomacy 액션의 status 필드는 **절대로 영문(neutral, alliance, hostile 등)을 사용하지 마세요!**
- status는 **반드시 한글**로만 응답하세요: "동맹", "중립", "적대" 중 하나
- 영문 status 사용 시 게임 시스템 오류가 발생합니다. 반드시 한글만 사용하세요!
        """
        
        # 텍스트 생성 요청
        response_text = await _generate_text_with_retry(prompt, model_name=AI_MODEL)
        
        # JSON 문자열 추출 및 파싱
        clean_json = _extract_json_from_response(response_text)
        
        if not clean_json:
            raise ValueError("응답에서 JSON을 찾을 수 없습니다.")
        
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
            "changes": {"finance": 20, "population": 15, "military": 0, "happiness": 1},
            "actions": []
        }