// 올리기(push) 전에 돌리는 검사: node scripts/check.mjs
// 1) 모든 html 안의 <script> 문법 오류  2) 같은 이름의 최상위 함수가 두 번 정의됐는지(나중 것이 앞의 것을 덮어써서 기능이 조용히 바뀜)
import { readFileSync, readdirSync } from "node:fs";
const files = ["index.html", "student.html", "choiseongbo.html", "rename.html", ...readdirSync("games").filter(f => f.endsWith(".html")).map(f => "games/" + f)];
let bad = 0;
for (const f of files) {
  let src; try { src = readFileSync(f, "utf8"); } catch { continue; }
  const scripts = [...src.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => !/type=["'](module|application\/(ld\+)?json|text\/template)/i.test(m[1])).map(m => m[2]);
  scripts.forEach((code, i) => { try { new Function(code); } catch (e) { bad++; console.log(`✗ ${f} 스크립트 #${i + 1}: ${e.message}`); } });
  const names = {}; scripts.join("\n").replace(/^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm, (_, n) => { names[n] = (names[n] || 0) + 1; });
  const dup = Object.entries(names).filter(([k, n]) => n > 1 && !["doGet", "doPost"].includes(k))   // doGet·doPost는 화면에 보여 주는 Apps Script 예시 글.map(([k]) => k);
  if (dup.length) { bad++; console.log(`✗ ${f} 같은 이름 함수가 여러 번 정의됨: ${dup.join(", ")}`); }
}
console.log(bad ? `\n문제 ${bad}건 — 고친 뒤 올리세요.` : "✓ 문법·중복 함수 검사 통과");
process.exit(bad ? 1 : 0);
