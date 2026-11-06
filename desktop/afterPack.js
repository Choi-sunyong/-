// 빌드 뒤 실행 파일(싯다르타.exe)에 싯 아이콘을 넣음.
// signAndEditExecutable:false(코드 서명 도구 다운로드 문제로 꺼 둠)라서 electron-builder가 아이콘을 안 넣어 주고,
// 그러면 바로가기·작업 표시줄에 Electron 기본 아이콘(원자 모양)이 보였음.
const path = require('path');
exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;
  const mod = require('rcedit');
  const rcedit = mod.rcedit || mod.default || mod;
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  await rcedit(exe, {
    icon: path.join(__dirname, 'icon.ico'),
    'version-string': { ProductName: '싯다르타', FileDescription: '싯다르타' }
  });
};
