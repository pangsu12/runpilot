// Design Ref: §7.6 — 대회 장소는 입력한 글에서 "시·도 단위"만 뽑아 AI에 보낸다. 세부 주소·장소 이름은 보내지 않는다.

/** 시·도 이름과, 입력에서 알아볼 수 있는 표기들 */
const REGIONS: ReadonlyArray<{ name: string; aliases: readonly string[] }> = [
  { name: "서울", aliases: ["서울특별시", "서울시", "서울"] },
  { name: "부산", aliases: ["부산광역시", "부산시", "부산"] },
  { name: "대구", aliases: ["대구광역시", "대구시", "대구"] },
  { name: "인천", aliases: ["인천광역시", "인천시", "인천"] },
  { name: "광주", aliases: ["광주광역시", "광주시", "광주"] },
  { name: "대전", aliases: ["대전광역시", "대전시", "대전"] },
  { name: "울산", aliases: ["울산광역시", "울산시", "울산"] },
  { name: "세종", aliases: ["세종특별자치시", "세종시", "세종"] },
  { name: "경기", aliases: ["경기도", "경기"] },
  { name: "강원", aliases: ["강원특별자치도", "강원도", "강원"] },
  { name: "충북", aliases: ["충청북도", "충북"] },
  { name: "충남", aliases: ["충청남도", "충남"] },
  { name: "전북", aliases: ["전북특별자치도", "전라북도", "전북"] },
  { name: "전남", aliases: ["전라남도", "전남"] },
  { name: "경북", aliases: ["경상북도", "경북"] },
  { name: "경남", aliases: ["경상남도", "경남"] },
  { name: "제주", aliases: ["제주특별자치도", "제주도", "제주"] },
];

/**
 * 장소 글에서 시·도 이름 하나를 찾아 돌려준다. 못 찾으면 null(지역 정보 없이 보낸다).
 * 가장 앞에 나온 시·도를 쓴다. 예) "서울 여의도 공원" → "서울"
 */
export function regionFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  let best: { index: number; name: string } | null = null;
  for (const region of REGIONS) {
    for (const alias of region.aliases) {
      const index = location.indexOf(alias);
      if (index !== -1 && (best === null || index < best.index)) best = { index, name: region.name };
    }
  }
  return best?.name ?? null;
}
