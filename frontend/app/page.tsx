"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // For now, just validate that fields are filled
    if (!username.trim() || !password.trim()) {
      setError("사용자명과 비밀번호를 입력해주세요.");
      setIsLoading(false);
      return;
    }

    // TODO: Add actual authentication logic here
    // For now, redirect to tutorial page
    router.push("/tutorial");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0D0D0D] korean-pattern">
      <div className="w-full max-w-md px-6">
        <div className="glass-panel rounded-lg p-8 animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#F5F5DC] mb-2">삼국시대 시뮬레이터</h1>
            <p className="text-[#A89F91] text-sm">로그인하여 게임을 시작하세요</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-[#F87171]/20 border border-[#F87171]/50 rounded-lg">
              <p className="text-[#F87171] text-sm text-center">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
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
                autoComplete="off"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="사용자명을 입력하세요"
                disabled={isLoading}
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
                autoComplete="off"
                data-lpignore="true"
                data-form-type="other"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="비밀번호를 입력하세요"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#C9A227] hover:bg-[#D4AF37] text-[#0D0D0D] font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-[#6B6B6B] text-sm">
              계정이 없으신가요?{" "}
              <button
                onClick={() => {
                  // TODO: Navigate to register page
                  console.log("Register clicked");
                }}
                className="text-[#C9A227] hover:text-[#D4AF37] transition-colors"
              >
                회원가입
              </button>
            </p>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="mt-8 text-center">
          <div className="flex justify-center gap-4 text-2xl opacity-30">
            <span>🏔️</span>
            <span>🌊</span>
            <span>👑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
