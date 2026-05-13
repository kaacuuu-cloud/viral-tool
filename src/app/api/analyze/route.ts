import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 검색어 기반 동적 분석 프롬프트 생성
function buildAnalysisPrompt(searchQuery: string): string {
  return `너는 유튜브 영상 콘텐츠 분석 전문가야.
사용자가 "${searchQuery}"를 검색했어. 이 주제에 관심 있는 사람이 진짜 알고 싶어하는 실질적인 정보를 자막과 영상 정보에서 최대한 구체적으로 뽑아줘.

아래 영상들을 각각 분석해서 JSON 배열로만 답변해. 다른 텍스트 없이 순수 JSON만 출력해. 마크다운 코드블록도 쓰지 마.

[
  {
    "videoUrl": "영상 URL",
    "adStatus": "광고임 / 광고아님 / 판별못함",
    "contentType": "영상 유형 (브이로그, 리뷰, 가이드, 비교, 언박싱, 튜토리얼, 기타 등)",
    "keyInfo": [
      "자막에서 추출한 핵심 정보 1 (구체적 숫자/이름/장소 포함)",
      "핵심 정보 2",
      "핵심 정보 3",
      "..."
    ],
    "pros": ["영상에서 언급된 긍정적 포인트들"],
    "cons": ["영상에서 언급된 부정적 포인트 / 주의사항"],
    "insight": "이 영상의 핵심 결론 또는 추천 포인트 (1-2문장)"
  }
]

핵심 분석 규칙:
1. keyInfo는 자막 내용에서 뽑은 실질 정보여야 해. 예시:
   - 여행: 비용(항공/숙소/식비), 일정, 호텔명, 항공사, 꿀팁, 추천 장소, 주의사항
   - 제품: 제품명, 모델명, 가격, 스펙, 사용감, 비교 대상
   - 맛집: 가게명, 위치, 메뉴, 가격대, 웨이팅, 추천 메뉴
   - 기타: 해당 주제에서 시청자가 의사결정에 필요한 구체적 사실
2. "이 영상은 ~에 대한 영상입니다" 같은 뻔한 요약은 절대 금지. 자막에 나온 구체적 팩트만 추출
3. 숫자, 금액, 날짜, 고유명사가 있으면 반드시 포함
4. 자막이 없거나 정보가 부족하면 제목/설명에서라도 추출하고, 정보가 정말 없으면 "정보 부족"으로 표시
5. keyInfo는 최소 3개, 최대 10개까지 뽑아줘

광고 판별 기준:
- 제목/설명에 "유료광고", "협찬", "제공", "AD", "Sponsored", "내돈내산" 등
- 자막에서 "지원을 받아", "협찬", "제공받은" 등 발화 탐지
- 확실하지 않으면 "판별못함"`;
}

// 유튜브 자막 추출 (YouTube의 timedtext API 활용)
async function fetchTranscript(videoId: string): Promise<string> {
  try {
    // 영상 페이지에서 자막 데이터 URL 추출
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
      }
    );
    const html = await pageRes.text();

    // captionTracks에서 자막 URL 추출
    const captionMatch = html.match(
      /"captionTracks":\s*(\[.*?\])/
    );
    if (!captionMatch) return "(자막 없음)";

    const tracks = JSON.parse(captionMatch[1]);
    // 한국어 자막 우선, 없으면 첫 번째 자막
    const koTrack = tracks.find(
      (t: { languageCode: string }) =>
        t.languageCode === "ko" || t.languageCode === "ko-KR"
    );
    const track = koTrack || tracks[0];
    if (!track?.baseUrl) return "(자막 없음)";

    // 자막 XML 가져오기
    const captionRes = await fetch(track.baseUrl);
    const xml = await captionRes.text();

    // XML에서 텍스트만 추출
    const textParts = xml.match(/<text[^>]*>(.*?)<\/text>/g);
    if (!textParts) return "(자막 없음)";

    const transcript = textParts
      .map((part) =>
        part
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
      )
      .join(" ");

    // 자막이 너무 길면 앞뒤 + 중간 잘라서 핵심만 (토큰 절약 + 정보 손실 최소화)
    if (transcript.length > 6000) {
      const third = Math.floor(transcript.length / 3);
      return (
        transcript.slice(0, 2000) +
        " ... " +
        transcript.slice(third, third + 2000) +
        " ... " +
        transcript.slice(-2000)
      );
    }
    return transcript;
  } catch {
    return "(자막 추출 실패)";
  }
}

// 영상 URL에서 videoId 추출
function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// 응답에서 JSON 배열 추출
function parseResponse(text: string): object[] | null {
  try {
    // 마크다운 코드블록 제거
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // 배열 부분만 추출 시도
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// POST: 영상 URL들을 받아서 Gemini API로 분석
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoUrls, videoMeta, searchQuery } = body as {
      videoUrls: string[];
      searchQuery?: string;
      videoMeta?: {
        title: string;
        channelTitle: string;
        description: string;
        url: string;
      }[];
    };

    if (!videoUrls || videoUrls.length === 0) {
      return NextResponse.json(
        { error: "분석할 영상 URL이 필요합니다" },
        { status: 400 }
      );
    }

    if (videoUrls.length > 50) {
      return NextResponse.json(
        { error: "최대 50개까지 분석 가능합니다" },
        { status: 400 }
      );
    }

    // 1. 각 영상의 자막 추출
    const transcripts = await Promise.all(
      videoUrls.map(async (url, i) => {
        const videoId = extractVideoId(url);
        if (!videoId) return { url, transcript: "(URL 파싱 실패)" };

        const transcript = await fetchTranscript(videoId);
        const meta = videoMeta?.[i];

        return {
          url,
          title: meta?.title || "",
          channel: meta?.channelTitle || "",
          description: meta?.description || "",
          transcript,
        };
      })
    );

    // 2. Gemini에 전달할 영상 정보 텍스트 구성
    const videoInfoText = transcripts
      .map(
        (t, i) =>
          `[영상 ${i + 1}]\nURL: ${t.url}\n제목: ${t.title}\n채널: ${t.channel}\n설명: ${t.description}\n자막: ${t.transcript}`
      )
      .join("\n\n---\n\n");

    // 3. Gemini API 호출 — 검색어 기반 동적 프롬프트
    const prompt = buildAnalysisPrompt(searchQuery || "일반 콘텐츠");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(
      `${prompt}\n\n--- 분석할 영상 목록 ---\n\n${videoInfoText}`
    );
    const responseText = result.response.text();

    // 4. JSON 파싱
    const parsed = parseResponse(responseText);

    if (!parsed) {
      return NextResponse.json({
        success: true,
        analysis: [{ rawResponse: responseText, parseError: true }],
        totalVideos: videoUrls.length,
      });
    }

    return NextResponse.json({
      success: true,
      analysis: parsed,
      totalVideos: videoUrls.length,
    });
  } catch (error) {
    console.error("분석 API 에러:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "분석 중 오류가 발생했습니다",
      },
      { status: 500 }
    );
  }
}
