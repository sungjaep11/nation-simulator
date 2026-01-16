"use client";

import { useState, useEffect, memo, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// 시도별 삼국 영토 매핑
const provinceToKingdom: Record<string, "goguryeo" | "baekje" | "silla" | "neutral"> = {
  // 고구려 영토 (북부)
  "서울특별시": "goguryeo",
  "인천광역시": "goguryeo",
  "경기도": "goguryeo",
  "강원도": "goguryeo",
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
  
  // 신라 영토 (동남부)
  "경상북도": "silla",
  "경상남도": "silla",
  "대구광역시": "silla",
  "울산광역시": "silla",
  "부산광역시": "silla",
  
  // 중립 지역
  "제주특별자치도": "neutral",
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
}

// 로컬 TopoJSON 파일 경로
const KOREA_TOPO_JSON = "/korea-provinces.json";

interface ProvinceProperties {
  code: string;
  name: string;
  name_eng: string;
  base_year: string;
}

const KoreaMap = memo(function KoreaMap({
  territories,
  onTerritoryClick,
}: KoreaMapProps) {
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetch(KOREA_TOPO_JSON)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setTopoData(data as Topology);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load map data:", err);
        setError(err.message);
        setLoading(false);
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

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !geoData) {
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
    <div className="relative w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 5500,
          center: [127.8, 35.9],
        }}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <Geographies geography={geoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const provinceName = geo.properties.name;
              const owner = getOwner(provinceName);
              const colors = kingdomColors[owner];
              const isHovered = hoveredProvince === provinceName;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={isHovered ? colors.hover : colors.default}
                  stroke={colors.stroke}
                  strokeWidth={1}
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
