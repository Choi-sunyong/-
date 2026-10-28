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
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c);
  [StructLayout(LayoutKind.Sequential)] public struct PT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref PT p);
  [StructLayout(LayoutKind.Sequential)] public struct RC { public int L; public int T; public int R; public int B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RC r, int sz);
}
"@
# GOE 메신저 쪽지 자동 작성(급식지도 예약 전송): 메신저 창의 컨트롤 번호로 글 넣고, 달력·드롭다운은 실제 클릭
Add-Type -TypeDefinition @"
using System;using System.Text;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class GoeW{
 public delegate bool EP(IntPtr h,IntPtr l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageW")] public static extern IntPtr SendStr(IntPtr h,int m,IntPtr w,string l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageW")] public static extern IntPtr SendSb(IntPtr h,int m,IntPtr w,StringBuilder l);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EP f,IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p,EP f,IntPtr l);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 public struct RECT{public int L,T,R,B;}
 public static string Text(IntPtr h){var sb=new StringBuilder(8192);SendSb(h,0x0D,(IntPtr)8192,sb);return sb.ToString();}
 public static string Cls(IntPtr h){var sb=new StringBuilder(256);GetClassName(h,sb,256);return sb.ToString();}
 public static List<IntPtr> Tops(){var l=new List<IntPtr>();EP f=(h,p)=>{l.Add(h);return true;};EnumWindows(f,IntPtr.Zero);GC.KeepAlive(f);return l;}
 public static List<IntPtr> Kids(IntPtr p){var l=new List<IntPtr>();EP f=(h,x)=>{l.Add(h);return true;};EnumChildWindows(p,f,IntPtr.Zero);GC.KeepAlive(f);return l;}
 public static void Click(IntPtr h,int x,int y,bool dbl){RECT r;GetClientRect(h,out r);if(x<0)x=(r.R-r.L)/2;if(y<0)y=(r.B-r.T)/2;IntPtr lp=(IntPtr)((y<<16)|(x&0xFFFF));
  PostMessage(h,0x0200,IntPtr.Zero,lp);PostMessage(h,0x0201,(IntPtr)1,lp);PostMessage(h,0x0202,IntPtr.Zero,lp);
  if(dbl){PostMessage(h,0x0203,(IntPtr)1,lp);PostMessage(h,0x0202,IntPtr.Zero,lp);}}
 [DllImport("user32.dll",EntryPoint="SendMessageW")] public static extern IntPtr Send(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,IntPtr e);
 [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte sc,int f,IntPtr e);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,int f);
 public static void RealClick(IntPtr h){RECT r;GetWindowRect(h,out r);SetForegroundWindow(GetAncestor(h,2));System.Threading.Thread.Sleep(150);SetCursorPos((r.L+r.R)/2,(r.T+r.B)/2);System.Threading.Thread.Sleep(80);mouse_event(2,0,0,0,IntPtr.Zero);mouse_event(4,0,0,0,IntPtr.Zero);}
 public static void RealClickAt(IntPtr h,double fx){RECT r;GetWindowRect(h,out r);SetForegroundWindow(GetAncestor(h,2));System.Threading.Thread.Sleep(150);SetCursorPos(r.L+(int)((r.R-r.L)*fx),(r.T+r.B)/2);System.Threading.Thread.Sleep(80);mouse_event(2,0,0,0,IntPtr.Zero);mouse_event(4,0,0,0,IntPtr.Zero);}
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h,ref POINT p);
 public struct POINT{public int X,Y;}
 [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(int a,bool i,uint pid);
 [DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr h,IntPtr a,int n,int t,int p);
 [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr h,IntPtr a,int n,int t);
 [DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr h,IntPtr a,byte[] b,int n,out IntPtr w);
 [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr h,IntPtr a,byte[] b,int n,out IntPtr r);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 // 달력(SysMonthCal32)에서 그 날짜 칸의 화면 좌표 찾기: MCM_HITTEST로 칸마다 물어봄
 [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr h);
 [DllImport("user32.dll")] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")] static extern uint GetDpiForSystem();
 [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h,int f);
 [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr m,int t,out uint x,out uint y);
 [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr v);
 public static void DpiAware(){try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}try{SetThreadDpiAwarenessContext(new IntPtr(-4));}catch{try{SetProcessDPIAware();}catch{}}}
 // 상대 창이 쓰는 좌표 단위 → 실제 화면 픽셀 배율
 public static double Scale(IntPtr h){try{int a=GetAwarenessFromDpiAwarenessContext(GetWindowDpiAwarenessContext(h));uint mx,my;GetDpiForMonitor(MonitorFromWindow(h,2),0,out mx,out my);
   if(a==0)return mx/96.0;if(a==1)return mx/(double)GetDpiForSystem();}catch{}return 1.0;}
 // 보이는 날짜 칸을 하나씩 물어봄: 목표 칸 좌표(sx,sy)와, 못 찾으면 넘겨 갈 수 있게 가장 늦은 날짜 칸(lx,ly, lk=yyyymmdd)
 public static string FindDay(IntPtr cal,int y,int m,int d,out int sx,out int sy,out int lx,out int ly,out int lk){
  sx=-1;sy=-1;lx=-1;ly=-1;lk=0;uint pid;GetWindowThreadProcessId(cal,out pid);IntPtr ph=OpenProcess(0x38,false,pid);if(ph==IntPtr.Zero)return "OpenProcess 실패";
  double sc=Scale(cal);POINT o;o.X=0;o.Y=0;ClientToScreen(cal,ref o);
  IntPtr mem=VirtualAllocEx(ph,IntPtr.Zero,64,0x3000,4);RECT rc;GetClientRect(cal,out rc);rc.R=(int)(rc.R/sc);rc.B=(int)(rc.B/sc);var seen=new System.Collections.Generic.HashSet<string>();string first=null,last=null;IntPtr n;
  try{for(int yy=2;yy<rc.B;yy+=5)for(int xx=2;xx<rc.R;xx+=5){byte[] b=new byte[32];BitConverter.GetBytes(32).CopyTo(b,0);BitConverter.GetBytes(xx).CopyTo(b,4);BitConverter.GetBytes(yy).CopyTo(b,8);
    WriteProcessMemory(ph,mem,b,32,out n);Send(cal,0x100E,IntPtr.Zero,mem);ReadProcessMemory(ph,mem,b,32,out n);uint hit=BitConverter.ToUInt32(b,12);
    if((hit&0xFFFFF)==0x20001){int Y=BitConverter.ToUInt16(b,16),M=BitConverter.ToUInt16(b,18),D=BitConverter.ToUInt16(b,22);string k=Y+"/"+M+"/"+D;if(first==null)first=k;last=k;int kk=Y*10000+M*100+D;if(kk>lk){lk=kk;lx=o.X+(int)((xx+3)*sc);ly=o.Y+(int)((yy+3)*sc);}
      if(Y==y&&M==m&&D==d&&sx<0){sx=o.X+(int)((xx+3)*sc);sy=o.Y+(int)((yy+3)*sc);}}}}
  finally{VirtualFreeEx(ph,mem,0,0x8000);CloseHandle(ph);}
  return "배율 "+sc+", 보이는 날짜 "+(first??"없음")+" ~ "+(last??"없음");}
 public static void RealClickXY(IntPtr top,int x,int y){SetForegroundWindow(top);System.Threading.Thread.Sleep(150);SetCursorPos(x,y);System.Threading.Thread.Sleep(80);mouse_event(2,0,0,0,IntPtr.Zero);mouse_event(4,0,0,0,IntPtr.Zero);}
 public static void Key(byte vk){keybd_event(vk,0,0,IntPtr.Zero);keybd_event(vk,0,2,IntPtr.Zero);}
 public static int Width(IntPtr h){RECT r;GetWindowRect(h,out r);return r.R-r.L;}
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int hh,uint f);
 [StructLayout(LayoutKind.Sequential)] public struct MONINFO{public int cb;public RECT mon;public RECT work;public uint flags;}
 [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m,ref MONINFO i);
 // 쪽지 창을 그 모니터 작업 영역 왼쪽 위로 옮김 (메신저가 창을 계단식으로 점점 아래에 띄워 달력이 화면 밖으로 나가는 것 방지)
 // 예약 전송 창을 쪽지 창 바로 오른쪽 위에 붙임 (듀얼 모니터에서 다른 화면에 뜨는 것 방지). 오른쪽에 자리가 없으면 왼쪽에
 public static void PlaceBeside(IntPtr pk,IntPtr win){RECT w,p;GetWindowRect(win,out w);GetWindowRect(pk,out p);int pw=p.R-p.L;MONINFO mi=new MONINFO();mi.cb=Marshal.SizeOf(typeof(MONINFO));
  int x=w.R+2;if(GetMonitorInfo(MonitorFromWindow(win,2),ref mi)&&x+pw>mi.work.R)x=w.L-pw-2;SetWindowPos(pk,IntPtr.Zero,x,w.T+70,0,0,0x0001|0x0004|0x0010);}
 // 쪽지 창을 그 모니터 작업 영역 한가운데로 (사용자 추가 창은 쪽지 창 안에 뜨므로 같이 가운데)
 public static void ToCenter(IntPtr h){MONINFO mi=new MONINFO();mi.cb=Marshal.SizeOf(typeof(MONINFO));if(!GetMonitorInfo(MonitorFromWindow(h,2),ref mi))return;RECT r;GetWindowRect(h,out r);
  int w=r.R-r.L,hh=r.B-r.T,x=mi.work.L+Math.Max(0,(mi.work.R-mi.work.L-w)/2),y=mi.work.T+Math.Max(0,(mi.work.B-mi.work.T-hh)/2);SetWindowPos(h,IntPtr.Zero,x,y,0,0,0x0001|0x0004|0x0010);}
 public static void ToTopLeft(IntPtr h){MONINFO mi=new MONINFO();mi.cb=Marshal.SizeOf(typeof(MONINFO));if(!GetMonitorInfo(MonitorFromWindow(h,2),ref mi))return;SetWindowPos(h,IntPtr.Zero,mi.work.L+40,mi.work.T+10,0,0,0x0001|0x0004|0x0010);}
}
"@
# 모니터마다 배율이 달라도 실제 화면 좌표로 다루게 (안 되면 예전 방식)
$dpiOk = $false; try { $dpiOk = [SdtWin]::SetProcessDpiAwarenessContext([IntPtr](-4)) } catch {}
if (-not $dpiOk) { [void][SdtWin]::SetProcessDPIAware() }
$script:own = [IntPtr]::Zero
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
function Get-HwpWindow($title) {
  # 지금 다루는 문서 이름이 제목에 있는 한글 창을 고름 (한글이 여러 개 떠 있어도 엉뚱한 창을 붙이지 않게)
  $ps = @(Get-Process -Name 'Hwp' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
  if ($title) { $hit = $ps | Where-Object { "$($_.MainWindowTitle)".Contains([string]$title) } | Select-Object -First 1; if ($hit) { return $hit.MainWindowHandle } }
  $p = $ps | Sort-Object StartTime -Descending | Select-Object -First 1
  if ($p) { return $p.MainWindowHandle } else { return [IntPtr]::Zero }
}
function Get-WinTitle($w) { $p = Get-Process -Name 'Hwp' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq $w } | Select-Object -First 1; if ($p) { return "$($p.MainWindowTitle)" } else { return '' } }
function Restore-Win($w) {
  # 제목줄 없이 붙여 두었던 한글 창을 원래 창으로
  if ($w -eq [IntPtr]::Zero -or -not [SdtWin]::IsWindow($w)) { return }
  $st = [Int64][SdtWin]::GetLong($w, -16) -bor [Int64]0x00CF0000
  [void][SdtWin]::SetLong($w, -16, [IntPtr]$st); [void][SdtWin]::SetLong($w, -8, [IntPtr]::Zero)
  [void][SdtWin]::SetWindowPos($w, [IntPtr]::Zero, 0, 0, 0, 0, 0x0001 -bor 0x0002 -bor 0x0004 -bor 0x0020)
}
$script:hwp = $null

# 문서 폭에 맞춰 보기 (좁은 칸에 붙여도 글이 한눈에 들어오게)
function Fit-Width($h) {
  try { $p = $h.HParameterSet.HViewProperties; [void]$h.HAction.GetDefault('ViewZoom', $p.HSet); $p.ZoomType = 0; $p.ZoomRatio = 100; [void]$h.HAction.Execute('ViewZoom', $p.HSet) } catch {}
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

# ---- GOE 메신저 ----
function Log($m){ $script:goeLog += "$m`n" }
function Find($parent,$cls,$id,$txt){ foreach($h in [GoeW]::Kids($parent)){ if($cls -and [GoeW]::Cls($h) -ne $cls){continue}; if($id -and [GoeW]::GetDlgCtrlID($h) -ne $id){continue}; if($txt -and [GoeW]::Text($h) -ne $txt){continue}; return $h }; return [IntPtr]::Zero }
function Wait($sb,$sec=6){ $t=(Get-Date).AddSeconds($sec); while((Get-Date) -lt $t){ $r=& $sb; if($r -and $r -ne [IntPtr]::Zero){return $r}; Start-Sleep -Milliseconds 200 }; return [IntPtr]::Zero }
function SetEdit($skin,$val,$label){ if($skin -eq [IntPtr]::Zero){ Stop "$label 칸을 못 찾았어요." }; $c=[GoeW]::Kids($skin)|Select-Object -First 1; if(-not $c){$c=$skin}; [void][GoeW]::SendStr($c,0x0C,[IntPtr]::Zero,$val); if([GoeW]::Text($c) -ne $val){ Stop "$label 칸에 '$val'이 안 들어갔어요." } }
function FindAny($txt){
  foreach($t in [GoeW]::Tops()){ if([GoeW]::Text($t) -like "*$txt*" -and [GoeW]::IsWindowVisible($t)){ return $t }
    if([GoeW]::Cls($t) -like '@Messenger7*' -or [GoeW]::Cls($t) -like 'Afx:*'){ foreach($k in [GoeW]::Kids($t)){ if([GoeW]::Text($k) -like "*$txt*" -and [GoeW]::IsWindowVisible($k)){ return $k } } } }
  return [IntPtr]::Zero }
function Dump($w){ foreach($k in @($w)+@([GoeW]::Kids($w))){ Log ("    [{0}] id={1} '{2}'" -f [GoeW]::Cls($k),[GoeW]::GetDlgCtrlID($k),([GoeW]::Text($k) -replace '\s+',' ').Substring(0,[Math]::Min(30,([GoeW]::Text($k)).Length))) } }
function Stop($m){ throw "쪽지: $m" }


function Nums($t){ @([regex]::Matches($t,'\d+') | ForEach-Object { [int]$_.Value }) }

function SendOne($When,$Names,$Title,$Body,$OrgName,$SendHour,$SendMin){
  $main = [GoeW]::Tops() | Where-Object { [GoeW]::Cls($_) -eq '@Messenger7_MainWnd' } | Select-Object -First 1
  if(-not $main){ Stop 'GOE 메신저가 켜져 있지 않아요.' }
  $before = @([GoeW]::Tops() | Where-Object { [GoeW]::Cls($_) -eq '@Messenger7_Wnd' -and [GoeW]::Text($_) -eq '쪽지 전송' })
  $btn = Find $main 'Button' 0 '쪽지 작성'
  if($btn -eq [IntPtr]::Zero){ Stop "메신저에서 '쪽지 작성' 버튼을 못 찾았어요. 메신저를 쪽지 탭에 두세요." }
  [GoeW]::Click($btn,-1,-1,$false)
  $script:win = Wait { [GoeW]::Tops() | Where-Object { [GoeW]::Cls($_) -eq '@Messenger7_Wnd' -and [GoeW]::Text($_) -eq '쪽지 전송' -and ($before -notcontains $_) } | Select-Object -First 1 }
  $win=$script:win
  if($win -eq [IntPtr]::Zero){ Stop '쪽지 창이 안 떴어요.' }
  Start-Sleep -Milliseconds 500
  [GoeW]::ToCenter($win); Start-Sleep -Milliseconds 200
  # 제목·본문
  SetEdit (Find $win 'UltariSkinEdit' 1015 $null) $Title '제목'
  $rich = Find $win 'RICHEDIT50W' 1016 $null
  [void][GoeW]::SendStr($rich,0x0C,[IntPtr]::Zero,$Body)
  # 받는 사람: 한 사람마다 사용자 추가 창을 새로 열어 검색 → 첫 줄 선택 → 확인 (한 창에서 연달아 고르면 두 번째가 빠짐)
  foreach($n in $Names){
    $dlg = [IntPtr]::Zero
    for($try=0; $try -lt 2 -and $dlg -eq [IntPtr]::Zero; $try++){ [GoeW]::Click((Find $win 'Button' 1022 $null),-1,-1,$false); $dlg = Wait { FindAny '사용자 추가' } 6 }
    if($dlg -eq [IntPtr]::Zero){ Stop "사용자 추가 창이 안 떴어요 ($n)." }
    Start-Sleep -Milliseconds 600
    $orgBox = Find $dlg 'UltariSkinEdit' 1013 $null
    $nameBox = [GoeW]::Kids($dlg) | Where-Object { [GoeW]::Cls($_) -eq 'UltariSkinEdit' -and [GoeW]::GetDlgCtrlID($_) -eq 1004 } | Sort-Object { [GoeW]::Width($_) } -Descending | Select-Object -First 1
    $list = [GoeW]::Kids($dlg) | Where-Object { [GoeW]::Text($_) -eq '검색 결과 리스트' } | Select-Object -First 1
    $search = Find $dlg 'Button' 1005 '검색'
    if(-not $nameBox -or -not $list -or $search -eq [IntPtr]::Zero){ Stop '사용자 추가 창에서 검색칸을 못 찾았어요. 검색 탭을 열어 두세요.' }
    SetEdit $orgBox $OrgName '소속'; SetEdit $nameBox $n '이름'
    [GoeW]::Click($search,-1,-1,$false); Start-Sleep -Milliseconds 1800
    [GoeW]::Click($list,80,14,$true); Start-Sleep -Milliseconds 700
    $ok = Find $dlg 'Button' 1001 '확인'; [GoeW]::Click($ok,-1,-1,$false); Start-Sleep -Milliseconds 900
    if([GoeW]::IsWindowVisible($dlg)){ [GoeW]::RealClick($ok); Start-Sleep -Milliseconds 900 }
    if([GoeW]::IsWindowVisible($dlg)){ Stop "사용자 추가 창이 안 닫혔어요 ($n)." }
  }
  # 예약
  [GoeW]::Click((Find $win 'Button' 1037 $null),-1,-1,$false)
  $script:pk = Wait { FindAny 'GOE메신저 Picker' }; $pk=$script:pk
  if($pk -eq [IntPtr]::Zero){ Stop '예약 전송 창이 안 떴어요.' }
  [GoeW]::PlaceBeside($pk,$win)
  Start-Sleep -Milliseconds 400
  $chk = Find $pk 'Button' 1006 $null
  if([int][GoeW]::Send($chk,0xF0,[IntPtr]::Zero,[IntPtr]::Zero) -ne 1){ [GoeW]::RealClick($chk); Start-Sleep -Milliseconds 400 }
  if([int][GoeW]::Send($chk,0xF0,[IntPtr]::Zero,[IntPtr]::Zero) -ne 1){ Stop '예약 체크가 안 됐어요.' }
  $dskin = Find $pk 'UltariSkinEdit' 1002 $null; $dc = [GoeW]::Kids($dskin) | Select-Object -First 1
  # 날짜: 달력을 열어 그 칸을 클릭. 달력에 아직 안 보이는 날(다음 달 등)이면 보이는 가장 늦은 날을 눌러 달력을 넘긴 뒤 다시 열어 찾음
  $wantK = $When.Year*10000+$When.Month*100+$When.Day
  for($try=0; $try -lt 4 -and ((Nums ([GoeW]::Text($dc))) -join ',') -ne (@($When.Year,$When.Month,$When.Day) -join ','); $try++){
    $dp = FindAny 'GOE메신저 Date Picker'
    if($dp -eq [IntPtr]::Zero){ [GoeW]::RealClickAt($dskin,0.92); $dp = Wait { FindAny 'GOE메신저 Date Picker' } 4 }
    if($dp -eq [IntPtr]::Zero){ Stop '달력이 안 떴어요.' }
    Start-Sleep -Milliseconds 300
    $cal = Find $dp 'SysMonthCal32' 0 $null
    $sx=0;$sy=0;$lx=0;$ly=0;$lk=0; $info = [GoeW]::FindDay($cal,$When.Year,$When.Month,$When.Day,[ref]$sx,[ref]$sy,[ref]$lx,[ref]$ly,[ref]$lk)
    if($sx -ge 0){ [GoeW]::RealClickXY($dp,$sx,$sy); Start-Sleep -Milliseconds 600; break }
    if($lx -lt 0 -or $lk -ge $wantK){ Stop "달력에서 $($When.Month)월 $($When.Day)일 칸을 못 찾았어요 ($info)." }
    [GoeW]::RealClickXY($dp,$lx,$ly); Start-Sleep -Milliseconds 700
  }
  if(((Nums ([GoeW]::Text($dc))) -join ',') -ne (@($When.Year,$When.Month,$When.Day) -join ',')){ Stop "날짜가 '$([GoeW]::Text($dc))'로 들어갔어요." }
  foreach($p in @(@(1003,$SendHour,'시'),@(1004,$SendMin,'분'))){
    $skin = Find $pk 'UltariSkinEdit' $p[0] $null; $c = [GoeW]::Kids($skin) | Select-Object -First 1
    if((Nums ([GoeW]::Text($c)))[0] -ne $p[1]){
      [GoeW]::RealClick($skin); Start-Sleep -Milliseconds 400
      for($i=0;$i -lt 40;$i++){ $cur=(Nums ([GoeW]::Text($c)))[0]; if($cur -eq $p[1]){break}; if($cur -gt $p[1]){[GoeW]::Key(0x26)}else{[GoeW]::Key(0x28)}; Start-Sleep -Milliseconds 100 }
      [GoeW]::Key(0x0D); Start-Sleep -Milliseconds 300
    }
    if((Nums ([GoeW]::Text($c)))[0] -ne $p[1]){ Stop "$($p[2])이 '$([GoeW]::Text($c))'로 들어갔어요." }
  }
  # 마지막으로 체크·날짜 다시 확인 후 예약 창 닫기
  if([int][GoeW]::Send($chk,0xF0,[IntPtr]::Zero,[IntPtr]::Zero) -ne 1){ Stop '예약 체크가 풀렸어요.' }
  if(((Nums ([GoeW]::Text($dc))) -join ',') -ne (@($When.Year,$When.Month,$When.Day) -join ',')){ Stop '날짜가 바뀌었어요.' }
  [GoeW]::Click((Find $pk 'Button' 1005 $null),-1,-1,$false); Start-Sleep -Milliseconds 500
  if([GoeW]::IsWindowVisible($pk)){ [GoeW]::RealClick((Find $pk 'Button' 1005 $null)); Start-Sleep -Milliseconds 500 }
  # 전송
  $tops0 = @([GoeW]::Tops())
  $send = Find $win 'Button' 1024 $null
  [GoeW]::Click($send,-1,-1,$false)
  $t=(Get-Date).AddSeconds(8)
  while((Get-Date) -lt $t -and [GoeW]::IsWindowVisible($win)){
    Start-Sleep -Milliseconds 400
    # 확인 창이 뜨면 내용을 보여 주고 멈춤 (처음 한 번은 직접 보기)
    $pop = [GoeW]::Tops() | Where-Object { $tops0 -notcontains $_ -and [GoeW]::IsWindowVisible($_) } | Select-Object -First 1
    if($pop){ Log ("  전송 후 뜬 창: '{0}'" -f [GoeW]::Text($pop)); Dump $pop; Stop '전송 후 확인 창이 떴어요. 이 화면을 캡처해 보내 주세요.' }
  }
  if([GoeW]::IsWindowVisible($win)){ Stop '전송 후에도 쪽지 창이 그대로예요.' }
}

function Run-Cmd($m) {
  # 창 위치만 다루는 명령은 한글 프로그램을 새로 띄우지 않음
  if (@('place', 'embed', 'unembed', 'away', 'goeSend') -notcontains $m.cmd) { $h = Get-Hwp }
    switch ($m.cmd) {
    'goeSend' {
      # {when:'2026-10-27', hour, min, org, names:[], title, body} → 쪽지 하나를 그날 그 시각으로 예약 전송
      $script:goeLog = ''
      $d = [datetime]::ParseExact($m.when, 'yyyy-MM-dd', $null)
      SendOne $d @($m.names) "$($m.title)" "$($m.body)" "$($m.org)" ([int]$m.hour) ([int]$m.min)
      Reply $m.id $true @{ sent = $m.when } $null
    }
    'ping'   { Reply $m.id $true @{ version = "$($h.Version)" } $null }
    'open'   { [void]$h.Open($m.path, 'HWPX', 'forceopen:true;lock:false'); try { $h.XHwpWindows.Item(0).Visible = $true } catch {}; Fit-Width $h; Reply $m.id $true @{ path = $m.path } $null }
    'openPath' { [void]$h.Open($m.path, '', 'forceopen:true;lock:false'); try { $h.XHwpWindows.Item(0).Visible = $true } catch {}; Reply $m.id $true @{ path = $m.path } $null }
    'reload' {
      # 같은 문서를 새 내용으로 바꿔 끼움 (한글에서 직접 고친 건 사라짐)
      try { [void]$h.Clear(1) } catch {}
      [void]$h.Open($m.path, 'HWPX', 'forceopen:true;lock:false')
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
      # 쓰는 자리가 한글 화면에 보이게 (커서 이동 명령을 한 번 실행하면 화면이 따라감)
      try { [void]$h.Run('MoveParaBegin') } catch {}
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
    'close' {
      # 열린 문서를 저장하고 모두 닫음 (계획안 밖으로 나가거나 다른 계획안으로 바꿀 때)
      $n = 1; try { $n = [int]$h.XHwpDocuments.Count } catch {}
      for ($i = $n - 1; $i -ge 0; $i--) {
        try { $d = $h.XHwpDocuments.Item($i); try { $d.SetActive_XHwpDocument() } catch {}
          $mod = $false; try { $mod = [bool]$h.IsModified } catch {}
          if ($mod -and "$($h.Path)") { [void]$h.Save($true) }
          if ($i -gt 0) { [void]$d.Close($false) } } catch {}
      }
      try { [void]$h.Clear(1) } catch {}
      Reply $m.id $true @{} $null
    }
    'findSel' {
      # 글을 찾아 골라 둠 → 한글 화면이 그 자리로 감
      $ok = $false
      try { [void]$h.MovePos(2, 0, 0); $act = $h.HAction; $p = $h.HParameterSet.HFindReplace
        [void]$act.GetDefault('ForwardFind', $p.HSet); $p.FindString = $m.text; $p.IgnoreMessage = 1; $p.Direction = 0; $p.MatchCase = 1; $p.FindRegExp = 0
        $ok = [bool]$act.Execute('ForwardFind', $p.HSet) } catch {}
      Reply $m.id $true @{ ok = $ok } $null
    }
    'snap' {
      # 지금 한글 문서를 hwpx로 저장하고 그 내용을 돌려줌 (한글 파일이면 같은 이름의 hwpx로 바꿔 저장)
      $f = "$($h.Path)"
      if (-not $f) { Reply $m.id $false $null '저장된 문서가 아니에요.'; return }
      if ($f -notmatch '\.hwpx$') { $f = [IO.Path]::ChangeExtension($f, '.hwpx'); [void]$h.SaveAs($f, 'HWPX', '') }
      else { $mod = $true; try { $mod = [bool]$h.IsModified } catch {}; if ($mod) { [void]$h.Save($true) } }
      # 한글이 파일을 잠가 두면 그대로 읽을 수 없음 → 같이 읽기로 열고, 그래도 안 되면 임시 파일로 저장해 읽은 뒤 원래 이름으로 되돌려 저장
      $bytes = $null
      try { $fs = [IO.File]::Open($f, 'Open', 'Read', 'ReadWrite'); try { $ms = New-Object IO.MemoryStream; $fs.CopyTo($ms); $bytes = $ms.ToArray() } finally { $fs.Close() } } catch {}
      if (-not $bytes) {
        $dir = Join-Path $env:TEMP 'siddhartha'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $t = Join-Path $dir ('snap~' + [DateTime]::Now.Ticks + '.hwpx')
        [void]$h.SaveAs($t, 'HWPX', '')
        $bytes = [IO.File]::ReadAllBytes($t)
        [void]$h.SaveAs($f, 'HWPX', '')
        try { Remove-Item $t -Force } catch {}
      }
      Reply $m.id $true @{ path = $f; b64 = [Convert]::ToBase64String($bytes) } $null
    }
    'typeMark' {
      # 표시(⟪1⟫ 등)를 찾아 그 자리에 글을 몇 글자씩 써 넣음 → 쓰는 자리로 화면이 따라가며 채워지는 게 보임
      $done = @()
      foreach ($r in $m.pairs) {
        $ok = $false
        try {
          [void]$h.MovePos(2, 0, 0)
          $act = $h.HAction; $p = $h.HParameterSet.HFindReplace
          [void]$act.GetDefault('ForwardFind', $p.HSet)
          $p.FindString = $r.find; $p.IgnoreMessage = 1; $p.Direction = 0; $p.MatchCase = 1; $p.FindRegExp = 0
          if ([bool]$act.Execute('ForwardFind', $p.HSet)) {
            [void]$h.Run('Delete')
            $ia = $h.HParameterSet.HInsertText; $line = [string]$r.replace
            for ($j = 0; $j -lt $line.Length; $j += 3) {
              [void]$act.GetDefault('InsertText', $ia.HSet); $ia.Text = $line.Substring($j, [Math]::Min(3, $line.Length - $j))
              [void]$act.Execute('InsertText', $ia.HSet); Start-Sleep -Milliseconds 15
            }
            $ok = $true
          }
        } catch {}
        $done += $ok
      }
      Reply $m.id $true @{ done = $done } $null
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
      # 붙여 둔 창이 지금 문서의 창이 아니면 원래대로 돌려놓고 맞는 창을 다시 찾음
      if ($m.title -and $w -ne [IntPtr]::Zero -and [SdtWin]::IsWindow($w) -and -not (Get-WinTitle $w).Contains([string]$m.title)) {
        $want = Get-HwpWindow $m.title
        if ($want -ne [IntPtr]::Zero -and $want -ne $w) { Restore-Win $w; $w = [IntPtr]::Zero; $script:embedded = [IntPtr]::Zero }
      }
      if ($w -eq [IntPtr]::Zero -or -not [SdtWin]::IsWindow($w)) {
        $w = [IntPtr]::Zero
        for ($k = 0; $k -lt 20 -and $w -eq [IntPtr]::Zero; $k++) { $w = Get-HwpWindow $m.title; if ($w -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 250 } }
        # 예전에 제목줄 없이 남은 다른 한글 창은 원래 창으로
        Get-Process -Name 'Hwp' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowHandle -ne $w } | ForEach-Object { if (([Int64][SdtWin]::GetLong($_.MainWindowHandle, -16) -band [Int64]0x00C00000) -eq 0) { Restore-Win $_.MainWindowHandle } }
        if ($w -eq [IntPtr]::Zero) { Reply $m.id $false $null '한글 창을 찾지 못했어요.'; return }
        $script:oldStyle = [SdtWin]::GetLong($w, -16)
        $st = ([Int64]$script:oldStyle -band (-bnot [Int64]0x00CF0000)) -bor [Int64]0x00040000   # 제목줄·최소/최대 버튼은 빼고, 크기 조절 테두리는 남김
        [void][SdtWin]::SetLong($w, -16, [IntPtr]$st)
        $own = Get-OwnWindow
        if ($own -ne [IntPtr]::Zero) { [void][SdtWin]::SetLong($w, -8, $own) }
        [void][SdtWin]::ShowWindow($w, 9)
        $script:embedded = $w
      }
      $x = [int]$m.x; $y = [int]$m.y
      if ($m.rel) {
        # 싯다르타 창 안쪽(내용 영역) 기준 위치 → 실제 화면 위치 (여러 모니터·배율에서도 맞게)
        if ($script:own -eq [IntPtr]::Zero -or -not [SdtWin]::IsWindow($script:own)) { $script:own = Get-OwnWindow }
        if ($script:own -ne [IntPtr]::Zero) { $pt = New-Object SdtWin+PT; $pt.X = [int]$m.rx; $pt.Y = [int]$m.ry; if ([SdtWin]::ClientToScreen($script:own, [ref]$pt)) { $x = $pt.X; $y = $pt.Y } }
      }
      $mh = [int]$m.h
      if ($m.full -and $script:own -ne [IntPtr]::Zero) {
        # 맨 위: 싯다르타 창의 제목줄까지 덮음 (보이는 창 테두리 기준)
        $fr = New-Object SdtWin+RC
        if ([SdtWin]::DwmGetWindowAttribute($script:own, 9, [ref]$fr, 16) -ne 0) { [void][SdtWin]::GetWindowRect($script:own, [ref]$fr) }
        if ($fr.T -lt $y) { $mh = $mh + ($y - $fr.T); $y = $fr.T }
      }
      # 이미 그 자리면 건드리지 않음 (한글을 쓰는 중에 깜빡이거나 막히지 않게)
      $rc = New-Object SdtWin+RC; [void][SdtWin]::GetWindowRect($w, [ref]$rc)
      $same = ($rc.L -eq $x -and $rc.T -eq $y -and ($rc.R - $rc.L) -eq [int]$m.w -and ($rc.B - $rc.T) -eq $mh)
      # 선생님이 한글 창 가장자리를 끌어 크기를 바꿨으면 되돌리지 않고 그 크기를 알려 줌 → 싯다르타가 칸 너비를 맞춤
      $ls = $script:lastSet
      if (-not $same -and $ls -and $w -eq $ls.w -and $rc.T -eq $ls.T -and $rc.B -eq $ls.B -and ($rc.R - $rc.L) -ne ($ls.R - $ls.L) -and -not $m.force) {
        $script:lastSet = @{ w = $w; L = $rc.L; T = $rc.T; R = $rc.R; B = $rc.B }
        Reply $m.id $true @{ user = $true; L = $rc.L; R = $rc.R; x = $x; w = [int]$m.w } $null; return
      }
      if (-not $same) { [void][SdtWin]::SetWindowPos($w, [IntPtr]::Zero, $x, $y, [int]$m.w, $mh, 0x0020 -bor 0x0040 -bor 0x0010) }
      $script:lastSet = @{ w = $w; L = $x; T = $y; R = $x + [int]$m.w; B = $y + $mh }
      Reply $m.id $true @{ x = $x; y = $y } $null
    }
    'away' {
      # 계획안 화면을 떠나면: 싯다르타가 연 문서를 저장하고 닫은 뒤 한글 창을 숨김.
      # 프로그램이 다시 켜져서 조종이 끊긴 예전 한글 창(제목에 싯다르타 폴더)도 숨김. 사용자가 직접 연 다른 한글 창은 건드리지 않음
      $n = 0
      $h = $null; if ($script:hwp) { try { [void]$script:hwp.XHwpWindows.Count; $h = $script:hwp } catch { $script:hwp = $null } }
      if ($h) {
        $c = 1; try { $c = [int]$h.XHwpDocuments.Count } catch {}
        for ($i = $c - 1; $i -ge 0; $i--) {
          try { $d = $h.XHwpDocuments.Item($i); try { $d.SetActive_XHwpDocument() } catch {}
            $mod = $false; try { $mod = [bool]$h.IsModified } catch {}
            if ($mod -and "$($h.Path)") { [void]$h.Save($true) }
            if ($i -gt 0) { [void]$d.Close($false) } } catch {}
        }
        try { [void]$h.Clear(1) } catch {}
        try { $h.XHwpWindows.Item(0).Visible = $false } catch {}
        $n++
      }
      if ($script:embedded -ne [IntPtr]::Zero -and [SdtWin]::IsWindow($script:embedded)) { Restore-Win $script:embedded; [void][SdtWin]::ShowWindow($script:embedded, 0) }
      $script:embedded = [IntPtr]::Zero; $script:lastSet = $null
      Get-Process -Name 'Hwp' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | ForEach-Object {
        $t = "$($_.MainWindowTitle)"; $hw = $_.MainWindowHandle
        $noCap = ((([Int64][SdtWin]::GetLong($hw, -16)) -band [Int64]0x00C00000) -ne [Int64]0x00C00000)
        if ($noCap -or $t -match '싯다르타|siddhartha') { if ($noCap) { Restore-Win $hw }; [void][SdtWin]::ShowWindow($hw, 0); $n++ }
      }
      Reply $m.id $true @{ n = $n } $null
    }
    'unembed' {
      # 붙여 둔 한글 창을 원래 창으로 되돌림 (+hide면 내려 둠). 새로고침으로 기록이 사라져도 제목줄 없는 한글 창은 모두 찾아서 처리
      $ws = @()
      if ($script:embedded -ne [IntPtr]::Zero -and [SdtWin]::IsWindow($script:embedded)) { $ws += $script:embedded }
      Get-Process -Name 'Hwp' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | ForEach-Object {
        $hw = $_.MainWindowHandle
        if ((([Int64][SdtWin]::GetLong($hw, -16)) -band [Int64]0x00C00000) -ne [Int64]0x00C00000 -and $ws -notcontains $hw) { $ws += $hw }
      }
      foreach ($w in $ws) {
        [void][SdtWin]::SetLong($w, -8, [IntPtr]::Zero)
        if ($w -eq $script:embedded -and $script:oldStyle -ne [IntPtr]::Zero) { [void][SdtWin]::SetLong($w, -16, $script:oldStyle) }
        else { [void][SdtWin]::SetLong($w, -16, [IntPtr](([Int64][SdtWin]::GetLong($w, -16)) -bor 0x00CF0000)) }
        [void][SdtWin]::SetWindowPos($w, [IntPtr]::Zero, 0, 0, 0, 0, 0x0020 -bor 0x0001 -bor 0x0002 -bor 0x0004)
        if ($m.hide) { [void][SdtWin]::ShowWindow($w, 6) }
      }
      $script:embedded = [IntPtr]::Zero; $script:lastSet = $null
      Reply $m.id $true @{ n = $ws.Count } $null
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
      # 내 문서\싯다르타 폴더에 hwpx로 저장 (같은 이름이 있으면 덮어씀)
      $dir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) '싯다르타'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
      $f = Join-Path $dir (($m.name -replace '[\\/:*?"<>|]', ' ').Trim() + '.hwpx')
      [void]$h.SaveAs($f, 'HWPX', '')
      Reply $m.id $true @{ path = $f } $null
    }
    'fields' { Reply $m.id $true @{ list = "$($h.GetFieldList(0, 0))" } $null }
    'putFields' { $h.PutFieldText($m.names, $m.values); Reply $m.id $true @{} $null }
    'fit'    { Fit-Width $h; Reply $m.id $true @{} $null }
    'save'   {
      # 바뀐 게 있을 때만 저장 (매번 저장하면 한글이 잠깐씩 멈춤)
      $mod = $true; try { $mod = [bool]$h.IsModified } catch {}
      if ($mod) { [void]$h.Save($true) }
      Reply $m.id $true @{ saved = $mod } $null
    }
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
