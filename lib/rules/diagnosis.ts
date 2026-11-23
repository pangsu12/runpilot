// Design Ref: §7.5 — 진단이나 병명을 단정하는 표현은 쓰지 않는다. (PRD M1·M2)
// AI가 만든 계획 설명 글에 이런 표현이 있으면 계획 검증에서 걸러낸다.
// 이 목록은 임시안이며 완벽하지 않다. 새로 발견한 표현은 여기에 추가하고, 공개 전에 전문가 검토를 받는다.

/** 병명·질환 이름 (단정하면 안 되는 것들). 임시 목록이다. */
const DISEASE_TERMS = [
  "심장병",
  "부정맥",
  "협심증",
  "심근경색",
  "심장마비",
  "관절염",
  "피로골절",
  "건염",
  "근막염",
  "디스크",
  "염좌",
  "인대 파열",
  "질환",
];

const PATTERNS: RegExp[] = [
  // "진단합니다", "진단됩니다" 처럼 진단을 내리는 서술 ("의학적 진단이 아닙니다"는 걸리지 않는다)
  /진단(합니다|됩니다|했습니다|한다|된다|을 내립니다|을 내렸습니다)/g,
  // "~로 진단"
  /(으로|로) 진단/g,
  // 병명 + 단정하는 끝맺음 ("부정맥입니다", "염좌로 보입니다")
  new RegExp(
    `(${DISEASE_TERMS.join("|")})(입니다|이에요|이다|으로 보입니다|으로 판단됩니다|이 확실합니다)`,
    "g",
  ),
];

/** 글 안에서 진단·병명을 단정하는 표현을 찾아 돌려준다. 없으면 빈 목록이다. */
export function findDiagnosisAssertions(text: string): string[] {
  const found: string[] = [];
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern)) found.push(match[0]);
  }
  return found;
}
