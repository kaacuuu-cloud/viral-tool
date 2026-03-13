import { NextRequest, NextResponse } from "next/server";

// YouTube 검색 결과 아이템 타입
interface YouTubeSearchItem {
  id: { videoId: string };
}

// YouTube 영상 상세 정보 타입
interface YouTubeVideoItem {
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
}

// YouTube Data API v3 — 검색 + 상세 정보 (50개 × 2페이지, 날짜 필터 지원)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const publishedAfter = searchParams.get("publishedAfter"); // ISO 날짜
  const publishedBefore = searchParams.get("publishedBefore"); // ISO 날짜
  const maxPages = parseInt(searchParams.get("pages") || "2"); // 페이지 수 (기본 2)

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
    // 여러 페이지를 돌며 영상 ID 수집
    let allVideoIds: string[] = [];
    let nextPageToken: string | undefined = undefined;

    for (let page = 0; page < maxPages; page++) {
      const searchUrl = new URL(
        "https://www.googleapis.com/youtube/v3/search"
      );
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", "50");
      searchUrl.searchParams.set("order", "viewCount");
      searchUrl.searchParams.set("key", apiKey);

      // 날짜 필터 — YouTube API에 직접 전달
      if (publishedAfter) {
        searchUrl.searchParams.set("publishedAfter", publishedAfter);
      }
      if (publishedBefore) {
        searchUrl.searchParams.set("publishedBefore", publishedBefore);
      }

      // 다음 페이지 토큰
      if (nextPageToken) {
        searchUrl.searchParams.set("pageToken", nextPageToken);
      }

      const searchRes = await fetch(searchUrl.toString());
      const searchData = await searchRes.json();

      if (!searchRes.ok) {
        return NextResponse.json(
          { error: searchData.error?.message || "YouTube 검색 실패" },
          { status: searchRes.status }
        );
      }

      const ids = searchData.items
        .map((item: YouTubeSearchItem) => item.id.videoId)
        .filter(Boolean);
      allVideoIds = [...allVideoIds, ...ids];

      // 다음 페이지가 없으면 종료
      nextPageToken = searchData.nextPageToken;
      if (!nextPageToken) break;
    }

    if (allVideoIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // 상세 정보 조회 (50개씩 나눠서 호출 — videos.list는 최대 50개)
    const allItems = [];
    for (let i = 0; i < allVideoIds.length; i += 50) {
      const batch = allVideoIds.slice(i, i + 50).join(",");

      const detailUrl = new URL(
        "https://www.googleapis.com/youtube/v3/videos"
      );
      detailUrl.searchParams.set(
        "part",
        "snippet,statistics,contentDetails"
      );
      detailUrl.searchParams.set("id", batch);
      detailUrl.searchParams.set("key", apiKey);

      const detailRes = await fetch(detailUrl.toString());
      const detailData = await detailRes.json();

      if (!detailRes.ok) {
        return NextResponse.json(
          {
            error:
              detailData.error?.message || "영상 상세 정보 조회 실패",
          },
          { status: detailRes.status }
        );
      }

      const items = detailData.items.map((video: YouTubeVideoItem) => {
        // 숏츠 판별: 60초 이하면 숏츠로 간주
        const duration = video.contentDetails.duration;
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const totalSeconds = match
          ? parseInt(match[1] || "0") * 3600 +
            parseInt(match[2] || "0") * 60 +
            parseInt(match[3] || "0")
          : 0;
        const isShorts = totalSeconds <= 60;

        const viewCount = parseInt(video.statistics.viewCount || "0");
        const likeCount = parseInt(video.statistics.likeCount || "0");
        const commentCount = parseInt(video.statistics.commentCount || "0");

        // ER(Engagement Rate) = (좋아요 + 댓글) / 조회수 × 100
        const engagementRate =
          viewCount > 0
            ? ((likeCount + commentCount) / viewCount) * 100
            : 0;

        return {
          id: video.id,
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt,
          thumbnail: video.snippet.thumbnails.medium.url,
          description: video.snippet.description,
          viewCount,
          likeCount,
          commentCount,
          duration: totalSeconds,
          isShorts,
          engagementRate: Math.round(engagementRate * 100) / 100,
          url: `https://www.youtube.com/watch?v=${video.id}`,
        };
      });

      allItems.push(...items);
    }

    return NextResponse.json({
      items: allItems,
      totalCount: allItems.length,
    });
  } catch (error) {
    console.error("YouTube API 에러:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
