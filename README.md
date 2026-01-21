# 삼한일류(三韓一流): 군주의 시간

> **"고구려, 백제, 신라의 군주가 되어 AI가 빚어내는 역사의 흐름을 주도하라!"**

'삼한일류(三韓一流)'는 Gemma 기반 생성형 AI를 탑재한 웹 기반 국가 경영 시뮬레이션 게임입니다. 플레이어는 삼국의 군주 중 한 명을 선택하여 자연어 명령을 통해 국가를 운영하고, 실시간으로 변화하는 시나리오 속에서 한반도 통일의 대업을 완수해야 합니다.

---

## 🚀 프로젝트 개요

* **플랫폼**: 웹 기반(Web)
* **핵심 기술**: Next.js, FastAPI, Google Gemini(Gemma-3-4b-it)
* **핵심 컨셉**: 생성형 AI를 통한 유동적 시나리오 및 실시간 역사 재구성 시뮬레이션

---

## ✨ 핵심 기능 (Key Features)

### 1. 지능형 군주 명령 시스템 (AI Command System)

* **자연어 해석**: "무역로를 개척하라", "백제를 공격하라"와 같은 자연어 명령을 AI가 해석하여 게임 엔진에 반영합니다.
* **동적 스토리텔링**: 유저의 선택에 따라 AI가 뉴스 보도, 비밀 첩보, 상황 시나리오를 실시간으로 생성합니다.

### 2. 전략적 국가 경영 (Strategic Gameplay)

* **4대 핵심 스탯**: 재정, 인구, 행복도, 군사력을 관리합니다. 각 국가는 고유한 초기 특성을 가집니다.
* **AI 국가 자동 행동**: 플레이어 외의 국가들도 독립적인 AI 로직에 따라 외교, 군사 활동을 전개합니다.
* **영토 점령 시스템**: 한반도 지도를 시각화하여 지역별 소유권을 관리하며, 전투 승리를 통해 실시간으로 영토를 확장합니다.

### 3. 몰입형 비주얼 및 시스템

* **3D 캐릭터 감정 표현**: 게임 상황(승리, 패배, 위기 등)에 따라 캐릭터의 감정(Happy, Neutral, Angry, Depressed)이 실시간으로 변화합니다.
* **이중 인증 시스템**: Google OAuth 및 JWT 기반의 안전한 보안 인증을 지원합니다.
* **국가별 고유 엔딩**: 통일 달성 시 선택한 국가에 따른 시네마틱 엔딩 영상과 메시지가 제공됩니다.

---

## 🛠 기술 스택 (Tech Stack)

### Frontend

* **Framework**: Next.js (TypeScript)
* **Styling**: Tailwind CSS
* **State Management**: LocalStorage 기반 세션 유지

### Backend

* **Framework**: FastAPI
* **Database**: SQLite (SQLModel ORM)
* **Authentication**: PyJWT, Google OAuth 2.0

### AI Model

* **Engine**: Google Gemini API (`gemma-3-4b-it` 모델 최적화)

---

## 📂 프로젝트 구조 (Project Structure)

### Backend (`/backend`)

* `main.py`: API 엔드포인트 및 게임 턴 처리 핵심 로직
* `models.py`: 데이터베이스 스키마(Country, Territory, User 등) 정의
* `ai_service.py`: Gemini API 연동 및 프롬프트 엔지니어링
* `database.py`: DB 연결 및 마이그레이션 관리

### Frontend (`/frontend`)

* `/app`: 페이지 라우팅 및 레이아웃
* `/components`: 3D 캐릭터 모델 및 한국 지도 시각화 컴포넌트

---

## ⚙️ 실행 방법 (Installation)

### Backend 설정

```bash
cd backend
pip install -r requirements.txt
# .env 파일에 GEMINI_API_KEY 설정 필요
uvicorn main:app --reload

```

### Frontend 설정

```bash
cd frontend
npm install
npm run dev

```

---

## 🧑🏻‍💻 개발 팀 (Our Team)

* **박성재 (Park Sungjae)**
  * KAIST 전산학부 (School of Computing)
  * [GitHub](https://github.com/sungjaep11) | sungjaep@kaist.ac.kr


* **박찬우 (Park Chanwoo)**
  * 고려대학교 컴퓨터학과 (Computer Science and Engineering)
  * [GitHub](https://github.com/onff02) | yetpi0413@korea.ac.kr



---

## 📜 라이선스

본 프로젝트는 교육 및 연구 목적으로 제작되었습니다. 관련 자산의 저작권은 개발 팀에 있습니다.
