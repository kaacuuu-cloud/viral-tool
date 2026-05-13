"use client";

import { useState, useRef, useCallback } from "react";

// 영상 데이터 타입
interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: string;
  description: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: number;
  isShorts: boolean;
  engagementRate: number;
  url: string;
}

// 분석 결과 타입
interface AnalysisResult {
  videoUrl: string;
  adStatus: string;
  contentType: string;
  keyInfo: string[];
  pros: string[];
  cons: string[];
  insight: string;
  // 이전 형식 호환
  productName?: string;
}

const MAX_SELECTION = 50;

function getSixMonthsAgo(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split("T")[0];
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"videos" | "shorts">("videos");
  const [dateFrom, setDateFrom] = useState(getSixMonthsAgo());
  const [dateTo, setDateTo] = useState(getToday());
  const [minViewCount, setMinViewCount] = useState(0);
  const [minLikeCount, setMinLikeCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [sortBy, setSortBy] = useState<"none" | "views" | "date">("none");
  const [viewMode, setViewMode] = useState<"search" | "results">("search");

  // 드래그 선택 상태
  const isDragging = useRef(false);
  const dragAction = useRef<"select" | "deselect">("select");

  const handleDragStart = useCallback((id: string) => {
    if (!selectionMode) return;
    isDragging.current = true;
    // 첫 번째 아이템의 현재 상태에 따라 선택/해제 모드 결정
    dragAction.current = selectedIds.has(id) ? "deselect" : "select";
    const next = new Set(selectedIds);
    if (dragAction.current === "select") {
      if (next.size < MAX_SELECTION) next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  }, [selectionMode, selectedIds]);

  const handleDragEnter = useCallback((id: string) => {
    if (!isDragging.current || !selectionMode) return;
    const next = new Set(selectedIds);
    if (dragAction.current === "select") {
      if (next.size < MAX_SELECTION) next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  }, [selectionMode, selectedIds]);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const filteredVideos = videos
    .filter((video) => {
      if (activeTab === "shorts" && !video.isShorts) return false;
      if (activeTab === "videos" && video.isShorts) return false;
      if (minViewCount > 0 && video.viewCount < minViewCount) return false;
      if (minLikeCount > 0 && video.likeCount < minLikeCount) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "views") return b.viewCount - a.viewCount;
      if (sortBy === "date")
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      return 0;
    });

  const videoCount = videos.filter((v) => !v.isShorts).length;
  const shortsCount = videos.filter((v) => v.isShorts).length;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= MAX_SELECTION) {
        setError(`최대 ${MAX_SELECTION}개까지 선택할 수 있어요`);
        setTimeout(() => setError(""), 3000);
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectMore = (count: number) => {
    const next = new Set(selectedIds);
    for (const video of filteredVideos) {
      if (next.size >= MAX_SELECTION) break;
      if (!next.has(video.id)) {
        next.add(video.id);
        count--;
        if (count <= 0) break;
      }
    }
    if (next.size >= MAX_SELECTION && count > 0) {
      setError(`최대 ${MAX_SELECTION}개까지 선택할 수 있어요`);
      setTimeout(() => setError(""), 3000);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    const next = new Set(selectedIds);
    for (const video of filteredVideos) {
      if (next.size >= MAX_SELECTION) break;
      next.add(video.id);
    }
    if (filteredVideos.length > MAX_SELECTION) {
      setError(`최대 ${MAX_SELECTION}개를 선택했어요`);
      setTimeout(() => setError(""), 3000);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAnalyze = async () => {
    const selectedVideos = filteredVideos.filter((v) => selectedIds.has(v.id));
    if (selectedVideos.length === 0) return;
    setAnalyzing(true);
    setAnalysisProgress(`${selectedVideos.length}개 영상을 준비하고 있어요`);
    setAnalysisResults([]);
    try {
      const urls = selectedVideos.map((v) => v.url);
      const videoMeta = selectedVideos.map((v) => ({
        title: v.title, channelTitle: v.channelTitle,
        description: v.description, url: v.url,
      }));
      setAnalysisProgress(`${selectedVideos.length}개 영상을 분석하고 있어요`);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrls: urls, videoMeta, searchQuery: query }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "분석 중 문제가 생겼어요"); return; }
      if (data.success && data.analysis) {
        setAnalysisResults(data.analysis);
        setAnalysisProgress(`${data.analysis.length}개 분석을 완료했어요`);
        setViewMode("results");
      }
    } catch { setError("서버에 연결할 수 없어요"); }
    finally { setAnalyzing(false); }
  };

  const exportCSV = () => {
    const selectedVideos = filteredVideos.filter((v) => selectedIds.has(v.id));
    const rows = selectedVideos.map((video, index) => {
      const analysis = analysisResults[index] || {};
      const a = analysis as AnalysisResult;
      return {
        NO: index + 1,
        영상유형: a.contentType || "",
        투고일: formatDate(video.publishedAt),
        플랫폼: video.isShorts ? "YouTube Shorts" : "YouTube",
        계정명: video.channelTitle,
        조회수: video.viewCount, 좋아요수: video.likeCount,
        댓글수: video.commentCount, URL: video.url,
        광고여부: a.adStatus || "",
        "핵심정보": (a.keyInfo || []).join(" / "),
        "장점": (a.pros || []).join(" / "),
        "단점": (a.cons || []).join(" / "),
        "결론": a.insight || "",
      };
    });
    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => {
          const val = String(row[h as keyof typeof row] || "");
          return val.includes(",") || val.includes("\n") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `viral-tool-${query}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(""); setSelectedIds(new Set());
    setAnalysisResults([]); setSelectionMode(false); setViewMode("search");
    try {
      const params = new URLSearchParams({
        q: query,
        publishedAfter: new Date(dateFrom).toISOString(),
        publishedBefore: new Date(dateTo + "T23:59:59").toISOString(),
        pages: "2",
      });
      const res = await fetch(`/api/youtube/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "검색 중 문제가 생겼어요"); return; }
      setVideos(data.items);
    } catch { setError("서버에 연결할 수 없어요"); }
    finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatCount = (count: number) => {
    if (count >= 100000000) return `${(count / 100000000).toFixed(1)}억`;
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`;
    return count.toString();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  // iOS 스타일 세그먼트 컨트롤
  const Segment = ({ items, value, onChange }: {
    items: { key: string; label: string }[];
    value: string;
    onChange: (key: string) => void;
  }) => (
    <div className="flex bg-[#E5E5EA] rounded-[9px] p-[2px]">
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onChange(item.key)}
          className={`flex-1 h-[32px] text-[13px] font-medium rounded-[7px] transition-all ${
            value === item.key
              ? "bg-white text-[#000] shadow-sm"
              : "text-[#8E8E93]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#F2F2F7]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>

      {/* 네비게이션 바 — iOS 스타일 */}
      <header className="shrink-0 h-[48px] flex items-center justify-between px-5 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-[#C6C6C8]/40">
        <h1 className="text-[17px] font-semibold tracking-[-0.4px]">Viral Tool</h1>
        {analysisResults.length > 0 && (
          <Segment
            items={[
              { key: "search", label: "검색" },
              { key: "results", label: `분석 결과 ${analysisResults.length}` },
            ]}
            value={viewMode}
            onChange={(v) => setViewMode(v as "search" | "results")}
          />
        )}
      </header>

      {/* 분석 결과 뷰 */}
      {viewMode === "results" && analysisResults.length > 0 ? (
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-[#8E8E93]">{analysisResults.length}개 분석 완료</p>
            <div className="flex gap-2">
              <button onClick={exportCSV} className="h-[34px] px-4 text-[13px] font-medium text-white bg-[#007AFF] rounded-[8px] hover:bg-[#0071E3] transition-colors">
                CSV 내보내기
              </button>
              <button onClick={() => setViewMode("search")} className="h-[34px] px-4 text-[13px] font-medium text-[#007AFF] bg-[#007AFF]/10 rounded-[8px] hover:bg-[#007AFF]/15 transition-colors">
                검색으로
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {videos.filter((v) => selectedIds.has(v.id)).map((video, index) => {
              const a = analysisResults[index] as AnalysisResult | undefined;
              const ad = a?.adStatus || "";
              const keyInfo = a?.keyInfo || [];
              const pros = a?.pros || [];
              const cons = a?.cons || [];
              return (
                <div key={video.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* 헤더: 영상 기본 정보 */}
                  <div className="px-4 py-3 border-b border-[#E5E5EA]/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-[#8E8E93]">#{index + 1}</span>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ad === "광고임" ? "bg-[#FF3B30]/10 text-[#FF3B30]"
                            : ad === "광고아님" ? "bg-[#34C759]/10 text-[#34C759]"
                            : "bg-[#8E8E93]/10 text-[#8E8E93]"
                          }`}>{ad || "판별못함"}</span>
                          {a?.contentType && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#007AFF]/10 text-[#007AFF]">{a.contentType}</span>
                          )}
                        </div>
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#000] hover:text-[#007AFF] transition-colors line-clamp-2">
                          {video.title}
                        </a>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-[#8E8E93]">
                          <span>{video.channelTitle}</span>
                          <span>{formatDate(video.publishedAt)}</span>
                          <span>조회 {formatCount(video.viewCount)}</span>
                          <span>좋아요 {formatCount(video.likeCount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 본문: 핵심 정보 */}
                  <div className="px-4 py-3 space-y-3">
                    {/* 핵심 정보 */}
                    {keyInfo.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5">핵심 정보</p>
                        <ul className="space-y-1">
                          {keyInfo.map((info, i) => (
                            <li key={i} className="text-[12px] text-[#3C3C43] leading-relaxed flex gap-1.5">
                              <span className="text-[#007AFF] shrink-0">•</span>
                              <span>{info}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 장점 / 단점 나란히 */}
                    {(pros.length > 0 || cons.length > 0) && (
                      <div className="flex gap-4">
                        {pros.length > 0 && (
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-[#34C759] uppercase tracking-wider mb-1.5">장점 / 추천</p>
                            <ul className="space-y-0.5">
                              {pros.map((p, i) => (
                                <li key={i} className="text-[12px] text-[#3C3C43]/80 leading-relaxed flex gap-1.5">
                                  <span className="text-[#34C759] shrink-0">+</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {cons.length > 0 && (
                          <div className="flex-1">
                            <p className="text-[11px] font-semibold text-[#FF3B30] uppercase tracking-wider mb-1.5">단점 / 주의</p>
                            <ul className="space-y-0.5">
                              {cons.map((c, i) => (
                                <li key={i} className="text-[12px] text-[#3C3C43]/80 leading-relaxed flex gap-1.5">
                                  <span className="text-[#FF3B30] shrink-0">-</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 결론 */}
                    {a?.insight && (
                      <div className="bg-[#F2F2F7] rounded-lg px-3 py-2">
                        <p className="text-[12px] text-[#3C3C43] leading-relaxed">
                          <span className="font-semibold">결론:</span> {a.insight}
                        </p>
                      </div>
                    )}

                    {/* 정보 없음 fallback */}
                    {keyInfo.length === 0 && !a?.insight && (
                      <p className="text-[12px] text-[#8E8E93]">분석 정보 없음</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (

      /* ========== 메인 2컬럼 ========== */
      <div className="flex-1 flex overflow-hidden">

        {/* 사이드바 */}
        <aside className="w-[320px] shrink-0 bg-[#F2F2F7] flex flex-col">

          {/* 스크롤 가능 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {/* 검색 카드 */}
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-2.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="검색어를 입력해 주세요"
              className="w-full h-[44px] px-4 text-[15px] bg-[#E5E5EA]/50 rounded-xl placeholder-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="w-full h-[44px] text-[15px] font-semibold text-white bg-[#007AFF] rounded-xl hover:bg-[#0071E3] disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] transition-colors"
            >
              {loading ? "검색하고 있어요..." : "검색"}
            </button>
          </div>

          {/* 기간 카드 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E5E5EA]/60">
              <span className="text-[13px] font-semibold text-[#000]">기간</span>
            </div>
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-[#E5E5EA]/60">
              <span className="text-[13px] text-[#8E8E93] w-10 shrink-0">시작</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 h-[34px] px-3 text-[14px] bg-[#E5E5EA]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
            </div>
            <div className="px-4 py-2.5 flex items-center gap-2">
              <span className="text-[13px] text-[#8E8E93] w-10 shrink-0">종료</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 h-[34px] px-3 text-[14px] bg-[#E5E5EA]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
            </div>
          </div>

          {/* 필터 카드 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E5E5EA]/60">
              <span className="text-[13px] font-semibold text-[#000]">필터</span>
            </div>

            {/* 유형 세그먼트 */}
            <div className="px-4 py-2.5 border-b border-[#E5E5EA]/60">
              <Segment
                items={[
                  { key: "videos", label: `Videos ${videoCount > 0 ? videoCount : ""}` },
                  { key: "shorts", label: `Shorts ${shortsCount > 0 ? shortsCount : ""}` },
                ]}
                value={activeTab}
                onChange={(v) => setActiveTab(v as "videos" | "shorts")}
              />
            </div>

            {/* 조회수 */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-[#E5E5EA]/60">
              <span className="text-[14px]">조회수</span>
              <select
                value={minViewCount}
                onChange={(e) => setMinViewCount(Number(e.target.value))}
                className="h-[32px] px-3 text-[13px] text-[#007AFF] bg-[#007AFF]/8 rounded-lg focus:outline-none"
              >
                <option value={0}>전체</option>
                <option value={1000}>1천+</option>
                <option value={10000}>1만+</option>
                <option value={50000}>5만+</option>
                <option value={100000}>10만+</option>
                <option value={1000000}>100만+</option>
              </select>
            </div>

            {/* 좋아요 */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-[#E5E5EA]/60">
              <span className="text-[14px]">좋아요</span>
              <select
                value={minLikeCount}
                onChange={(e) => setMinLikeCount(Number(e.target.value))}
                className="h-[32px] px-3 text-[13px] text-[#007AFF] bg-[#007AFF]/8 rounded-lg focus:outline-none"
              >
                <option value={0}>전체</option>
                <option value={100}>100+</option>
                <option value={500}>500+</option>
                <option value={1000}>1천+</option>
                <option value={10000}>1만+</option>
              </select>
            </div>

            {/* 정렬 */}
            <div className="px-4 py-2.5">
              <span className="text-[13px] text-[#8E8E93] block mb-1.5">정렬</span>
              <Segment
                items={[
                  { key: "none", label: "기본" },
                  { key: "views", label: "조회수" },
                  { key: "date", label: "최신순" },
                ]}
                value={sortBy}
                onChange={(v) => setSortBy(v as "none" | "views" | "date")}
              />
            </div>
          </div>

          {/* 선택 카드 */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#E5E5EA]/60">
              <span className="text-[13px] font-semibold text-[#000]">선택</span>
              {selectionMode && (
                <span className="text-[13px] text-[#007AFF] font-medium">
                  {selectedIds.size}/{MAX_SELECTION}
                </span>
              )}
            </div>
            <div className="px-4 py-2.5">
              {!selectionMode ? (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="w-full h-[40px] text-[14px] font-medium text-[#007AFF] bg-[#007AFF]/8 rounded-xl hover:bg-[#007AFF]/12 transition-colors"
                >
                  선택 모드 켜기
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => selectMore(10)} className="flex-1 h-[36px] text-[13px] font-medium text-[#007AFF] bg-[#007AFF]/8 rounded-lg hover:bg-[#007AFF]/12 transition-colors">+10</button>
                    <button onClick={() => selectMore(50)} className="flex-1 h-[36px] text-[13px] font-medium text-[#007AFF] bg-[#007AFF]/8 rounded-lg hover:bg-[#007AFF]/12 transition-colors">+50</button>
                    <button onClick={selectAll} className="flex-1 h-[36px] text-[13px] font-medium text-[#007AFF] bg-[#007AFF]/8 rounded-lg hover:bg-[#007AFF]/12 transition-colors">전체</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={clearSelection} className="flex-1 h-[36px] text-[13px] text-[#8E8E93] hover:text-[#FF3B30] transition-colors">선택 해제</button>
                    <button onClick={() => { setSelectionMode(false); clearSelection(); }} className="flex-1 h-[36px] text-[13px] text-[#FF3B30] font-medium">선택 모드 끄기</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          </div>{/* 스크롤 영역 끝 */}

          {/* CTA 버튼 — 사이드바 하단 고정 */}
          {selectionMode && selectedIds.size > 0 && (
            <div className="shrink-0 p-4 pt-3 space-y-2 border-t border-[#E5E5EA]/60 bg-[#F2F2F7]">
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full h-[50px] text-[17px] font-semibold text-white bg-[#007AFF] rounded-xl hover:bg-[#0071E3] disabled:bg-[#E5E5EA] disabled:text-[#8E8E93] transition-colors shadow-sm"
              >
                {analyzing ? "분석 중..." : analysisResults.length > 0 ? "다시 분석하기" : `${selectedIds.size}개 분석하기`}
              </button>
              {analysisResults.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="w-full h-[48px] text-[15px] font-semibold text-[#007AFF] bg-white rounded-xl hover:bg-[#F2F2F7] transition-colors shadow-sm border border-[#E5E5EA]"
                >
                  CSV 내보내기
                </button>
              )}
            </div>
          )}
        </aside>

        {/* 메인 결과 영역 */}
        <main className="flex-1 overflow-y-auto bg-white" onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}>
          {/* 에러 배너 */}
          {error && (
            <div className="mx-4 mt-3 px-4 py-3 text-[13px] text-[#FF3B30] bg-[#FF3B30]/8 rounded-xl">
              {error}
            </div>
          )}

          {/* 결과 헤더 */}
          {filteredVideos.length > 0 && (
            <div className="sticky top-0 z-10 px-4 h-[40px] flex items-center bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA]/40">
              <span className="text-[13px] text-[#8E8E93]">{filteredVideos.length}건</span>
            </div>
          )}

          {/* 영상 리스트 */}
          {filteredVideos.length > 0 ? (
            <div>
              {filteredVideos.map((video) => {
                const isSelected = selectedIds.has(video.id);
                return (
                  <div
                    key={video.id}
                    onMouseDown={(e) => { if (selectionMode) { e.preventDefault(); handleDragStart(video.id); } }}
                    onMouseEnter={() => handleDragEnter(video.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#E5E5EA]/40 transition-colors select-none ${
                      selectionMode ? "cursor-pointer active:bg-[#E5E5EA]/40" : ""
                    } ${isSelected ? "bg-[#007AFF]/5" : "hover:bg-[#F2F2F7]/60"}`}
                  >
                    {/* iOS 체크마크 */}
                    {selectionMode && (
                      <div className={`w-[22px] h-[22px] shrink-0 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-[#007AFF]"
                          : "border-2 border-[#C7C7CC]"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}

                    {/* 썸네일 */}
                    <a
                      href={selectionMode ? undefined : video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                      onClick={(e) => selectionMode && e.preventDefault()}
                    >
                      <img src={video.thumbnail} alt="" className="w-[120px] h-[68px] object-cover rounded-lg" />
                    </a>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={selectionMode ? undefined : video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[14px] font-medium text-[#000] line-clamp-1 hover:text-[#007AFF]"
                        onClick={(e) => selectionMode && e.preventDefault()}
                      >
                        {video.title}
                      </a>
                      <p className="text-[12px] text-[#8E8E93] mt-0.5">
                        {video.channelTitle} · {formatDate(video.publishedAt)}
                      </p>
                    </div>

                    {/* 수치 */}
                    <div className="shrink-0 text-right">
                      <p className="text-[14px] font-medium tabular-nums">{formatCount(video.viewCount)}</p>
                      <p className="text-[11px] text-[#8E8E93] mt-0.5">
                        {formatCount(video.likeCount)} · ER {video.engagementRate}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-[20px] font-semibold text-[#000]">
                  {loading ? "검색하고 있어요" : "영상을 검색해 보세요"}
                </p>
                <p className="text-[15px] text-[#8E8E93] mt-1">
                  {loading ? "잠시만 기다려 주세요" : videos.length > 0 ? "필터에 맞는 영상이 없어요" : "검색어를 입력하고 검색 버튼을 눌러주세요"}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
      )}

      {/* 분석 중 오버레이 — iOS Alert 스타일 */}
      {analyzing && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-[280px] mx-4 text-center">
            <div className="w-10 h-10 border-[3px] border-[#E5E5EA] border-t-[#007AFF] rounded-full animate-spin" />
            <p className="text-[17px] font-semibold">분석하고 있어요</p>
            <p className="text-[13px] text-[#8E8E93] leading-relaxed">{analysisProgress}</p>
          </div>
        </div>
      )}
    </div>
  );
}
