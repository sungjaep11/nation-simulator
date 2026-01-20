"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

declare global {
  interface Window {
    google: any;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const handleGoogleSignIn = useCallback(async (response: any) => {
    setError(null);
    setIsLoading(true);

    try {
      // 백엔드에 Google JWT 토큰 전송하여 검증 및 사용자 정보 가져오기
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const requestUrl = `${apiUrl}/api/auth/google`;
      
      console.log("Calling backend API:", requestUrl);
      
      const authResponse = await fetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });

      console.log("Response status:", authResponse.status);

      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({}));
        console.error("Backend error:", errorData);
        throw new Error(errorData.detail || `Google 로그인에 실패했습니다. (Status: ${authResponse.status})`);
      }

      const authData = await authResponse.json();
      const user = authData.user;
      const sessionToken = authData.session_token;
      const isNewUser = authData.is_new_user || false;

      // 세션 토큰 및 사용자 정보를 localStorage에 저장
      localStorage.setItem("session_token", sessionToken);
      localStorage.setItem("email", user.email);
      if (user.picture) {
        localStorage.setItem("picture", user.picture);
      }
      
      // 새 사용자인 경우 사용자명 생성 페이지로, 기존 사용자는 국가 선택 페이지로
      if (isNewUser) {
        router.push("/create-username");
      } else {
        localStorage.setItem("username", user.name);
        router.push("/selection");
      }
    } catch (error: any) {
      console.error("Google 로그인 중 오류:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setError(error.message || "Google 로그인 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
          callback: handleGoogleSignIn,
        });
        
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            width: "100%",
          }
        );
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [handleGoogleSignIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      setIsLoading(false);
      return;
    }
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요. (예: example@email.com)");
      setIsLoading(false);
      return;
    }

    try {
      // 백엔드에 로그인 요청
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const loginResponse = await fetch(`${apiUrl}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({}));
        const errorMessage = errorData.detail || "로그인에 실패했습니다.";
        
        // 401 오류(인증 실패)는 예상된 오류이므로 콘솔 에러를 출력하지 않음
        if (loginResponse.status === 401) {
          setError(errorMessage);
          setIsLoading(false);
          return;
        }
        
        // 그 외의 오류는 에러로 처리
        throw new Error(errorMessage);
      }

      const loginData = await loginResponse.json();
      const sessionToken = loginData.session_token;
      const user = loginData.user;

      // 세션 토큰 및 사용자 정보를 localStorage에 저장
      localStorage.setItem("session_token", sessionToken);
      localStorage.setItem("username", user.name);
      localStorage.setItem("email", user.email);
      if (user.picture) {
        localStorage.setItem("picture", user.picture);
      }
      
      // 국가 선택 페이지로 이동
      router.push("/selection");
    } catch (error: any) {
      // 예상치 못한 오류만 콘솔에 출력
      console.error("로그인 중 오류:", error);
      setError(error.message || "로그인 중 오류가 발생했습니다. 백엔드 서버를 확인하세요.");
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="h-screen w-full flex items-center justify-center overflow-y-auto py-4"
      style={{
        backgroundImage: 'url(/login/temple.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-[#0D0D0D]/60"></div>
      <div className="relative z-10 w-full max-w-lg px-6 py-4">
        <div className="glass-panel rounded-lg p-6 animate-fade-in-up">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="flex justify-center mb-2">
              <div className="relative w-24 h-24">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#F5F5DC] mb-1 whitespace-nowrap">
              <span>삼한일류(三韓一流):</span>
              <span className="text-xl"> 군주의 시간</span>
            </h1>
            <p className="text-[#A89F91] text-xs">로그인하여 게임을 시작하세요</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-2 bg-[#F87171]/20 border border-[#F87171]/50 rounded-lg">
              <p className="text-[#F87171] text-xs text-center">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#F5F5DC] mb-1"
              >
                이메일
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="이메일을 입력하세요"
                disabled={isLoading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#F5F5DC] mb-1"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0D0D0D] border border-[#C9A227]/30 rounded-lg text-[#F5F5DC] placeholder-[#6B6B6B] focus:outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/20 transition-all"
                placeholder="비밀번호를 입력하세요"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#C9A227] hover:bg-[#D4AF37] text-[#0D0D0D] font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed animate-pulse-glow text-sm"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#C9A227]/30"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[#0D0D0D] text-[#A89F91]">또는</span>
            </div>
          </div>

          {/* Google Login Button */}
          <div className="w-full mb-3">
            <div ref={googleButtonRef} className="w-full flex justify-center"></div>
          </div>

          {/* Footer Links */}
          <div className="mt-3 text-center">
            <p className="text-[#6B6B6B] text-xs">
              계정이 없으신가요?{" "}
              <button
                onClick={() => router.push("/register")}
                className="text-[#C9A227] hover:text-[#D4AF37] transition-colors font-medium"
              >
                회원가입
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
