import os
import json
from typing import Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Store API key globally
_api_key = None

def _get_api_key():
    global _api_key
    if _api_key is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            raise ValueError("GEMINI_API_KEY not configured in .env file")
        _api_key = api_key
        # Configure genai (using type: ignore for type checker)
        genai.configure(api_key=api_key)  # type: ignore
    return _api_key

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
        _get_api_key()  # Ensure API key is configured
        
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
당신은 삼국시대 게임의 시스템 AI입니다. 유저의 명령을 분석해 다음을 JSON으로만 응답하세요.
[현재 국가 스탯] {json.dumps({k: v for k, v in current_stats.items() if k not in ['diplomacy', 'military_units']}, ensure_ascii=False)}{diplomacy_info}{military_info}{other_countries_info}
[유저 명령] "{user_input}"

뉴스 분류:
- public_news: 모든 국가에 공개될 정보
- secret_news: 공개되지 않을 민감한 정보 (군사 계획, 암살 등)

액션 분류:
- add_military: {{"type": "add_military", "name": "무기명", "count": 수량, "icon": "아이콘", "unit_type": "regular/spy/assassin"}}
  - unit_type이 "spy"이면 스파이로 분류됨
- diplomacy: {{"type": "diplomacy", "target": "국가명", "status": "동맹/중립/적대", "favorability": -100~100}}
- secret_operation: {{"type": "secret_operation", "title": "작전명", "content": "내용", "operation_type": "군사_계획/외교_음모/암살", "shared_with": ["공유할_국가"], "target_country": "목표국가"}}

응답 JSON 형식:
{{
    "scenario": "이번 턴의 상황 전개 (한국어, 3-4문장, 공개 정보만)",
    "mood": "happy/neutral/angry",
    "public_news": ["공개 뉴스 1", "공개 뉴스 2"],
    "secret_news": ["비밀 뉴스 1 - 공개되지 않음"],
    "changes": {{"finance": 숫자, "population": 숫자, "military": 숫자, "happiness": 숫자}},
    "actions": [
        {{"type": "add_military", "name": "철기병", "count": 100, "icon": "🐎", "unit_type": "regular"}},
        {{"type": "secret_operation", "title": "비밀 작전", "content": "내용", "operation_type": "군사_계획", "shared_with": [], "target_country": "백제"}}
    ]
}}

분위기(mood) 판단 기준:
- happy: 긍정적, 승리, 번영, 성공적인 결과
- neutral: 평범한 상황, 일상적인 발전
- angry: 부정적, 패배, 위기, 좌절

주의:
- public_news만 사용자에게 공개됨
- secret_news는 DB에만 저장되고 공개되지 않음
- secret_operation은 비밀 정보로 저장됨
        """
        
        # 텍스트 생성 요청
        model = genai.GenerativeModel('gemini-2.5-flash')  # type: ignore
        response = model.generate_content(prompt)
        
        # JSON 문자열 추출 및 파싱
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
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
        _get_api_key()  # Ensure API key is configured
        
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
현재 상황을 분석하고 이번 턴의 행동을 결정하세요.

[내 국가 스탯] {json.dumps({k: v for k, v in country_stats.items() if k not in ['diplomacy', 'military_units']}, ensure_ascii=False)}{diplomacy_info}{military_info}
[다른 국가들] {json.dumps(other_countries_with_info, ensure_ascii=False)}

국가의 특성과 현재 상황에 맞는 전략적 행동을 선택하세요:
- 경제가 부족하면 재정 확보
- 군사력이 약하면 군비 증강
- 외교 관계 개선 또는 악화
- 인구 증대 정책
- 필요시 비밀 작전 (암살, 첩보, 군사 계획 등)

뉴스 분류:
- public_news: 다른 국가에 공개될 정보
- secret_news: 공개되지 않을 민감한 정보 (군사 계획, 암살 등)

응답 JSON 형식:
{{
    "scenario": "이번 턴에 국가가 취한 행동과 결과 (3-4문장, 공개 정보만)",
    "mood": "happy/neutral/angry",
    "public_news": ["뉴스 1", "뉴스 2"],
    "secret_news": ["비밀 뉴스 - 공개 안 됨"],
    "changes": {{"finance": 숫자, "population": 숫자, "military": 숫자, "happiness": 숫자}},
    "actions": [
        {{"type": "add_military", "name": "군대명", "count": 수량, "icon": "아이콘", "unit_type": "regular/spy"}},
        {{"type": "diplomacy", "target": "국가명", "status": "동맹/중립/적대", "favorability": -100~100}},
        {{"type": "secret_operation", "title": "암살 계획", "content": "내용", "operation_type": "암살", "shared_with": [], "target_country": "목표국가"}}
    ]
}}

분위기(mood) 판단 기준:
- happy: 긍정적, 성공적 결과, 번영
- neutral: 평범한 상황, 일상적 발전
- angry: 부정적, 패배, 위기
        """
        
        # 텍스트 생성 요청
        model = genai.GenerativeModel('gemini-2.5-flash')  # type: ignore
        response = model.generate_content(prompt)
        
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
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