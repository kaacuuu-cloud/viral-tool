"use client";

import { useState } from "react";

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

// 6개월 전 날짜 계산
function getSixMonthsAgo(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split("T")[0];
}

// 오늘 날짜
function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 현재 탭: Videos 또는 Shorts
  const [activeTab, setActiveTab] = useState<"videos" | "shorts">("videos");

  // 날짜 필터 (기본값 6개월)
  const [dateFrom, setDateFrom] = useState(getSixMonthsAgo());
  const [dateTo, setDateTo] = useState(getToday());

  // 추가 필터
  const [minViewCount, setMinViewCount] = useState(0);
  const [minLikeCount, setMinLikeCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // 탭에 따라 Videos/Shorts 분리 + 필터 적용
  const filteredVideos = videos.filter((video) => {
    // 탭 필터
    if (activeTab === "shorts" && !video.isShorts) return false;
    if (activeTab === "videos" && video.isShorts) return false;
    // 조회수 필터
    if (minViewCount > 0 && video.viewCount < minViewCount) return false;
    // 좋아요 필터
    if (minLikeCount > 0 && video.likeCount < minLikeCount) return false;
    return true;
  });

  // 각 탭 건수 (검색 결과에서)
  const videoCount = videos.filter((v) => !v.isShorts).length;
  const shortsCount = videos.filter((v) => v.isShorts).length;

  // 검색 실행
  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      // 날짜를 ISO 형식으로 변환해서 API에 전달
      const params = new URLSearchParams({
        q: query,
        publishedAfter: new Date(dateFrom).toISOString(),
        publishedBefore: new Date(dateTo + "T23:59:59").toISOString(),
        pages: "2",
      });

      const res = await fetch(`/api/youtube/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "검색 중 오류가 발생했습니다");
        return;
      }

      setVideos(data.items);
    } catch {
      setError("서버 연결에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 엔터키로 검색
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  // 조회수 포맷 (10000 → 1만)
  const formatCount = (count: number) => {
    if (count >= 100000000) return `${(count / 100000000).toFixed(1)}억`;
    if (count >= 10000) return `${(count / 10000).toFixed(1)}만`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}천`;
    return count.toString();
  };

  // 날짜 포맷 (2025-12-21T... → 2025.12.21)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">
          Viral Tool — 바이럴 콘텐츠 탐색기
        </h1>
      </header>

      {/* 검색 영역 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 검색창 + 날짜 */}
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="검색어를 입력하세요 (예: 뷰티 디바이스)"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "검색 중..." : "검색"}
          </button>
        </div>

        {/* 날짜 범위 (항상 표시) */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">기간:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">(기본: 최근 6개월)</span>
        </div>

        {/* Videos / Shorts 탭 */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setActiveTab("videos")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "videos"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Videos
            {videos.length > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === "videos"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {videoCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("shorts")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "shorts"
                ? "bg-red-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Shorts
            {videos.length > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === "shorts"
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {shortsCount}
              </span>
            )}
          </button>

          {/* 추가 필터 토글 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? "bg-gray-800 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Filters
          </button>
        </div>

        {/* 추가 필터 영역 */}
        {showFilters && (
          <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* 최소 조회수 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  최소 조회수
                </label>
                <select
                  value={minViewCount}
                  onChange={(e) => setMinViewCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>전체</option>
                  <option value={1000}>1천 이상</option>
                  <option value={10000}>1만 이상</option>
                  <option value={50000}>5만 이상</option>
                  <option value={100000}>10만 이상</option>
                  <option value={500000}>50만 이상</option>
                  <option value={1000000}>100만 이상</option>
                </select>
              </div>

              {/* 최소 좋아요수 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  최소 좋아요수
                </label>
                <select
                  value={minLikeCount}
                  onChange={(e) => setMinLikeCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>전체</option>
                  <option value={100}>100 이상</option>
                  <option value={500}>500 이상</option>
                  <option value={1000}>1천 이상</option>
                  <option value={5000}>5천 이상</option>
                  <option value={10000}>1만 이상</option>
                </select>
              </div>

              {/* 필터 초기화 */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setMinViewCount(0);
                    setMinLikeCount(0);
                  }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-red-500 border border-gray-300 rounded hover:border-red-300 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 검색 결과 */}
        {filteredVideos.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-4">
              {activeTab === "videos" ? "Videos" : "Shorts"} 결과:{" "}
              {filteredVideos.length}건
              {(minViewCount > 0 || minLikeCount > 0) && (
                <span className="text-gray-400">
                  {" "}
                  (전체{" "}
                  {activeTab === "videos" ? videoCount : shortsCount}건
                  중)
                </span>
              )}
            </p>
            <div className="space-y-4">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="flex gap-4 bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  {/* 썸네일 */}
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-40 h-24 object-cover rounded"
                    />
                  </a>

                  {/* 영상 정보 */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                    >
                      {video.title}
                    </a>
                    <p className="text-sm text-gray-500 mt-1">
                      {video.channelTitle} · {formatDate(video.publishedAt)}
                    </p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-600">
                      <span>조회수 {formatCount(video.viewCount)}</span>
                      <span>좋아요 {formatCount(video.likeCount)}</span>
                      <span>댓글 {formatCount(video.commentCount)}</span>
                      <span className="text-blue-600 font-medium">
                        ER {video.engagementRate}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 필터 결과 없음 */}
        {!loading && filteredVideos.length === 0 && videos.length > 0 && (
          <p className="mt-6 text-center text-gray-400">
            {activeTab === "videos" ? "Videos" : "Shorts"} 탭에 해당하는
            영상이 없습니다
          </p>
        )}

        {/* 검색 결과 없음 */}
        {!loading && videos.length === 0 && !error && query && (
          <p className="mt-6 text-center text-gray-400">
            검색 결과가 없습니다
          </p>
        )}
      </div>
    </div>
  );
}
