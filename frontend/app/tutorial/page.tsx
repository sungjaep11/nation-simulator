"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TutorialStep {
  title: string;
  content: string;
  icon: string;
  highlight?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "혼란의 시대, 새로운 희망",
    content: "고조선이 무너지고 한반도는 혼란의 시대를 맞이했습니다. 수많은 부족들이 각축을 벌이는 가운데, 세 명의 위대한 지도자가 나타나 새로운 시대의 서막을 열었습니다.\n\n🌅 고구려의 주몽\n압록강 유역에서 고구려를 건국한 주몽은 동명성왕이라 불리며, 강력한 군사력과 확고한 의지로 북방의 패자로 자리매김했습니다. 부여에서 탈출하여 독자적인 길을 개척한 그의 용맹함은 전설이 되었고, 철기병과 산성 전술로 무적의 방어력을 구축했습니다.\n\n🌊 백제의 온조\n위례성에서 백제를 세운 온조는 해상 무역의 길을 열었습니다. 형 비류와 함께 남하하여 한강 유역에 터전을 마련한 그는 문화와 예술을 중시하며, 중국과 일본과의 활발한 교류를 통해 부국강병의 기반을 닦았습니다.\n\n👑 신라의 박혁거세\n경주에서 신라를 건국한 박혁거세는 알에서 태어난 신비로운 출생 설화를 가진 인물입니다. 육부 촌장들의 추대를 받아 왕위에 오른 그는 화랑도의 정신을 바탕으로 백성들의 단결력을 강화했으며, 금관가야를 흡수하며 동남부의 강국으로 성장시켰습니다.\n\n⚔️ 천하통일의 꿈\n이제 서기 4세기, 세 나라는 각각의 강점을 바탕으로 한반도 패권을 두고 치열한 경쟁을 벌이고 있습니다. 당신은 이 중 한 나라의 군주가 되어 외교와 전쟁, 내정을 통해 천하 통일의 위업을 달성해야 합니다.",
    icon: "📜",
    highlight: "역사의 시작",
  },
  {
    title: "고구려 - 북방의 맹주",
    content: "강력한 군사력과 광활한 영토를 자랑하는 고구려는 철기병과 산성 전술로 유명합니다.\n\n초기 설정:\n• 재정: 15,000금\n• 인구: 80,000명\n• 군사력: 15,000명\n• 특징: 북방 유목민족의 위협에 노출되어 있으나, 강력한 방어력과 공격력을 보유",
    icon: "🏔️",
    highlight: "강력한 군사력",
  },
  {
    title: "백제 - 해상 무역의 강국",
    content: "해상 무역과 문화 예술이 발달한 백제는 일본, 중국과의 교류가 활발합니다.\n\n초기 설정:\n• 재정: 18,000금\n• 인구: 60,000명\n• 군사력: 10,000명\n• 특징: 가장 많은 재정을 보유하고 있으며, 수군이 발달하여 해상 무역에 유리",
    icon: "🌊",
    highlight: "풍부한 재정",
  },
  {
    title: "신라 - 화랑도의 정신",
    content: "화랑도의 충성과 백성들의 단결력으로 무장한 신라는 금관가야를 흡수하며 성장 중입니다.\n\n초기 설정:\n• 재정: 12,000금\n• 인구: 40,000명\n• 군사력: 12,000명\n• 특징: 인구는 적지만 높은 단결력과 특수 부대(화랑도)로 보완",
    icon: "👑",
    highlight: "높은 단결력",
  },
  {
    title: "게임의 핵심 요소",
    content: "당신은 선택한 국가의 군주가 되어 다음 요소들을 관리해야 합니다:\n\n💰 재정 (Gold)\n국가 운영에 필요한 자금입니다. 세금, 무역, 전쟁 등으로 변동됩니다.\n\n👥 인구 (Population)\n국가의 인력 자원입니다. 인구가 많을수록 세입이 증가하고 군사력도 강화됩니다.\n\n😊 행복도 (Happiness)\n백성들의 만족도입니다. 높을수록 국가 안정성이 향상되고 생산성이 증가합니다.\n\n⚔️ 군사력 (Military)\n국가의 방어 및 공격 능력입니다. 외적의 침입을 막고 영토를 확장하는 핵심 요소입니다.",
    icon: "📊",
    highlight: "국가 관리",
  },
  {
    title: "게임 진행 방법",
    content: "게임은 턴제로 진행됩니다:\n\n1️⃣ 국가 선택\n고구려, 백제, 신라 중 하나를 선택하세요.\n\n2️⃣ 명령 입력\n하단의 입력창에 자연어로 명령을 내리세요.\n예: \"북방 경비를 강화하라\", \"백제와 동맹을 맺어라\"\n\n3️⃣ 결과 확인\n명령의 결과로 국가 수치가 변동하고, 뉴스와 이벤트가 발생합니다.\n\n4️⃣ 전략 수립\n외교와 전쟁을 통해 천하 통일의 위업을 달성하세요!",
    icon: "🎮",
    highlight: "플레이 방법",
  },
];

export default function TutorialPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // 튜토리얼 완료
      setIsExiting(true);
      setTimeout(() => {
        router.push("/home");
      }, 500);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setIsExiting(true);
    setTimeout(() => {
      router.push("/home");
    }, 500);
  };

  const currentStepData = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <div 
      className={`h-screen bg-[#0D0D0D] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
      style={{
        backgroundImage: 'url(/assets/images/temple.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-[#0D0D0D]/40"></div>
      
      <div className="relative z-10 w-full max-w-6xl px-6 py-4 h-full flex flex-col">
        <div 
          className="rounded-2xl p-6 md:p-8 animate-fade-in-up flex flex-col h-full max-h-[calc(100vh-2rem)] backdrop-blur-xl border border-white/20 shadow-2xl"
          style={{ 
            background: 'rgba(26, 26, 26, 0.25)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 0 rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Progress Bar */}
          <div className="mb-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#A89F91]">
                {currentStep + 1} / {tutorialSteps.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-sm text-[#6B6B6B] hover:text-[#A89F91] transition-colors"
              >
                건너뛰기
              </button>
            </div>
            <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#C9A227] to-[#D4AF37] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Icon */}
            <div className="text-center mb-3 flex-shrink-0">
              <div className="inline-block text-5xl md:text-6xl animate-scale-in">
                {currentStepData.icon}
              </div>
            </div>

            {/* Highlight Badge */}
            {currentStepData.highlight && (
              <div className="text-center mb-3 flex-shrink-0">
                <span className="inline-block px-4 py-1 bg-[#C9A227]/20 border border-[#C9A227]/50 rounded-full text-sm text-[#C9A227] font-medium">
                  {currentStepData.highlight}
                </span>
              </div>
            )}

            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-bold text-[#C9A227] font-serif text-center mb-4 animate-fade-in-up flex-shrink-0">
              {currentStepData.title}
            </h2>

            {/* Content - Scrollable */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="text-[#F5F5DC] text-sm md:text-base leading-relaxed whitespace-pre-line animate-fade-in-up h-full overflow-y-auto pr-2" style={{ animationDelay: '100ms' }}>
                {currentStepData.content.split('\n').map((line, index) => {
                  // Bold formatting for labels and character names
                  if (line.match(/^[•💰👥😊⚔️🌅🌊👑]/) || line.match(/^\d+️⃣/) || line.match(/^[고구려|백제|신라].*[주몽|온조|박혁거세]/)) {
                    return (
                      <p key={index} className="mb-3 font-semibold text-[#C9A227]">
                        {line}
                      </p>
                    );
                  }
                  // Empty lines
                  if (line.trim() === '') {
                    return <br key={index} />;
                  }
                  return (
                    <p key={index} className="mb-3 text-[#F5F5DC]">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#C9A227]/20 flex-shrink-0">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`
                  px-6 py-3 rounded-lg font-medium transition-all duration-200
                  ${
                    currentStep === 0
                      ? "bg-[#1a1a1a] text-[#6B6B6B] cursor-not-allowed"
                      : "bg-[#252525] text-[#F5F5DC] hover:bg-[#333] hover:text-[#C9A227]"
                  }
                `}
              >
                ← 이전
              </button>

              <div className="flex gap-2">
                {tutorialSteps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={`
                      w-2 h-2 rounded-full transition-all duration-200
                      ${
                        index === currentStep
                          ? "bg-[#C9A227] w-8"
                          : "bg-[#6B6B6B] hover:bg-[#A89F91]"
                      }
                    `}
                    aria-label={`Step ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="px-8 py-3 bg-[#C9A227] hover:bg-[#D4AF37] text-[#0D0D0D] font-bold rounded-lg transition-all duration-200 animate-pulse-glow"
              >
                {currentStep === tutorialSteps.length - 1 ? "시작하기 →" : "다음 →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
