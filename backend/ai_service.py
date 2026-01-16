from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# Llama-3.2-3B-Instruct 모델 로드
model_name = "meta-llama/Llama-3.2-3B-Instruct"

print(f"Loading {model_name}...")
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto",
    low_cpu_mem_usage=True
)

print(f"Model loaded successfully!")

# 모델 호출 테스트
def generate_response(prompt: str, max_length: int = 512) -> str:
    """
    Llama-3.2-3B-Instruct 모델을 사용하여 응답 생성
    
    Args:
        prompt: 입력 프롬프트
        max_length: 최대 생성 길이
    
    Returns:
        생성된 응답 텍스트
    """
    # Llama 3.2의 채팅 템플릿 형식 사용
    messages = [
        {"role": "user", "content": prompt}
    ]
    
    # 토큰화
    input_ids = tokenizer.apply_chat_template(
        messages,
        add_generation_prompt=True,
        return_tensors="pt"
    ).to(model.device)
    
    # 생성
    with torch.no_grad():
        outputs = model.generate(
            input_ids,
            max_new_tokens=max_length,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    # 디코딩
    response = tokenizer.decode(outputs[0][input_ids.shape[1]:], skip_special_tokens=True)
    return response

# 테스트 실행
if __name__ == "__main__":
    test_prompt = "안녕하세요! Llama-3.2-3B-Instruct 모델이 정상적으로 작동하는지 확인해주세요."
    response = generate_response(test_prompt)
    print(f"\n프롬프트: {test_prompt}")
    print(f"\n응답: {response}")
