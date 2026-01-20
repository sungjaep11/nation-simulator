"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 입력 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("모든 필드를 입력해주세요.");
      setIsLoading(false);
      return;
    }

    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요. (예: example@email.com)");
      setIsLoading(false);
      return;
    }

    if (username.trim().length < 2) {
      setError("사용자명은 최소 2자 이상이어야 합니다.");
      setIsLoading(false);
      return;
    }

    if (username.trim().length > 20) {
      setError("사용자명은 20자 이하여야 합니다.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      setIsLoading(false);
      return;
    }

    if (password.length > 72) {
      setError("비밀번호는 최대 72자까지 가능합니다.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setIsLoading(false);
      return;
    }

    try {
      // 백엔드에 회원가입 요청
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const registerResponse = await fetch(`${apiUrl}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          username: username.trim(),
          password: password,
        }),
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || "회원가입에 실패했습니다.");
      }

      const registerData = await registerResponse.json();
      const sessionToken = registerData.session_token;
      const user = registerData.user;

      // 세션 토큰 및 사용자 정보를 localStorage에 저장
      localStorage.setItem("session_token", sessionToken);
      localStorage.setItem("username", user.name);
      localStorage.setItem("email", user.email);

      // 게임 데이터 초기화 후 국가 선택 페이지로 이동
      router.push("/selection");
    } catch (error: any) {
      console.error("회원가입 중 오류:", error);
      setError(error.message || "회원가입 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        backgroundImage: 'url(/login/temple.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-[#0D0D0D]/60"></div>
      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="glass-panel rounded-lg p-8 animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative w-35 h-35">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-[#F5F5DC] mb-2 whitespace-nowrap">
              <span>삼한일류(三韓一流):</span>
              <span className="text-2xl"> 군주의 시간</span>
            </h1>
            <p className="text-[#A89F91] text-sm">새 계정을 만들어 게임을 시작하세요</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-[#F87171]/20 border border-[#F87171]/50 rounded-lg">
              <p className="text-[#F87171] text-sm text-center">{error}</p>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#F5F5DC] mb-2"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="이메일을 입력하세요"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[#F5F5DC] mb-2"
              >
                사용자명
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="사용자명을 입력하세요 (2-20자)"
                disabled={isLoading}
                maxLength={20}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#F5F5DC] mb-2"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="비밀번호를 입력하세요 (최소 6자)"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-[#F5F5DC] mb-2"
              >
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="비밀번호를 다시 입력하세요"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#C9A227] hover:bg-[#D4AF37] text-[#0D0D0D] font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow"
            >
              {isLoading ? "회원가입 중..." : "회원가입"}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-[#6B6B6B] text-sm">
              이미 계정이 있으신가요?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-[#C9A227] hover:text-[#D4AF37] transition-colors"
              >
                로그인
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
