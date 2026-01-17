"use client";

import { useState, useEffect, memo, useMemo, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// 북한 지역명 한글 매핑
const northKoreaNameMap: Record<string, string> = {
  "Chagang-do": "자강도",
  "Hamgyŏng-bukto": "함경북도",
  "Hamgyŏng-namdo": "함경남도",
  "Hwanghae-bukto": "황해북도",
  "Hwanghae-namdo": "황해남도",
  "Kaesŏng": "개성특별시",
  "Kangwŏn-do": "강원도",
  "Kumgangsan": "금강산",
  "Namp'o": "남포특별시",
  "P'yŏngan-bukto": "평안북도",
  "P'yŏngan-namdo": "평안남도",
  "P'yŏngyang": "평양직할시",
  "Rasŏn": "라선특별시",
  "Ryanggang": "량강도",
  "Sinŭiju": "신의주시",
};

// 시도별 삼국 영토 매핑
const provinceToKingdom: Record<string, "goguryeo" | "baekje" | "silla" | "neutral"> = {
  // 고구려 영토 (북한 지역)
  "자강도": "goguryeo",
  "함경북도": "goguryeo",
  "함경남도": "goguryeo",
  "황해북도": "goguryeo",
  "황해남도": "goguryeo",
  "개성특별시": "goguryeo",
  "강원도": "goguryeo",
  "금강산": "goguryeo",
  "남포특별시": "goguryeo",
  "평안북도": "goguryeo",
  "평안남도": "goguryeo",
  "평양직할시": "goguryeo",
  "라선특별시": "goguryeo",
  "량강도": "goguryeo",
  "신의주시": "goguryeo",
  
  // 고구려 영토 (남한 북부)
  "서울특별시": "goguryeo",
  "인천광역시": "goguryeo",
  "경기도": "goguryeo",
  "강원특별자치도": "goguryeo",
  
  // 백제 영토 (서남부)
  "충청북도": "baekje",
  "충청남도": "baekje",
  "세종특별자치시": "baekje",
  "대전광역시": "baekje",
  "전라북도": "baekje",
  "전북특별자치도": "baekje",
  "전라남도": "baekje",
  "광주광역시": "baekje",
  "제주특별자치도": "baekje",
  
  // 신라 영토 (동남부)
  "경상북도": "silla",
  "경상남도": "silla",
  "대구광역시": "silla",
  "울산광역시": "silla",
  "부산광역시": "silla",
  
  // 중립 지역
};

// 영토 색상
const kingdomColors = {
  goguryeo: {
    default: "#DC143C",
    hover: "#FF4060",
    stroke: "#8B0000",
  },
  baekje: {
    default: "#DAA520",
    hover: "#FFD700",
    stroke: "#B8860B",
  },
  silla: {
    default: "#4169E1",
    hover: "#6495ED",
    stroke: "#1E3A5F",
  },
  neutral: {
    default: "#4A4A4A",
    hover: "#6A6A6A",
    stroke: "#3A3A3A",
  },
};

interface Territory {
  id: string;
  name: string;
  owner: "goguryeo" | "baekje" | "silla" | "neutral";
}

interface KoreaMapProps {
  territories?: Territory[];
  onTerritoryClick?: (territory: Territory) => void;
  financeIncrease?: number;
  selectedNation?: "goguryeo" | "baekje" | "silla" | null;
}

// 로컬 지도 파일 경로
const KOREA_TOPO_JSON = "/korea-provinces.json";
const NORTH_KOREA_GEO_JSON = "/north-korea-provinces.json";

interface ProvinceProperties {
  code?: string;
  name?: string;
  name_eng?: string;
  base_year?: string;
  NAME_1?: string;
  VARNAME_1?: string;
}

interface MoneyParticle {
  id: number;
  x: number;
  y: number;
  delay: number;
}

const KoreaMap = memo(function KoreaMap({
  territories,
  onTerritoryClick,
  financeIncrease = 0,
  selectedNation = null,
}: KoreaMapProps) {
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [northKoreaData, setNorthKoreaData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moneyParticles, setMoneyParticles] = useState<MoneyParticle[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);

  // 영토 데이터가 있으면 해당 데이터 사용, 없으면 기본 매핑 사용
  const getOwner = (provinceName: string): "goguryeo" | "baekje" | "silla" | "neutral" => {
    if (territories) {
      const territory = territories.find(t => t.name === provinceName);
      if (territory) return territory.owner;
    }
    return provinceToKingdom[provinceName] || "neutral";
  };

  const getOwnerName = (owner: string) => {
    switch (owner) {
      case "goguryeo": return "고구려";
      case "baekje": return "백제";
      case "silla": return "신라";
      default: return "중립";
    }
  };

  // 북한 지역명을 한글로 변환
  const getProvinceName = (properties: ProvinceProperties): string => {
    if (properties.name) return properties.name;
    if (properties.NAME_1) {
      return northKoreaNameMap[properties.NAME_1] || properties.NAME_1;
    }
    if (properties.VARNAME_1) {
      return northKoreaNameMap[properties.VARNAME_1] || properties.VARNAME_1;
    }
    return "Unknown";
  };

  useEffect(() => {
    let loaded = 0;
    const checkLoaded = () => {
      loaded++;
      if (loaded >= 2) setLoading(false);
    };

    // 남한 데이터 로드
    fetch(KOREA_TOPO_JSON)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setTopoData(data as Topology);
        checkLoaded();
      })
      .catch(err => {
        console.error("Failed to load South Korea map data:", err);
        checkLoaded();
      });

    // 북한 데이터 로드
    fetch(NORTH_KOREA_GEO_JSON)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setNorthKoreaData(data);
        checkLoaded();
      })
      .catch(err => {
        console.error("Failed to load North Korea map data:", err);
        checkLoaded();
      });
  }, []);

  // TopoJSON을 GeoJSON으로 변환
  const geoData = useMemo(() => {
    if (!topoData) return null;
    try {
      const objectKey = Object.keys(topoData.objects)[0];
      const geoObject = topoData.objects[objectKey] as GeometryCollection<ProvinceProperties>;
      return topojson.feature(topoData, geoObject);
    } catch (err) {
      console.error("Failed to convert TopoJSON:", err);
      return null;
    }
  }, [topoData]);

  // 재정 증가 시 돈 파티클 생성 (자기 나라 영토 위에만)
  useEffect(() => {
    if (financeIncrease > 0 && mapContainerRef.current && selectedNation) {
      // SVG가 렌더링될 때까지 약간의 지연
      const timeoutId = setTimeout(() => {
        const container = mapContainerRef.current;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        const svgElement = container.querySelector('svg');
        
        // 파티클 개수 결정 (재정 증가량에 비례, 최대 15개)
        const particleCount = Math.min(15, Math.max(3, Math.floor(financeIncrease / 500) + 3));
        
        // 선택된 국가의 영토 위치 (대략적인 영토 중심 및 확산 범위)
        const territoryPositions = {
          goguryeo: { centerX: 0.5, centerY: 0.35, spreadX: 0.3, spreadY: 0.35 },
          baekje: { centerX: 0.35, centerY: 0.65, spreadX: 0.25, spreadY: 0.28 },
          silla: { centerX: 0.75, centerY: 0.7, spreadX: 0.2, spreadY: 0.22 },
        };
        
        const pos = territoryPositions[selectedNation];
        const newParticles: MoneyParticle[] = [];
        
        // SVG 경계 박스를 사용하여 더 정확한 위치 계산 시도
        if (svgElement) {
          try {
            const paths = svgElement.querySelectorAll(`path[data-owner="${selectedNation}"]`);
            
            // 선택된 국가의 영토에 해당하는 경계 박스들 수집
            const territoryBounds: Array<{ x: number; y: number; width: number; height: number }> = [];
            
            // 각 경로의 경계 박스를 확인
            paths.forEach((pathElement) => {
              try {
                const path = pathElement as SVGPathElement;
                const bbox = path.getBBox();
                if (bbox.width > 5 && bbox.height > 5) {
                  // SVG 뷰포트 내의 상대 좌표를 얻기 위해 SVG 요소의 크기 확인
                  const svgViewBox = svgElement.viewBox.baseVal;
                  const svgWidth = svgViewBox.width || svgElement.clientWidth;
                  const svgHeight = svgViewBox.height || svgElement.clientHeight;
                  
                  // SVG 뷰포트 좌표를 컨테이너 좌표로 변환
                  // getBBox()는 SVG 뷰포트 좌표계를 반환하므로 이를 컨테이너 좌표로 변환
                  const scaleX = rect.width / svgWidth;
                  const scaleY = rect.height / svgHeight;
                  
                  const x = bbox.x * scaleX;
                  const y = bbox.y * scaleY;
                  const width = bbox.width * scaleX;
                  const height = bbox.height * scaleY;
                  
                  territoryBounds.push({ x, y, width, height });
                }
              } catch (e) {
                // getBBox 실패 시 무시
              }
            });
            
            // 영토 경계 박스가 발견된 경우 해당 위치 사용
            if (territoryBounds.length > 0) {
              for (let i = 0; i < particleCount; i++) {
                const bound = territoryBounds[Math.floor(Math.random() * territoryBounds.length)];
                const x = Math.max(0, Math.min(rect.width, bound.x + Math.random() * bound.width));
                const y = Math.max(0, Math.min(rect.height, bound.y + Math.random() * bound.height));
                
                newParticles.push({
                  id: particleIdRef.current++,
                  x,
                  y,
                  delay: Math.random() * 300,
                });
              }
            }
          } catch (e) {
            // SVG 처리 실패 시 fallback 사용
          }
        }
        
        // 경계 박스를 찾지 못한 경우 대략적인 위치 사용
        if (newParticles.length === 0) {
          for (let i = 0; i < particleCount; i++) {
            const offsetX = (Math.random() - 0.5) * pos.spreadX;
            const offsetY = (Math.random() - 0.5) * pos.spreadY;
            newParticles.push({
              id: particleIdRef.current++,
              x: Math.max(0, Math.min(rect.width, rect.width * (pos.centerX + offsetX))),
              y: Math.max(0, Math.min(rect.height, rect.height * (pos.centerY + offsetY))),
              delay: Math.random() * 300,
            });
          }
        }
        
        if (newParticles.length > 0) {
          setMoneyParticles((prev) => [...prev, ...newParticles]);
          
          // 애니메이션 완료 후 파티클 제거 (2초 + 지연)
          setTimeout(() => {
            setMoneyParticles((prev) => prev.filter((p) => !newParticles.includes(p)));
          }, 2300);
        }
      }, 100); // SVG 렌더링 후 100ms 대기
      
      return () => clearTimeout(timeoutId);
    }
  }, [financeIncrease, selectedNation]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  if ((error || !geoData) && !northKoreaData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#A89F91] text-sm">
        <div className="text-center">
          <p>지도 데이터를 불러올 수 없습니다</p>
          {error && <p className="text-xs mt-1 text-[#6B6B6B]">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} className="relative w-full h-full overflow-hidden">
      {/* 돈 파티클 애니메이션 */}
      {moneyParticles.map((particle) => (
        <div
          key={particle.id}
          className="money-particle"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            animationDelay: `${particle.delay}ms`,
          }}
        >
          💰
        </div>
      ))}
      
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 3200,
          center: [127.5, 38.0],
        }}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        {/* 북한 지도 */}
        {northKoreaData && (
          <Geographies geography={northKoreaData}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const provinceName = getProvinceName(geo.properties);
                if (provinceName === "Unknown") return null;
                
                const owner = getOwner(provinceName);
                const colors = kingdomColors[owner];
                const isHovered = hoveredProvince === provinceName;

                return (
                  <Geography
                    key={`nk-${geo.rsmKey}`}
                    geography={geo}
                    fill={isHovered ? colors.hover : colors.default}
                    stroke={colors.stroke}
                    strokeWidth={1}
                    data-owner={owner}
                    data-province={provinceName}
                    style={{
                      default: {
                        outline: "none",
                        transition: "all 0.2s ease",
                      },
                      hover: {
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        outline: "none",
                      },
                    }}
                    onMouseEnter={() => setHoveredProvince(provinceName)}
                    onMouseLeave={() => setHoveredProvince(null)}
                    onClick={() => {
                      if (onTerritoryClick) {
                        onTerritoryClick({
                          id: geo.rsmKey,
                          name: provinceName,
                          owner: owner,
                        });
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        )}

        {/* 남한 지도 */}
        {geoData && (
          <Geographies geography={geoData}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const provinceName = geo.properties.name || "Unknown";
                if (provinceName === "Unknown") return null;
                
                const owner = getOwner(provinceName);
                const colors = kingdomColors[owner];
                const isHovered = hoveredProvince === provinceName;

                return (
                  <Geography
                    key={`sk-${geo.rsmKey}`}
                    geography={geo}
                    fill={isHovered ? colors.hover : colors.default}
                    stroke={colors.stroke}
                    strokeWidth={1}
                    data-owner={owner}
                    data-province={provinceName}
                    style={{
                      default: {
                        outline: "none",
                        transition: "all 0.2s ease",
                      },
                      hover: {
                        outline: "none",
                        cursor: "pointer",
                      },
                      pressed: {
                        outline: "none",
                      },
                    }}
                    onMouseEnter={() => setHoveredProvince(provinceName)}
                    onMouseLeave={() => setHoveredProvince(null)}
                    onClick={() => {
                      if (onTerritoryClick) {
                        onTerritoryClick({
                          id: geo.rsmKey,
                          name: provinceName,
                          owner: owner,
                        });
                      }
                    }}
                  />
                );
              })
            }
          </Geographies>
        )}
      </ComposableMap>

      {/* 호버 툴팁 */}
      {hoveredProvince && (
        <div className="absolute top-2 left-2 bg-[#1a1a1a] border border-[#C9A227] rounded-lg px-3 py-2 text-sm animate-fade-in z-10">
          <p className="font-bold text-[#F5F5DC]">{hoveredProvince}</p>
          <p className="text-[#A89F91] text-xs">
            영유국: {getOwnerName(getOwner(hoveredProvince))}
          </p>
        </div>
      )}

      {/* 범례 */}
      <div className="absolute bottom-2 right-2 bg-[#0d0d0d]/90 border border-[#C9A227]/30 rounded-lg p-3 z-10">
        <p className="text-[10px] text-[#F5F5DC] font-bold mb-2 text-center">영토 현황</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: kingdomColors.goguryeo.default }} />
            <span className="text-[10px] text-[#F5F5DC]">고구려</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: kingdomColors.baekje.default }} />
            <span className="text-[10px] text-[#F5F5DC]">백제</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: kingdomColors.silla.default }} />
            <span className="text-[10px] text-[#F5F5DC]">신라</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default KoreaMap;
