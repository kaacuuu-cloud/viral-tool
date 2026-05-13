# Viral Tool UI 디자인 가이드

> 참고: [midday.ai](https://midday.ai) 디자인 스타일 기반
> 키워드: **다크 모드, 모노크롬, 미니멀, 클린 타이포그래피, 블러 효과**

---

## 1. 전체 톤앤무드

- **다크 모드 기본** — 거의 검은색(#0C0C0C) 배경에 밝은 텍스트
- **모노크롬** — 흰/회/검 3톤 위주, 컬러는 최소한으로
- **미니멀** — 불필요한 장식 제거, 콘텐츠에 집중
- **넓은 여백** — 요소 간 공간을 넉넉하게
- **부드러운 전환** — 호버/상태 변화에 섬세한 애니메이션
- **글래스모피즘** — 반투명 + backdrop-blur 네비게이션

---

## 2. 색상 팔레트

### 배경
| 용도 | 색상 | Hex |
|------|------|-----|
| 메인 배경 | 거의 검은색 | `#0C0C0C` |
| 카드/섹션 배경 | 진한 회색 | `#1A1A1A` |
| 보조 배경 | 어두운 회색 | `#1D1D1D` |
| 인풋/필드 배경 | 미세 회색 | `#131313` |
| 호버 배경 | 약간 밝은 회색 | `#252525` |

### 텍스트
| 용도 | 색상 | Hex |
|------|------|-----|
| 제목 (H1, H2) | 흰색 | `#EDEDED` |
| 본문 | 밝은 회색 | `#A1A1A1` |
| 보조 텍스트 | 뮤트 그레이 | `#878787` |
| 비활성/플레이스홀더 | 어두운 회색 | `#707070` |
| 강조 텍스트 | 순백 | `#FFFFFF` |

### 포인트/액센트 (극도로 절제)
| 용도 | 색상 | Hex |
|------|------|-----|
| 링크/액션 | 블루 | `#0064D9` |
| 성공/긍정 | 그린 | `#4CAF50` |
| 에러/경고 | 레드 | `#FF3638` |

### 보더/구분선
| 용도 | 색상 | Hex |
|------|------|-----|
| 카드 테두리 | 미세 보더 | `#2A2A2A` |
| 구분선 | 연한 보더 | `#1F1F1F` |
| 호버 보더 | 밝은 보더 | `#3A3A3A` |

---

## 3. 타이포그래피

### 폰트
- **주 폰트**: `"Geist Sans"`, `"Inter"`, 또는 시스템 산세리프
- **보조 (숫자/데이터)**: `"Geist Mono"` 또는 모노스페이스
- **Fallback**: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

### 크기 계층
| 요소 | 크기 | 굵기 | 자간 |
|------|------|------|------|
| 히어로 제목 (H1) | 48~60px | 500 (Medium) | -0.025em |
| 섹션 제목 (H2) | 30~36px | 500 (Medium) | -0.02em |
| 카드 제목 (H3) | 18~20px | 500 (Medium) | -0.01em |
| 본문 | 15~16px | 400 (Regular) | 0 |
| 보조 텍스트 | 13~14px | 400 (Regular) | 0 |
| 캡션/라벨 | 11~12px | 500 (Medium) | 0.03em |

> midday 특징: 제목도 medium(500) 굵기 — 두껍지 않고 세련된 느낌

### 줄높이
- 제목: `1.1 ~ 1.25`
- 본문: `1.5 ~ 1.6`
- 캡션: `1.4`

---

## 4. 버튼 스타일

### Primary
```css
background: #EDEDED;
color: #0C0C0C;
padding: 10px 24px;
border-radius: 8px;
font-weight: 500;
font-size: 14px;
border: none;
transition: all 0.15s ease;

/* 호버 */
background: #FFFFFF;
transform: scale(1.02);
```

### Secondary
```css
background: #1A1A1A;
color: #EDEDED;
padding: 10px 24px;
border-radius: 8px;
font-weight: 500;
font-size: 14px;
border: 1px solid #2A2A2A;
transition: all 0.15s ease;

/* 호버 */
background: #252525;
border-color: #3A3A3A;
```

### Ghost / 텍스트 버튼
```css
background: transparent;
color: #878787;
padding: 8px 12px;
border-radius: 6px;
font-weight: 400;
font-size: 14px;

/* 호버 */
color: #EDEDED;
background: rgba(255, 255, 255, 0.05);
```

### Destructive (삭제/에러)
```css
background: rgba(255, 54, 56, 0.1);
color: #FF3638;
border: 1px solid rgba(255, 54, 56, 0.2);
```

---

## 5. 카드 / 컨테이너

### 기본 카드
```css
background: #1A1A1A;
border: 1px solid #2A2A2A;
border-radius: 12px;
padding: 24px;
transition: all 0.2s ease;

/* 호버 */
border-color: #3A3A3A;
background: #1D1D1D;
```

### 선택된/활성 카드
```css
border: 1px solid #4CAF50;
background: rgba(76, 175, 80, 0.05);
```

### 데이터 카드 (숫자/통계)
```css
background: #131313;
border: 1px solid #1F1F1F;
border-radius: 12px;
padding: 20px;
```

---

## 6. 간격 / 여백 시스템

4px 단위 기반:

| 이름 | 값 | 용도 |
|------|-----|------|
| xs | 4px | 인라인 요소 간격 |
| sm | 8px | 아이콘-텍스트, 태그 간격 |
| md | 16px | 카드 내부 요소 간격 |
| lg | 24px | 카드 패딩, 그룹 간격 |
| xl | 32px | 섹션 내 블록 간격 |
| 2xl | 48px | 섹션 타이틀-콘텐츠 |
| 3xl | 80px | 섹션 간 간격 |
| 4xl | 120px | 히어로-메인 콘텐츠 |

### 컨테이너
```css
max-width: 1200px;
padding: 0 24px;
margin: 0 auto;
```

---

## 7. 네비게이션 바

```css
position: sticky;
top: 0;
z-index: 40;
background: rgba(12, 12, 12, 0.8);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border-bottom: 1px solid #1F1F1F;
padding: 12px 24px;
```

- 로고: 좌측, 흰색/밝은 톤
- 메뉴: 중앙 또는 우측, #878787 → 호버 시 #EDEDED
- CTA: 우측 끝, Primary 버튼 스타일

---

## 8. 태그 / 배지

```css
/* 기본 태그 */
background: rgba(255, 255, 255, 0.06);
color: #878787;
padding: 4px 10px;
border-radius: 6px;
font-size: 12px;
font-weight: 500;
border: 1px solid #2A2A2A;

/* 긍정 (광고아님) */
background: rgba(76, 175, 80, 0.1);
color: #4CAF50;
border-color: rgba(76, 175, 80, 0.2);

/* 부정 (광고임) */
background: rgba(255, 54, 56, 0.1);
color: #FF3638;
border-color: rgba(255, 54, 56, 0.2);

/* 중립 (판별못함) */
background: rgba(255, 255, 255, 0.04);
color: #707070;
border-color: #2A2A2A;
```

---

## 9. 테이블 (분석 결과)

```css
/* 테이블 컨테이너 */
background: #131313;
border: 1px solid #1F1F1F;
border-radius: 12px;
overflow: hidden;

/* 헤더 행 */
background: #1A1A1A;
color: #707070;
font-size: 12px;
font-weight: 500;
letter-spacing: 0.05em;
text-transform: uppercase;
padding: 12px 16px;
border-bottom: 1px solid #1F1F1F;

/* 데이터 행 */
color: #A1A1A1;
font-size: 14px;
padding: 14px 16px;
border-bottom: 1px solid #1A1A1A;
transition: background 0.1s ease;

/* 행 호버 */
background: #1A1A1A;

/* 강조 셀 (제품명 등) */
color: #EDEDED;
font-weight: 500;
```

---

## 10. 입력 필드

```css
background: #131313;
border: 1px solid #2A2A2A;
border-radius: 8px;
padding: 12px 16px;
font-size: 15px;
color: #EDEDED;
transition: all 0.15s ease;

/* 포커스 */
border-color: #3A3A3A;
box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.06);
outline: none;

/* 플레이스홀더 */
color: #707070;
```

---

## 11. 분석 중 오버레이

```css
/* 배경 */
background: rgba(0, 0, 0, 0.7);
backdrop-filter: blur(8px);

/* 모달 카드 */
background: #1A1A1A;
border: 1px solid #2A2A2A;
border-radius: 16px;
padding: 40px;

/* 스피너 */
border: 3px solid #2A2A2A;
border-top-color: #EDEDED;
width: 40px;
height: 40px;

/* 텍스트 */
color: #EDEDED;  /* 제목 */
color: #878787;  /* 부제 */
```

---

## 12. 애니메이션

```css
/* 페이드인 + 블러 (페이지 진입) */
@keyframes fadeInBlur {
  from { opacity: 0; filter: blur(8px); }
  to { opacity: 1; filter: blur(0); }
}
animation: fadeInBlur 0.35s ease-out;

/* 스케일 페이드인 (카드 등장) */
@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
animation: fadeInScale 0.4s ease-out;

/* 기본 트랜지션 */
transition: all 0.15s ease;  /* 빠른 반응 */
transition: all 0.3s ease;   /* 부드러운 전환 */
```

---

## 13. Viral Tool 적용 우선순위

1. **다크 모드 전환** — 배경 #0C0C0C, 텍스트 #EDEDED
2. **색상 단순화** — 파란색/빨간색 제거, 모노크롬 + 미세 액센트
3. **border-radius** — 8~12px 통일 (지금보다 약간 작게)
4. **보더 스타일** — 그림자 대신 미세한 border(#2A2A2A)로 구분
5. **네비게이션** — 글래스모피즘(반투명 + blur)
6. **폰트** — Geist Sans 또는 Inter, medium(500) 중심
7. **여백 확대** — 전반적으로 더 넓게
8. **태그/배지** — 반투명 배경 + 컬러 텍스트 방식
