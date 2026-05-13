import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 분석 프롬프트
const ANALYSIS_PROMPT = `아래 유튜브 영상 정보들을 분석해서 각 영상별로 JSON 배열 형식으로만 답변해주세요.
다른 텍스트 없이 순수 JSON만 출력하세요. 마크다운 코드블록도 사용하지 마세요.

[
  {
    "videoUrl": "영상 URL",
    "adStatus": "광고임 또는 광고아님 또는 판별못함",
    "productName": "리뷰 대상 제품명 (없으면 해당없음)",
    "contentType": "단일리뷰 또는 비교리뷰 또는 기타",
    "insight": "영상의 핵심 메시지 요약 (2-3문장)"
  }
]

광고 판별 기준:
- 영상 제목/설명에 "유료광고", "협찬", "제공", "AD", "Sponsored" 등 포함 여부
- 자막 내용에서 광고 관련 발화 탐지 ("이 영상은 OO의 지원을 받아", "협찬" 등)
- 확실하지 않으면 "판별못함"으로 표시

제품 분석 기준:
- 어떤 기기/제품에 대한 리뷰인지 정확한 제품명과 모델명 포함
- 비교 영상인 경우 각 제품별 장단점을 보수적으로 분석
- 스펙과 장단점이 정확히 매칭되어야 함`;

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

    // 자막이 너무 길면 앞뒤 잘라서 핵심만 (토큰 절약 + 속도 향상)
    if (transcript.length > 3000) {
      return transcript.slice(0, 1500) + " ... " + transcript.slice(-1500);
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
    const { videoUrls, videoMeta } = body as {
      videoUrls: string[];
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

    // 3. Gemini API 호출
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(
      `${ANALYSIS_PROMPT}\n\n--- 분석할 영상 목록 ---\n\n${videoInfoText}`
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
