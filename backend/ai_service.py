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
    """
    API 실패 시 반환할 Mock 응답 (버그 #2 수정)
    
    주의: Mock 응답은 게임 상태를 변경하지 않는 중립적 응답이어야 합니다.
    AI API가 실패했을 때 사용자의 명령을 실행하지 않고,
    다음 턴에 다시 시도하도록 유도합니다.
    """
    country_name = current_stats.get('name', '국가')
    return {
        "scenario": f"⚠️ AI 시스템 오류로 인해 '{user_input}' 명령을 처리할 수 없습니다. {country_name}은(는) 현상 유지 중입니다. 다음 턴에 다시 시도해주세요.",
        "mood": "neutral",
        "public_news": [f"{country_name}이(가) 안정적으로 유지되고 있습니다."],
        "secret_news": [],
        "changes": {"finance": 0, "population": 0, "military": 0, "happiness": 0},
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
        
        # 현재 국가의 영토 정보 추출
        my_provinces = current_stats.get('provinces', [])
        my_provinces_info = f"\n[내 보유 영토] {json.dumps(my_provinces, ensure_ascii=False)}" if my_provinces else ""
        
        # 각 국가별 영토 정보를 명확히 표시
        provinces_summary = ""
        if all_countries:
            for country_id, country_data in all_countries.items():
                country_name = country_data.get('name', country_id)
                country_provinces = country_data.get('provinces', [])
                if country_provinces:
                    provinces_summary += f"\n- {country_name}의 영토: {', '.join(country_provinces)}"
        
        # ===== 군사력 비교 결과 미리 계산 =====
        # AI가 scenario 작성 시 정확한 승패를 알 수 있도록 함
        my_military = current_stats.get('military', 0)
        war_predictions = ""
        if all_countries:
            predictions = []
            for country_id, country_data in all_countries.items():
                if country_data.get('name') != current_stats.get('name'):
                    enemy_military = country_data.get('military', 0)
                    enemy_name = country_data.get('name', country_id)
                    if my_military > enemy_military:
                        result = "승리"
                    elif my_military < enemy_military:
                        result = "패배"
                    else:
                        result = "승리"  # 동점시 공격자 이점
                    predictions.append(f"- {current_stats.get('name')}({my_military}) vs {enemy_name}({enemy_military}) → {result}")
            if predictions:
                war_predictions = "\n[전쟁 예상 결과 (군사력 비교)]\n" + "\n".join(predictions)
        
        prompt = f"""
[역할] 삼국시대 전략 게임 마스터 AI. 유저 명령을 데이터 기반 JSON으로 변환.

[핵심 규칙]
1. 영토 점령: 'war' 액션 시 'captured_provinces'는 반드시 제공된 [상대국 영토 리스트] 내에서만 선택할 것.
2. 전쟁 인과관계: 전쟁(`type: war`)이 포함된 경우 'population' 변화량은 반드시 0 이하(음수)로 설정할 것.
3. 외교 상태: 'status' 필드는 반드시 "동맹", "중립", "적대" 중 하나만 사용(영문 절대 금지).
4. 유닛 생성: 명령이 없을 때 무분별한 유닛(첩자 등) 생성을 자제하고, 유저가 요청한 유닛(해군 등)을 우선 반영할 것.
5. **[매우 중요] casualties(사상자)는 반드시 양수로 설정하세요. 음수 금지!**
6. **[매우 중요] outcome이 '패배'일 경우 captured_provinces는 빈 배열([])이어야 합니다. 패배하면 영토를 점령할 수 없습니다!**
7. **[매우 중요] scenario 텍스트에서 언급하는 지역명은 반드시 실제 게임 상태와 일치해야 합니다.**
   - scenario에서 지역명을 언급할 때는 반드시 아래 [현재 영토 현황]에 나열된 실제 영토만 언급하세요.
   - 예를 들어, 경상북도를 공격했다면 scenario에도 "경상북도"라고 정확히 언급해야 합니다.
   - 함강도, 경북상도 등 실제로 존재하지 않거나 잘못된 지역명을 사용하지 마세요.
8. **[매우 중요] 전쟁 타겟 결정: 유저가 특정 지역을 공격/점령/탈환하라고 명령하면, 반드시 [현재 영토 현황]에서 해당 지역을 실제로 소유한 국가를 target으로 설정하세요!**
   - 예: "경기도를 공격하라" -> [현재 영토 현황]에서 경기도의 소유자 확인 -> 해당 국가를 target으로 설정
   - 절대로 지역 소유자가 아닌 다른 국가를 target으로 지정하지 마세요!

[입력 데이터 정보]
- 내 국가: {current_stats.get('name')}
- 내 스탯: {json.dumps(current_stats_lite, ensure_ascii=False)}{my_provinces_info}
- 타국 현황: {json.dumps(other_countries_lite, ensure_ascii=False)}
- 유저 명령: "{user_input}"

[현재 영토 현황]{provinces_summary}
{war_predictions}

**[중요] 위 [전쟁 예상 결과]를 반드시 따르세요! 전쟁 시 해당 결과에 맞게 scenario와 outcome을 작성하세요.**

[출력 JSON 형식]
{{
    "scenario": "상황 요약 (2-3문장)",
    "mood": "happy/neutral/angry/depressed",
    "changes": {{
        "finance": 변화량 (현재값에 더할 값, -500 ~ +1500 범위. 긍정적 행동시 +300~+1500),
        "population": 변화량 (현재값에 더할 값, -1000 ~ +3000 범위. 긍정적 행동시 +500~+3000, 전쟁 시 음수),
        "military": 변화량 (현재값에 더할 값, -3 ~ +10 범위. 모병시 +3~+10),
        "happiness": 변화량 (현재값에 더할 값, -30 ~ +30 범위. **변화폭을 크게! 성공시 +10~+25, 실패시 -10~-25**)
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
        # public_news가 비어있거나 없으면 기본 뉴스 생성
        if not result.get('public_news') or len(result.get('public_news', [])) == 0:
            country_name = current_stats.get('name', '국가')
            result['public_news'] = [f"{country_name}이(가) 안정적으로 발전하고 있습니다."]
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
        
        # ===== 군사력 비교 결과 미리 계산 (AI 국가용) =====
        my_military = country_stats.get('military', 0)
        ai_war_predictions = ""
        predictions = []
        for country_id, country_data in all_countries.items():
            if country_data.get('name') != country_stats.get('name'):
                enemy_military = country_data.get('military', 0)
                enemy_name = country_data.get('name', country_id)
                if my_military > enemy_military:
                    result = "승리"
                elif my_military < enemy_military:
                    result = "패배"
                else:
                    result = "승리"  # 동점시 공격자 이점
                predictions.append(f"- {country_stats.get('name')}({my_military}) vs {enemy_name}({enemy_military}) → {result}")
        if predictions:
            ai_war_predictions = "\n[전쟁 예상 결과 (군사력 비교)]\n" + "\n".join(predictions)
        
        prompt = f"""
당신은 삼국시대 게임에서 "{country_stats['name']}" 국가를 운영하는 AI입니다.
현재 상황을 전략적으로 분석하고, 이번 턴의 행동과 결과를 결정하세요.

[내 국가: {country_stats['name']}]
[내 스탯] {json.dumps({k: v for k, v in country_stats.items() if k not in ['diplomacy', 'military_units', 'provinces']}, ensure_ascii=False)}{provinces_info}{diplomacy_info}{military_info}
[다른 국가들] {json.dumps(other_countries_with_info, ensure_ascii=False)}
{ai_war_predictions}

**[중요] 위 [전쟁 예상 결과]를 반드시 따르세요! 전쟁 시 해당 결과에 맞게 scenario와 outcome을 작성하세요. 패배 예상인 상대에게 전쟁을 걸지 마세요!**

### AI 전략 지침 ###
1. 자율적 의사결정:
   - **적극적인 플레이를 권장합니다. 매 턴마다 의미있는 액션을 취하세요.**
   - 상황에 따라 내정, 외교, 군사 증강, 전쟁 중 적절히 선택
   - 약한 국가가 있으면 적극적으로 도발하고 전쟁을 고려하세요
   - 외교 관계에 따라 동맹 또는 협력 결정 (배신은 15%의 확률로)
   - 군사력이 우위일 때 전쟁 적극 고려
   - **전쟁은 자주 발생해야 합니다 (30% 확률로 전쟁 시도)**

2. 수치 설정 (균형잡힌 성장):
   - 적극적인 행동(전쟁, 개혁, 건설): 중간 변화 (finance/population: -50~50, happiness: -15~15, military: -2~2)
   - 소극적인 행동(내정, 평화): 작은 변화 (finance/population: -20~30, happiness: -5~5, military: 0~1)
   - 군사 증강: military 0~2 증가, finance 적절히 감소
   - 외교: happiness, favorability 변화
   - 실패/저항: 음수 변화
   - **행복도는 크게 변동해야 합니다! 성공시 +10~+20, 실패시 -10~-20**
   - **교역/무역 활동: finance는 반드시 양수(+) (예: +20~+50). AI 국가도 교역으로 재정이 감소하는 것은 불가능합니다.**
   - **전쟁 시: 승리하면 happiness +5~+15, 패배하면 -15~-25. population은 -100~-300 감소 (전쟁의 현실적 피해)**

3. 다양한 Mood 생성 (균형있게):
   - happy (30%): 전쟁 승리, 영토 확장, 외교 성공, 경제 호황
   - neutral (35%): 평상시 운영, 소극적 외교, 정상적 발전, 내정 집중
   - angry (20%): 전쟁 패배, 침략당함, 동맹 깨짐, 경제 위기
   - depressed (15%): 큰 손실, 영토 상실, 멸망 위기

4. 액션 선택 (적극적으로):
   - add_military: **5턴에 한 번 정도**, **유닛명을 구체적으로 (철기병, 궁병, 해군 등), 수량은 3~5명 정도. unit_type은 "regular", "spy", "navy" 중 하나**
   - **전쟁을 자주 시도하세요! 30% 확률로 전쟁 선포**
   - war: **위 [전쟁 예상 결과]를 반드시 따르세요! 승리 예상인 상대에게만 전쟁을 걸고, 패배 예상인 상대에게는 전쟁을 걸지 마세요!**
     * war 액션 시 land_gained/land_lost는 1~3 영토. captured_provinces에 실제 점령한 적국 영토명 명시 필수!
   - **[매우 중요] war 액션의 target 필드는 반드시 국가명(고구려/백제/신라)만 사용! 지역명(경상북도, 함경도 등)은 절대 사용 금지!**
   - diplomacy: **50% 확률로 성공(favorability +15~25) 또는 실패(favorability -10~15), status는 반드시 한글 "동맹", "중립", "적대" 사용**
   - **[매우 중요] diplomacy 액션의 target 필드도 반드시 국가명(고구려/백제/신라)만 사용! 지역명 절대 금지!**
   - **액션을 적극적으로 사용하세요! 매 턴마다 1~2개의 액션을 취하는 것이 좋습니다.**
   - **war 액션 시 "captured_provinces": []가 되면 안됨! ** 적국의 provinces 목록에서만 선택 가능. captured_provinces 개수 = land_gained 값과 일치해야 함

5. **활발한 게임 진행 (중요!)**:
   - 적극적으로 행동하세요! 보수적인 플레이보다 역동적인 플레이가 좋습니다.
   - 인과관계의 명확성: 모든 수치 변화(changes)와 액션(actions)은 앞서 작성한 scenario와 논리적으로 일치해야 합니다.
   - 전쟁을 자주 선포하세요! AI 국가들끼리의 전쟁도 활발하게 발생해야 합니다.
   - 외교는 정확히 50% 확률로 성공/실패
   - **군사 증강은 5턴에 한 번 정도. 수량은 3~5명 정도로 제한**
   - **행복도는 크게 변동시키세요! -20 ~ +20 범위로 드라마틱하게**
   - 전쟁 casualties는 50~200명 정도
   - **중요: 이 함수는 AI가 자율적으로 운영하는 국가의 턴을 처리합니다. 유저 명령과는 무관합니다.**
   - **교역/무역 활동 시 finance는 반드시 양수(+)가 되어야 합니다.**

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
        {{"type": "war", "target": "고구려 또는 백제 또는 신라 (국가명만 허용!)", "outcome": "승리", "land_gained": 2, "land_lost": 0, "casualties": 100, "captured_provinces": ["경기도", "인천광역시"]}},
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
        # public_news가 비어있거나 없으면 기본 뉴스 생성
        if not result.get('public_news') or len(result.get('public_news', [])) == 0:
            result['public_news'] = [f"{country_stats.get('name', '국가')}이(가) 안정적으로 발전하고 있습니다."]
        if 'secret_news' not in result:
            result['secret_news'] = []
        if 'mood' not in result:
            result['mood'] = 'neutral'
        
        return result
    except Exception as e:
        print(f"AI Country Turn Error: {e}")
        import traceback
        traceback.print_exc()
        # 기본 턴 진행 (버그 #2 수정: 변화 없는 중립적 응답)
        # AI API 실패 시 게임 상태를 변경하지 않도록 모든 변화값을 0으로 설정
        return {
            "scenario": f"{country_stats['name']}이(가) 내정에 집중하며 현상 유지 중입니다.",
            "mood": "neutral",
            "public_news": [f"{country_stats['name']}이(가) 안정적으로 유지되고 있습니다."],
            "secret_news": [],
            "changes": {"finance": 0, "population": 0, "military": 0, "happiness": 0},
            "actions": []
        }