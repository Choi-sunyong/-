// 빌드 뒤 실행 파일(싯다르타.exe)에 아이콘을 넣음 — 순수 JS(resedit)라 윈도우·리눅스 어디서 빌드해도 됨.
// signAndEditExecutable:false(코드 서명 도구 다운로드 문제로 꺼 둠)라서 electron-builder가 아이콘을 안 넣어 주고,
// 그러면 바로가기·작업 표시줄에 Electron 기본 아이콘(원자 모양)이 보였음.
const path = require('path'), fs = require('fs');
exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit');
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  const data = fs.readFileSync(exe);
  const pe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(pe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: '싯다르타', FileDescription: '싯다르타' });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
};
