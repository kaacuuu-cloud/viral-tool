import { NextRequest, NextResponse } from "next/server";

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

// Invidious 검색 결과 타입
interface InvidiousSearchItem {
  type: string;
  videoId: string;
}

// YouTube Search API 결과 타입
interface YouTubeSearchItem {
  id: { videoId: string };
}

// 검색 캐시 (30분간 동일 검색어 재사용 → API 유닛 절약)
const searchCache = new Map<string, { data: object; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30분

// Invidious 공개 인스턴스 목록 (하나 실패 시 다음으로)
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://iv.datura.network",
];

// Invidious API로 검색 (할당량 0)
async function searchViaInvidious(
  query: string,
  publishedAfter?: string | null,
  publishedBefore?: string | null,
): Promise<string[] | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const searchUrl = new URL(`${instance}/api/v1/search`);
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("sort_by", "view_count");

      // Invidious 날짜 필터 — date 파라미터로 대략적 범위 설정
      if (publishedAfter) {
        const monthsAgo = Math.ceil(
          (Date.now() - new Date(publishedAfter).getTime()) / (30 * 24 * 60 * 60 * 1000)
        );
        if (monthsAgo <= 1) searchUrl.searchParams.set("date", "month");
        else if (monthsAgo <= 12) searchUrl.searchParams.set("date", "year");
      }

      const res = await fetch(searchUrl.toString(), {
        signal: AbortSignal.timeout(8000), // 8초 타임아웃
      });

      if (!res.ok) continue;

      const data: InvidiousSearchItem[] = await res.json();
      const videoIds = data
        .filter((item) => item.type === "video" && item.videoId)
        .map((item) => item.videoId);

      if (videoIds.length > 0) {
        console.log(`Invidious 검색 성공 (${instance}): ${videoIds.length}개`);

        // Invidious는 날짜 필터가 대략적이므로, 정밀 필터링은 YouTube Videos API 응답에서 처리
        return videoIds;
      }
    } catch {
      console.log(`Invidious 인스턴스 실패: ${instance}`);
      continue;
    }
  }

  // 모든 인스턴스 실패
  return null;
}

// YouTube Search API로 검색 (fallback, 100유닛/요청)
async function searchViaYouTube(
  query: string,
  apiKey: string,
  publishedAfter?: string | null,
  publishedBefore?: string | null,
  maxPages: number = 2,
): Promise<string[]> {
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

    if (publishedAfter) {
      searchUrl.searchParams.set("publishedAfter", publishedAfter);
    }
    if (publishedBefore) {
      searchUrl.searchParams.set("publishedBefore", publishedBefore);
    }
    if (nextPageToken) {
      searchUrl.searchParams.set("pageToken", nextPageToken);
    }

    const searchRes = await fetch(searchUrl.toString());
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      throw new Error(searchData.error?.message || "YouTube 검색 실패");
    }

    const ids = searchData.items
      .map((item: YouTubeSearchItem) => item.id.videoId)
      .filter(Boolean);
    allVideoIds = [...allVideoIds, ...ids];

    nextPageToken = searchData.nextPageToken;
    if (!nextPageToken) break;
  }

  return allVideoIds;
}

// YouTube Videos API로 상세 정보 조회 (1유닛/영상)
async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
  publishedAfter?: string | null,
  publishedBefore?: string | null,
) {
  const allItems = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50).join(",");

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
      throw new Error(
        detailData.error?.message || "영상 상세 정보 조회 실패"
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

  // Invidious 검색 결과는 날짜 필터가 대략적이므로, 정밀 필터링 적용
  if (publishedAfter || publishedBefore) {
    const afterDate = publishedAfter ? new Date(publishedAfter).getTime() : 0;
    const beforeDate = publishedBefore ? new Date(publishedBefore).getTime() : Infinity;

    return allItems.filter((item) => {
      const pubDate = new Date(item.publishedAt).getTime();
      return pubDate >= afterDate && pubDate <= beforeDate;
    });
  }

  return allItems;
}

// GET: Invidious 검색(0유닛) → YouTube 상세정보(1유닛/영상) → fallback YouTube 검색
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const publishedAfter = searchParams.get("publishedAfter");
  const publishedBefore = searchParams.get("publishedBefore");
  const maxPages = parseInt(searchParams.get("pages") || "2");

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

  // 캐시 확인
  const cacheKey = `${query}|${publishedAfter}|${publishedBefore}|${maxPages}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    let videoIds: string[];
    let searchSource: string;

    // 1차: Invidious로 검색 (할당량 0)
    const invidiousIds = await searchViaInvidious(
      query, publishedAfter, publishedBefore
    );

    if (invidiousIds && invidiousIds.length > 0) {
      videoIds = invidiousIds;
      searchSource = "invidious";
      console.log(`검색 소스: Invidious (${videoIds.length}개, 할당량 0)`);
    } else {
      // 2차: YouTube Search API fallback (100유닛/요청)
      videoIds = await searchViaYouTube(
        query, apiKey, publishedAfter, publishedBefore, maxPages
      );
      searchSource = "youtube";
      console.log(`검색 소스: YouTube API fallback (${videoIds.length}개)`);
    }

    if (videoIds.length === 0) {
      return NextResponse.json({ items: [], searchSource });
    }

    // YouTube Videos API로 상세 정보 (1유닛/영상)
    const allItems = await fetchVideoDetails(
      videoIds, apiKey, publishedAfter, publishedBefore
    );

    const responseData = {
      items: allItems,
      totalCount: allItems.length,
      searchSource, // 프론트에서 어떤 소스로 검색했는지 확인 가능
    };

    // 캐시 저장
    searchCache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("검색 API 에러:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "서버 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
