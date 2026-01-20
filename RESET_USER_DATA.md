# 사용자 데이터 초기화 가이드

게임 데이터를 초기 상태로 되돌리는 방법입니다.

## 방법 1: Python 스크립트 사용 (권장)

### 사용자 목록 보기
```bash
cd backend
python reset_user_data.py --list
```

### 특정 사용자 데이터 초기화
```bash
cd backend
python reset_user_data.py <user_id>
```

예시:
```bash
python reset_user_data.py 1
```

### 모든 사용자 데이터 초기화
```bash
cd backend
python reset_user_data.py --all
```

⚠️ **주의**: 모든 사용자 데이터를 초기화하면 복구할 수 없습니다.

## 방법 2: API 엔드포인트 사용

### curl을 사용한 호출
```bash
curl -X POST http://localhost:8000/api/reset \
  -H "Content-Type: application/json" \
  -d '{"session_token": "YOUR_SESSION_TOKEN"}'
```

### 브라우저 콘솔에서 호출
```javascript
const sessionToken = localStorage.getItem("session_token");
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

fetch(`${apiUrl}/api/reset`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ session_token: sessionToken })
})
  .then(res => res.json())
  .then(data => {
    console.log("초기화 완료:", data);
    // 페이지 새로고침
    window.location.reload();
  })
  .catch(error => console.error("오류:", error));
```

## 방법 3: 데이터베이스 직접 수정 (고급)

⚠️ **주의**: 데이터베이스를 직접 수정하는 것은 권장되지 않습니다. 백업을 먼저 수행하세요.

### SQLite 데이터베이스 위치
```
backend/game.db
```

### SQL 쿼리로 특정 사용자 데이터 삭제
```sql
-- 사용자 ID가 1인 경우
DELETE FROM commandlog WHERE countryID LIKE '%_1';
DELETE FROM newsitem WHERE countryID LIKE '%_1';
DELETE FROM secretintelligence WHERE countryID LIKE '%_1';
DELETE FROM militaryunit WHERE countryID LIKE '%_1';
DELETE FROM diplomacy WHERE sourceID LIKE '%_1';
DELETE FROM country WHERE user_id = 1;
DELETE FROM territory WHERE user_id = 1;
```

그 후 `initialize_game_data()` 함수를 호출하거나, Python 스크립트를 사용하여 초기 데이터를 생성하세요.

## 초기화되는 데이터

다음 데이터가 삭제되고 초기 상태로 재생성됩니다:

- ✅ 국가 정보 (Country) - 고구려, 백제, 신라
- ✅ 영토 소유권 (Territory)
- ✅ 명령 기록 (CommandLog)
- ✅ 뉴스 (NewsItem)
- ✅ 비밀 정보 (SecretIntelligence)
- ✅ 군사 유닛 (MilitaryUnit)
- ✅ 외교 관계 (Diplomacy)

## 초기화되지 않는 데이터

- ❌ 사용자 계정 정보 (User) - 이메일, 이름 등은 유지됩니다
- ❌ 세션 토큰 - 로그인 상태는 유지됩니다

## 문제 해결

### "사용자를 찾을 수 없습니다" 오류
- 사용자 ID가 올바른지 확인하세요
- `--list` 옵션으로 사용자 목록을 확인하세요

### 권한 오류
- 데이터베이스 파일(`backend/game.db`)에 쓰기 권한이 있는지 확인하세요
- macOS/Linux: `chmod 666 backend/game.db`

### 데이터베이스 잠금 오류
- 다른 프로세스가 데이터베이스를 사용 중일 수 있습니다
- 백엔드 서버를 중지하고 다시 시도하세요
