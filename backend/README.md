# Nation Simulator Backend API

## 주요 기능

### 1. AI 액션 분류 시스템 ✅
사용자의 입력을 분석하여 자동으로 액션 타입을 분류하고 처리합니다:

- **무기/군대 추가**: 사용자가 특정 무기나 군대를 요청하면 자동으로 `MilitaryUnit` 테이블에 저장
- **외교 관계 변경**: 다른 국가와의 관계 변화를 `Diplomacy` 테이블에 저장
- **스탯 변화**: 재정, 인구, 군사력, 행복도 자동 업데이트

#### 예시
```
사용자 입력: "철기병 100명을 모집하고 백제와 동맹을 맺어"

AI 응답:
{
  "scenario": "철기병 100명을 성공적으로 모집했습니다...",
  "news": ["철기병 100명 모집 완료", "백제와 동맹 체결"],
  "changes": {"finance": -500, "military": 2, "happiness": 5},
  "actions": [
    {"type": "add_military", "name": "철기병", "count": 100, "icon": "🐎"},
    {"type": "diplomacy", "target": "백제", "status": "동맹", "favorability": 30}
  ]
}
```

### 2. AI 국가 자동 턴 진행 ✅
유저가 턴을 진행할 때마다 다른 두 국가도 자동으로 AI에 의해 운영됩니다:

- 각 AI 국가는 현재 상황을 분석하여 전략적 행동 선택
- 경제, 군사, 외교 등 독립적으로 발전
- 모든 국가의 뉴스와 상태 변화가 DB에 저장

### 3. 데이터베이스 구조

#### Country (국가)
- `id`: 국가 고유 ID (goguryeo, baekje, silla)
- `name`: 국가명
- `finance`, `population`, `military`, `happiness`: 주요 스탯
- `totalScore`: 자동 계산되는 종합 점수
- `turn`: 현재 턴 수

#### CommandLog (명령 기록)
- 유저의 모든 명령과 AI 응답 저장

#### NewsItem (뉴스)
- 각 국가의 턴마다 발생한 뉴스 저장
- type: "general" (유저 액션), "ai_turn" (AI 국가 턴)

#### MilitaryUnit (군대/무기)
- 각 국가의 군대 구성 저장
- 동적으로 추가/수정 가능

#### Diplomacy (외교 관계)
- 국가 간 외교 관계와 호감도 저장
- status: "동맹", "중립", "적대"
- favorability: -100 ~ 100

## API 엔드포인트

### 게임 진행
- `POST /api/action`: 게임 턴 진행
  - 유저 국가 업데이트
  - AI 국가들 자동 업데이트
  - 액션 분류 및 처리
  - 반환: 유저 국가 + 다른 국가들의 뉴스

### 조회
- `GET /api/countries`: 모든 국가 조회
- `GET /api/country/{country_id}`: 특정 국가 정보
- `GET /api/country/{country_id}/news`: 국가 뉴스
- `GET /api/country/{country_id}/military`: 군대 구성
- `GET /api/country/{country_id}/diplomacy`: 외교 관계
- `GET /api/country/{country_id}/logs`: 명령 기록

### 수동 업데이트
- `POST /api/country/{country_id}/diplomacy`: 외교 관계 업데이트
- `POST /api/country/{country_id}/military`: 군대 유닛 추가

## TotalScore 계산 공식

```python
totalScore = (finance / 100) + (population / 1000) + (military * 100) + (happiness * 10)
```

**예시 (고구려 초기값)**:
- 재정 15,000 → 150점
- 인구 80,000 → 80점
- 군사력 15 → 1,500점
- 행복도 50 → 500점
- **총점: 2,230점**

## 실행 방법

```bash
# 의존성 설치
pip install -r requirements.txt

# .env 파일 설정
GEMINI_API_KEY=your_actual_api_key
GOOGLE_CLIENT_ID=your_google_client_id

# CORS 설정 (선택사항)
# 개발 환경에서 모든 origin 허용하려면:
ALLOW_ALL_ORIGINS=true

# 또는 특정 origins만 허용하려면 (쉼표로 구분):
CORS_ORIGINS=http://localhost:3000,http://192.168.1.100:3000,http://your-domain.com

# 서버 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 환경 변수 설정

### 필수 환경 변수
- `GEMINI_API_KEY`: Google Gemini API 키
- `GOOGLE_CLIENT_ID`: Google OAuth 클라이언트 ID (Google 로그인 사용 시)

### 선택적 환경 변수
- `ALLOW_ALL_ORIGINS`: `true`로 설정하면 모든 origin에서의 요청을 허용 (개발 환경용)
- `CORS_ORIGINS`: 허용할 origin 목록 (쉼표로 구분), 예: `http://localhost:3000,http://192.168.1.100:3000`

### CORS 문제 해결
다른 컴퓨터에서 접속이 안 되는 경우:
1. `ALLOW_ALL_ORIGINS=true`를 `.env` 파일에 추가 (개발 환경에서만 사용)
2. 또는 `CORS_ORIGINS`에 해당 컴퓨터의 IP 주소와 포트를 추가

## 변경사항 요약

1. ✅ **AI 액션 분류**: 사용자 입력을 분석하여 무기 추가, 외교 관계 등을 자동 처리
2. ✅ **다른 국가 자동 진행**: 턴마다 AI가 다른 두 국가를 자동으로 운영
3. ✅ **DB 저장**: 무기, 외교, 뉴스 등 모든 정보가 DB에 저장되어 웹에서 조회 가능
4. ✅ **totalScore 자동 계산**: 매 턴마다 국가의 종합 점수 자동 계산
