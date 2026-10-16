# 싯다르타 ↔ 한글 다리. 한 줄에 JSON 명령 하나를 받아 한글 자동화(HWPFrame.HwpObject)로 실행하고, 결과를 JSON 한 줄로 돌려줌.
[Console]::InputEncoding  = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'
$script:hwp = $null

function Get-Hwp {
  if ($script:hwp) { try { [void]$script:hwp.Version; return $script:hwp } catch { $script:hwp = $null } }
  $h = New-Object -ComObject 'HWPFrame.HwpObject'
  # 파일 열 때마다 뜨는 "접근 허용" 창을 줄이는 보안 모듈 (없으면 그냥 넘어감)
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
function Do-Replace($h, $find, $repl) {
  $act = $h.HAction; $p = $h.HParameterSet.HFindReplace
  [void]$act.GetDefault('AllReplace', $p.HSet)
  $p.FindString = $find; $p.ReplaceString = $repl
  $p.IgnoreMessage = 1; $p.Direction = $h.FindDir('AllDoc'); $p.FindRegExp = 0; $p.MatchCase = 1
  return [bool]$act.Execute('AllReplace', $p.HSet)
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if (-not $line.Trim()) { continue }
  $m = $null
  try {
    $m = $line | ConvertFrom-Json
    $h = Get-Hwp
    switch ($m.cmd) {
      'ping'   { Reply $m.id $true @{ version = "$($h.Version)" } $null }
      'open'   { [void]$h.Open($m.path, 'HWPX', 'forceopen:true'); try { $h.XHwpWindows.Item(0).Visible = $true } catch {}; Reply $m.id $true @{ path = $m.path } $null }
      'openPath' { [void]$h.Open($m.path, '', 'forceopen:true'); try { $h.XHwpWindows.Item(0).Visible = $true } catch {}; Reply $m.id $true @{ path = $m.path } $null }
      'reload' {
        # 같은 문서를 새 내용으로 바꿔 끼움 (한글에서 직접 고친 건 사라짐)
        try { [void]$h.Clear(1) } catch {}
        [void]$h.Open($m.path, 'HWPX', 'forceopen:true')
        Reply $m.id $true @{ path = $m.path } $null
      }
      'info'   { Reply $m.id $true @{ path = "$($h.Path)"; pages = $h.PageCount } $null }
      'text'   { Reply $m.id $true @{ text = "$($h.GetTextFile('TEXT', ''))" } $null }
      'replace' {
        $done = @()
        foreach ($r in $m.pairs) { $done += [bool](Do-Replace $h $r.find $r.replace) }
        Reply $m.id $true @{ done = $done } $null
      }
      'insert' {
        $act = $h.HAction; $p = $h.HParameterSet.HInsertText
        [void]$act.GetDefault('InsertText', $p.HSet); $p.Text = $m.text
        [void]$act.Execute('InsertText', $p.HSet)
        Reply $m.id $true @{} $null
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
      'fields' { Reply $m.id $true @{ list = "$($h.GetFieldList(0, 0))" } $null }
      'putFields' { $h.PutFieldText($m.names, $m.values); Reply $m.id $true @{} $null }
      'save'   { [void]$h.Save($true); Reply $m.id $true @{} $null }
      default  { Reply $m.id $false $null "모르는 명령: $($m.cmd)" }
    }
  } catch {
    $msg = $_.Exception.Message
    if ($msg -match '80040154|REGDB_E_CLASSNOTREG|클래스가 등록') { $msg = '한글(한컴오피스)이 설치되어 있지 않거나 자동화 기능이 꺼져 있어요.' }
    Reply ($(if ($m) { $m.id } else { 0 })) $false $null $msg
  }
}
