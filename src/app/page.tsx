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
  url: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 검색 실행
  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query)}`
      );
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

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 검색 결과 */}
        {videos.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-4">
              검색 결과: {videos.length}건
            </p>
            <div className="space-y-4">
              {videos.map((video) => (
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
                    </div>
                    <div className="mt-2">
                      {video.isShorts ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                          Shorts
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          일반 영상
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
