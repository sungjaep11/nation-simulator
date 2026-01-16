from google import genai

# API 키로 클라이언트 연결
client = genai.Client(api_key="AIzaSyBYFQsh3pXq7RTh8va4YN7S1DcUNgRTl_0")

# 모델 호출 테스트
response = client.models.generate_content(
    model="gemini-3.0-flash",
    contents="Gemini API 연결 성공했는지 확인해줘."
)

print(response.text)