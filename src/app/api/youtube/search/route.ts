import { NextRequest, NextResponse } from "next/server";

// YouTube Data API v3 — 검색 + 상세 정보를 한 번에 가져오는 API Route
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "검색어가 필요합니다" },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API 키가 설정되지 않았습니다" },
      { status: 500 }
    );
  }

  try {
    // 1단계: 검색 (search.list) — 100유닛
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "20");
    searchUrl.searchParams.set("order", "viewCount");
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString());
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      return NextResponse.json(
        { error: searchData.error?.message || "YouTube 검색 실패" },
        { status: searchRes.status }
      );
    }

    // 영상 ID 목록 추출
    const videoIds = searchData.items
      .map((item: { id: { videoId: string } }) => item.id.videoId)
      .filter(Boolean)
      .join(",");

    if (!videoIds) {
      return NextResponse.json({ items: [] });
    }

    // 2단계: 상세 정보 (videos.list) — 1유닛
    const detailUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    detailUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    detailUrl.searchParams.set("id", videoIds);
    detailUrl.searchParams.set("key", apiKey);

    const detailRes = await fetch(detailUrl.toString());
    const detailData = await detailRes.json();

    if (!detailRes.ok) {
      return NextResponse.json(
        { error: detailData.error?.message || "영상 상세 정보 조회 실패" },
        { status: detailRes.status }
      );
    }

    // 결과 정리
    const items = detailData.items.map(
      (video: {
        id: string;
        snippet: {
          title: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: { medium: { url: string } };
          description: string;
        };
        statistics: {
          viewCount: string;
          likeCount: string;
          commentCount: string;
        };
        contentDetails: { duration: string };
      }) => {
        // 숏츠 판별: 60초 이하면 숏츠로 간주
        const duration = video.contentDetails.duration;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const totalSeconds = match
          ? (parseInt(match[1] || "0") * 3600 +
              parseInt(match[2] || "0") * 60 +
              parseInt(match[3] || "0"))
          : 0;
        const isShorts = totalSeconds <= 60;

        return {
          id: video.id,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          thumbnail: video.snippet.thumbnails.medium.url,
          description: video.snippet.description,
          viewCount: parseInt(video.statistics.viewCount || "0"),
          likeCount: parseInt(video.statistics.likeCount || "0"),
          commentCount: parseInt(video.statistics.commentCount || "0"),
          duration: totalSeconds,
          isShorts,
          url: `https://www.youtube.com/watch?v=${video.id}`,
        };
      }
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("YouTube API 에러:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
