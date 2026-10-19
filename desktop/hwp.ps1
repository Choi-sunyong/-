# 싯다르타 ↔ 한글 다리. 한 줄에 JSON 명령 하나를 받아 한글 자동화(HWPFrame.HwpObject)로 실행하고, 결과를 JSON 한 줄로 돌려줌.
[Console]::InputEncoding  = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SdtWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetLong(IntPtr h, int i);
  [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW")] public static extern IntPtr SetLong(IntPtr h, int i, IntPtr v);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
"@
[void][SdtWin]::SetProcessDPIAware()
$script:embedded = [IntPtr]::Zero; $script:oldStyle = [IntPtr]::Zero
function Get-OwnWindow {
  # 이 스크립트를 띄운 싯다르타 프로그램의 창
  try {
    $pp = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
    $p = Get-Process -Id $pp -ErrorAction SilentlyContinue
    if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) { return $p.MainWindowHandle }
  } catch {}
  $q = Get-Process | Where-Object { $_.MainWindowTitle -like '*싯다르타*' -and $_.ProcessName -ne 'Hwp' } | Select-Object -First 1
  if ($q) { return $q.MainWindowHandle } else { return [IntPtr]::Zero }
}
function Get-HwpWindow {
  $p = Get-Process -Name 'Hwp' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Sort-Object StartTime -Descending | Select-Object -First 1
  if ($p) { return $p.MainWindowHandle } else { return [IntPtr]::Zero }
}
$script:hwp = $null

# 문서 폭에 맞춰 보기 (좁은 칸에 붙여도 글이 한눈에 들어오게)
function Fit-Width($h) {
  try { $p = $h.HParameterSet.HViewProperties; [void]$h.HAction.GetDefault('ViewZoom', $p.HSet); $p.ZoomType = 2; [void]$h.HAction.Execute('ViewZoom', $p.HSet) } catch {}
}

# 한컴 보안 모듈(FilePathCheckerModule.dll)을 내려받아 레지스트리에 등록 (한 번만)
function Ensure-Module {
  try {
    $dir = Join-Path $env:LOCALAPPDATA 'siddhartha'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $dll = Join-Path $dir 'FilePathCheckerModule.dll'
    if (-not (Test-Path $dll) -or (Get-Item $dll).Length -lt 100000) {
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -UseBasicParsing -Uri 'https://rosy-phi-35.vercel.app/desktop/FilePathCheckerModule.dll' -OutFile $dll
    }
    foreach ($k in @('HKCU:\Software\HNC\HwpAutomation\Modules', 'HKCU:\Software\Hnc\HwpUserAction\Modules')) {
      if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
      Set-ItemProperty -Path $k -Name 'FilePathCheckerModule' -Value $dll
    }
  } catch {}
}

function Get-Hwp {
  if ($script:hwp) {
    $alive = $false
    try { [void]$script:hwp.XHwpWindows.Count; $alive = $true } catch {}
    if ($alive) { return $script:hwp }
    $script:hwp = $null; $script:embedded = [IntPtr]::Zero
  }
  Ensure-Module
  $h = New-Object -ComObject 'HWPFrame.HwpObject'
  # 파일 열고 저장할 때마다 뜨는 "접근 허용" 창을 없애는 한컴 보안 모듈
  try { [void]$h.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule') } catch {}
  try { $h.XHwpWindows.Item(0).Visible = $true } catch {}
  $script:hwp = $h
  return $h
}
function Reply($id, $ok, $result, $err) {
  $o = [ordered]@{ id = $id; ok = $ok }
  if ($ok) { $o.result = $result } else { $o.error = "$err" }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress -Depth 6))
  [Console]::Out.Flush()
}
function Do-Find($h, $find) {
  # 문서 처음부터 찾아서 있는지만 확인
  [void]$h.MovePos(2)
  $act = $h.HAction; $p = $h.HParameterSet.HFindReplace
  [void]$act.GetDefault('ForwardFind', $p.HSet)
  $p.FindString = $find; $p.IgnoreMessage = 1; $p.Direction = 0; $p.MatchCase = 1; $p.FindRegExp = 0
  $ok = [bool]$act.Execute('ForwardFind', $p.HSet)
  try { [void]$h.Run('Cancel') } catch {}
  return $ok
}
function Do-Replace($h, $find, $repl) {
  $act = $h.HAction; $p = $h.HParameterSet.HFindReplace
  [void]$act.GetDefault('AllReplace', $p.HSet)
  $p.FindString = $find; $p.ReplaceString = $repl
  $p.IgnoreMessage = 1; $p.Direction = $h.FindDir('AllDoc'); $p.FindRegExp = 0; $p.MatchCase = 1
  return [bool]$act.Execute('AllReplace', $p.HSet)
}

function Run-Cmd($m) {
  # 창 위치만 다루는 명령은 한글 프로그램을 새로 띄우지 않음
  if (@('place', 'embed', 'unembed') -notcontains $m.cmd) { $h = Get-Hwp }
    switch ($m.cmd) {
    'ping'   { Reply $m.id $true @{ version = "$($h.Version)" } $null }
    'open'   { [void]$h.Open($m.path, 'HWPX', 'forceopen:true'); try { $h.XHwpWindows.Item(0).Visible = $true } catch {}; Fit-Width $h; Reply $m.id $true @{ path = $m.path } $null }
    'openPath' { [void]$h.Open($m.path, '', 'forceopen:true'); try { $h.XHwpWindows.Item(0).Visible = $true } catch {}; Fit-Width $h; Reply $m.id $true @{ path = $m.path } $null }
    'reload' {
      # 같은 문서를 새 내용으로 바꿔 끼움 (한글에서 직접 고친 건 사라짐)
      try { [void]$h.Clear(1) } catch {}
      [void]$h.Open($m.path, 'HWPX', 'forceopen:true'); Fit-Width $h
      Reply $m.id $true @{ path = $m.path } $null
    }
    'info'   { Reply $m.id $true @{ path = "$($h.Path)"; pages = $h.PageCount } $null }
    'text'   {
      $t = ''
      foreach ($f in @('UNICODE', 'TEXT')) { try { $t = "$($h.GetTextFile($f, ''))" } catch {}; if ($t.Trim()) { break } }
      Reply $m.id $true @{ text = $t } $null
    }
    'replace' {
      $done = @()
      foreach ($r in $m.pairs) {
        if (Do-Find $h $r.find) { [void](Do-Replace $h $r.find $r.replace); $done += ((-not (Do-Find $h $r.find)) -or ($r.replace -like "*$($r.find)*")) }
        else { $done += $false }
      }
      Reply $m.id $true @{ done = $done } $null
    }
    'insert' {
      $act = $h.HAction; $p = $h.HParameterSet.HInsertText
      [void]$act.GetDefault('InsertText', $p.HSet); $p.Text = $m.text
      [void]$act.Execute('InsertText', $p.HSet)
      Reply $m.id $true @{} $null
    }
    'paras' {
      # 문서 전체를 훑어 문단마다 위치(목록 l, 문단 p)와 글을 돌려줌 — 표 칸 안 문단도 포함
      $l0 = 0; $p0 = 0; $o0 = 0; try { $h.GetPos([ref]$l0, [ref]$p0, [ref]$o0) } catch {}
      $map = [ordered]@{}; $ctrlKeys = @{}
      [void]$h.InitScan(7, 0x77, 0, 0, -1, -1)
      $guard = 0
      while ($guard -lt 200000) {
        $guard++
        $t = ''; $st = $h.GetText([ref]$t)
        if ($st -le 1 -or $st -ge 100) { break }
        [void]$h.MovePos(201, 0, 0)
        $l = 0; $pp = 0; $o = 0; $h.GetPos([ref]$l, [ref]$pp, [ref]$o)
        $k = "$l,$pp"
        if (-not $map.Contains($k)) { $map[$k] = @{ l = $l; p = $pp; t = '' } }
        if ($st -eq 2) { $map[$k].t += $t }
        elseif ($st -eq 4) { $ctrlKeys[$k] = 1 }
      }
      try { $h.ReleaseScan() } catch {}
      try { [void]$h.SetPos($l0, $p0, $o0) } catch {}
      $list = @(); foreach ($k in $map.Keys) { $v = $map[$k]; $list += @{ l = $v.l; p = $v.p; t = ($v.t -replace "`r|`n", ''); c = [bool]$ctrlKeys[$k] } }
      Reply $m.id $true @{ list = $list } $null
    }
    'setPara' {
      # 한 문단을 새 글로 바꿈. typing이면 몇 글자씩 나눠 넣어 써지는 모습이 보이게. 여러 줄이면 문단을 나눔
      $ok = [bool]$h.SetPos([int]$m.l, [int]$m.p, 0)
      if (-not $ok) { Reply $m.id $false $null '자리를 찾지 못했어요.'; return }
      # 문단 끝 위치를 알아내 그 문단 글 전체를 골라 지움 (지우지 않고 앞에 덧붙던 문제)
      [void]$h.MovePos(7, 0, 0)
      $l2 = 0; $p2 = 0; $e = 0; $h.GetPos([ref]$l2, [ref]$p2, [ref]$e)
      $cleared = $true
      if ($l2 -eq [int]$m.l -and $p2 -eq [int]$m.p -and $e -gt 0) {
        [void]$h.SetPos([int]$m.l, [int]$m.p, 0)
        $sel = $false; try { $sel = [bool]$h.SelectText([int]$m.p, 0, [int]$m.p, $e) } catch {}
        if (-not $sel) { [void]$h.SetPos([int]$m.l, [int]$m.p, 0); try { [void]$h.Run('MoveSelParaEnd'); $sel = $true } catch {} }
        try { [void]$h.Run('Delete') } catch { $cleared = $false }
        $l3 = 0; $p3 = 0; $o3 = 0; $h.GetPos([ref]$l3, [ref]$p3, [ref]$o3); [void]$h.MovePos(7, 0, 0); $l4 = 0; $p4 = 0; $e4 = 0; $h.GetPos([ref]$l4, [ref]$p4, [ref]$e4)
        if ($e4 -gt 0) { $cleared = $false }
        [void]$h.SetPos([int]$m.l, [int]$m.p, 0)
      }
      if (-not $cleared) { Reply $m.id $false $null '원래 글을 지우지 못했어요.'; return }
      $act = $h.HAction; $ia = $h.HParameterSet.HInsertText
      $lines = ([string]$m.text) -split "`n"
      for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($i -gt 0) { [void]$h.Run('BreakPara') }
        $line = $lines[$i]
        $step = if ($m.typing) { 3 } else { [Math]::Max(1, $line.Length) }
        for ($j = 0; $j -lt $line.Length; $j += $step) {
          [void]$act.GetDefault('InsertText', $ia.HSet); $ia.Text = $line.Substring($j, [Math]::Min($step, $line.Length - $j))
          [void]$act.Execute('InsertText', $ia.HSet)
          if ($m.typing) { Start-Sleep -Milliseconds 15 }
        }
      }
      Reply $m.id $true @{ added = [int]($lines.Count - 1); cleared = $cleared } $null
    }
    'fillAfter' {
      # 표에서 이름 칸(예: '사례명')을 찾아 그 옆(또는 아래) 칸에 글을 넣음. 칸에 있던 글은 바꿔 씀
      $done = @()
      foreach ($r in $m.pairs) {
        $ok = $false
        try {
          $h.MovePos(2) | Out-Null
          $act = $h.HAction; $p = $h.HParameterSet.HFindReplace
          [void]$act.GetDefault('ForwardFind', $p.HSet)
          $p.FindString = $r.label; $p.IgnoreMessage = 1; $p.Direction = 0; $p.MatchCase = 1
          if ([bool]$act.Execute('ForwardFind', $p.HSet)) {
            [void]$h.Run('Cancel')
            if ($r.dir -eq 'down') { [void]$h.Run('TableLowerCell') } else { [void]$h.Run('TableRightCell') }
            [void]$h.Run('MoveListBegin'); [void]$h.Run('MoveSelListEnd'); try { [void]$h.Run('Delete') } catch {}
            $ia = $h.HParameterSet.HInsertText
            [void]$act.GetDefault('InsertText', $ia.HSet); $ia.Text = ($r.text -replace "`n", "`r`n")
            [void]$act.Execute('InsertText', $ia.HSet)
            $ok = $true
          }
        } catch {}
        $done += $ok
      }
      Reply $m.id $true @{ done = $done } $null
    }
    'place' {
      # 한글 창을 화면 오른쪽에 붙임 (싯다르타는 왼쪽)
      $w = [IntPtr]::Zero
      for ($k = 0; $k -lt 20 -and $w -eq [IntPtr]::Zero; $k++) { $w = Get-HwpWindow; if ($w -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 250 } }
      if ($w -eq [IntPtr]::Zero) { Reply $m.id $false $null '한글 창을 찾지 못했어요.' }
      else {
        [void][SdtWin]::ShowWindow($w, 9)
        [void][SdtWin]::SetWindowPos($w, [IntPtr]::Zero, [int]$m.x, [int]$m.y, [int]$m.w, [int]$m.h, 0x0040)
        Reply $m.id $true @{} $null
      }
    }
    'embed' {
      # 한글 창을 싯다르타 창 안의 빈 칸 위에 딱 맞춰 붙임 (제목 표시줄을 없애고, 싯다르타 창에 딸린 창으로)
      $w = $script:embedded
      if ($w -eq [IntPtr]::Zero -or -not [SdtWin]::IsWindow($w)) {
        $w = [IntPtr]::Zero
        for ($k = 0; $k -lt 20 -and $w -eq [IntPtr]::Zero; $k++) { $w = Get-HwpWindow; if ($w -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 250 } }
        if ($w -eq [IntPtr]::Zero) { Reply $m.id $false $null '한글 창을 찾지 못했어요.'; return }
        $script:oldStyle = [SdtWin]::GetLong($w, -16)
        $st = [Int64]$script:oldStyle -band (-bnot [Int64]0x00CF0000)   # 제목줄·테두리·최소/최대 버튼 빼기
        [void][SdtWin]::SetLong($w, -16, [IntPtr]$st)
        $own = Get-OwnWindow
        if ($own -ne [IntPtr]::Zero) { [void][SdtWin]::SetLong($w, -8, $own) }
        [void][SdtWin]::ShowWindow($w, 9)
        $script:embedded = $w
      }
      [void][SdtWin]::SetWindowPos($w, [IntPtr]::Zero, [int]$m.x, [int]$m.y, [int]$m.w, [int]$m.h, 0x0020 -bor 0x0040 -bor 0x0010)
      Reply $m.id $true @{} $null
    }
    'unembed' {
      $w = $script:embedded
      if ($w -eq [IntPtr]::Zero -or -not [SdtWin]::IsWindow($w)) {
        # 싯다르타를 새로고침하면 붙여 둔 기록이 사라짐 → 제목줄 없는 한글 창을 찾아서 되돌림
        $w = Get-HwpWindow
        if ($w -ne [IntPtr]::Zero -and (([Int64][SdtWin]::GetLong($w, -16)) -band 0x00C00000) -ne 0) { $w = [IntPtr]::Zero }
      }
      if ($w -ne [IntPtr]::Zero -and [SdtWin]::IsWindow($w)) {
        [void][SdtWin]::SetLong($w, -8, [IntPtr]::Zero)
        if ($script:oldStyle -ne [IntPtr]::Zero) { [void][SdtWin]::SetLong($w, -16, $script:oldStyle) }
        else { [void][SdtWin]::SetLong($w, -16, [IntPtr](([Int64][SdtWin]::GetLong($w, -16)) -bor 0x00CF0000)) }
        [void][SdtWin]::SetWindowPos($w, [IntPtr]::Zero, 0, 0, 0, 0, 0x0020 -bor 0x0001 -bor 0x0002 -bor 0x0004)
        if ($m.hide) { [void][SdtWin]::ShowWindow($w, 6) }
      }
      $script:embedded = [IntPtr]::Zero
      Reply $m.id $true @{} $null
    }
    'openB64' {
      # 양식 파일(hwp·hwpx·pdf)을 임시 폴더에 풀어서 한글로 엶 (PDF는 한글이 변환해서 엶)
      $dir = Join-Path $env:TEMP 'siddhartha'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
      $f = Join-Path $dir ($m.name -replace '[\\/:*?"<>|]', ' ')
      [IO.File]::WriteAllBytes($f, [Convert]::FromBase64String($m.b64))
      [void]$h.Open($f, '', 'forceopen:true;versionwarning:false')
      try { $h.XHwpWindows.Item(0).Visible = $true } catch {}
      Reply $m.id $true @{ path = $f } $null
    }
    'toHwpx' {
      # 양식(hwp·pdf)을 한글로 열어 hwpx로 바꿔 돌려줌 (표 모양까지 그대로 읽으려고)
      $dir = Join-Path $env:TEMP 'siddhartha'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
      $f = Join-Path $dir ($m.name -replace '[\\/:*?"<>|]', ' ')
      [IO.File]::WriteAllBytes($f, [Convert]::FromBase64String($m.b64))
      [void]$h.Open($f, '', 'forceopen:true;versionwarning:false')
      $o = Join-Path $dir ([IO.Path]::GetFileNameWithoutExtension($f) + '_sdt.hwpx')
      if (Test-Path $o) { Remove-Item $o -Force }
      [void]$h.SaveAs($o, 'HWPX', '')
      $b = [Convert]::ToBase64String([IO.File]::ReadAllBytes($o))
      try { [void]$h.Clear(1) } catch {}
      Reply $m.id $true @{ b64 = $b } $null
    }
    'saveDocs' {
      # 내 문서\싯다르타 폴더에 한글 파일로 저장 (같은 이름이 있으면 덮어씀)
      $dir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) '싯다르타'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
      $f = Join-Path $dir (($m.name -replace '[\\/:*?"<>|]', ' ').Trim() + '.hwp')
      [void]$h.SaveAs($f, 'HWP', '')
      Reply $m.id $true @{ path = $f } $null
    }
    'fields' { Reply $m.id $true @{ list = "$($h.GetFieldList(0, 0))" } $null }
    'putFields' { $h.PutFieldText($m.names, $m.values); Reply $m.id $true @{} $null }
    'fit'    { Fit-Width $h; Reply $m.id $true @{} $null }
    'save'   { [void]$h.Save($true); Reply $m.id $true @{} $null }
    default  { Reply $m.id $false $null "모르는 명령: $($m.cmd)" }
  }

}
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if (-not $line.Trim()) { continue }
  $m = $null
  try {
    $m = $line | ConvertFrom-Json
    try { Run-Cmd $m }
    catch {
      # 한글을 닫았다 다시 열면 예전 연결이 끊김(RPC 서버 사용 불가) → 새로 연결해서 한 번 더
      if ("$($_.Exception.Message)" -match '800706BA|800706BE|80010108|80010012|RPC|연결') { $script:hwp = $null; $script:embedded = [IntPtr]::Zero; Run-Cmd $m } else { throw }
    }
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match '80040154|REGDB_E_CLASSNOTREG|클래스가 등록') { $msg = '한글(한컴오피스)이 설치되어 있지 않거나 자동화 기능이 꺼져 있어요.' }
    Reply ($(if ($m) { $m.id } else { 0 })) $false $null $msg
  }
}
