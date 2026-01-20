"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CreateUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 세션 토큰이 없으면 로그인 페이지로 리다이렉트
    const sessionToken = localStorage.getItem("session_token");
    if (!sessionToken) {
      router.push("/login");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 사용자명 검증
    if (!username.trim()) {
      setError("사용자명을 입력해주세요.");
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

    try {
      // 세션 토큰 가져오기
      const sessionToken = localStorage.getItem("session_token");
      if (!sessionToken) {
        router.push("/login");
        return;
      }

      // 백엔드에 사용자명 전송 및 게임 초기화
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const usernameResponse = await fetch(`${apiUrl}/api/user/username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: username.trim(),
          session_token: sessionToken
        }),
      });

      if (!usernameResponse.ok) {
        const errorData = await usernameResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || "사용자명 설정에 실패했습니다.");
      }

      // 사용자명을 localStorage에 저장
      localStorage.setItem("username", username.trim());

      // 국가 선택 페이지로 이동
      router.push("/selection");
    } catch (error: any) {
      console.error("사용자명 생성 중 오류:", error);
      setError(error.message || "사용자명 설정 중 오류가 발생했습니다. 백엔드 서버를 확인하세요.");
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
            <p className="text-[#A89F91] text-sm">게임에서 사용할 사용자명을 입력하세요</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-[#F87171]/20 border border-[#F87171]/50 rounded-lg">
              <p className="text-[#F87171] text-sm text-center">{error}</p>
            </div>
          )}

          {/* Username Form */}
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
                autoFocus
              />
              <p className="mt-2 text-xs text-[#A89F91]">
                게임에서 표시될 이름입니다. 나중에 변경할 수 있습니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim()}
              className="w-full py-3 bg-[#C9A227] hover:bg-[#D4AF37] text-[#0D0D0D] font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow"
            >
              {isLoading ? "처리 중..." : "시작하기"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
