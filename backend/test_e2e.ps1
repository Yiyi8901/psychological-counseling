$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:8080/api'

Write-Host "=== TEST 1: JWT拦截器 (无Token应返回401) ===" -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "$BASE/sessions" -Method GET
    Write-Host "FAIL: 应该401" -ForegroundColor Red
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) { Write-Host "PASS: 返回 401" -ForegroundColor Green }
    else { Write-Host "FAIL: 返回 $code" -ForegroundColor Red }
}

Write-Host "`n=== TEST 2: 登录获取Token ===" -ForegroundColor Cyan
$loginBody = '{"username":"test","password":"123456"}'
try {
    $loginResp = Invoke-RestMethod -Uri "$BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResp.token
    Write-Host "PASS: 登录成功 userId=$($loginResp.userId)" -ForegroundColor Green
} catch {
    Write-Host "未注册，先注册..."
    Invoke-RestMethod -Uri "$BASE/register" -Method POST -Body $loginBody -ContentType "application/json" | Out-Null
    $loginResp = Invoke-RestMethod -Uri "$BASE/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResp.token
    Write-Host "PASS: 注册+登录成功 userId=$($loginResp.userId)" -ForegroundColor Green
}
$H = @{ Authorization = "Bearer $token" }

Write-Host "`n=== TEST 3: 危机干预 (发送'不想活'应返回热线文案) ===" -ForegroundColor Cyan
$sid1 = "test-session-crisis-" + (Get-Date -Format "HHmmss")
$chatBody = "{`"sessionId`":`"$sid1`",`"message`":`"我最近压力好大，不想活了`"}"
$chatResp = Invoke-RestMethod -Uri "$BASE/chat" -Method POST -Body $chatBody -ContentType "application/json" -Headers $H
if ($chatResp.reply -match "400-161-9995") {
    Write-Host "PASS: 命中危机干预，返回热线文案" -ForegroundColor Green
} else {
    Write-Host "FAIL: 未触发危机干预" -ForegroundColor Red
}
Write-Host "回复: $($chatResp.reply)"

Write-Host "`n=== TEST 4: 会话隔离 - 查询会话列表 ===" -ForegroundColor Cyan
$sessResp = Invoke-RestMethod -Uri "$BASE/sessions" -Method GET -Headers $H
Write-Host "PASS: 当前会话数=$($sessResp.sessions.Count)" -ForegroundColor Green
$sessResp.sessions | ForEach-Object { Write-Host "  - session_id=$($_.session_id) title=$($_.title) msg_count=$($_.msg_count)" }

Write-Host "`n=== TEST 5: 会话历史隔离 - 查询危机会话历史 ===" -ForegroundColor Cyan
$histResp = Invoke-RestMethod -Uri "$BASE/history`?sessionId=$sid1&limit=10" -Method GET -Headers $H
Write-Host "会话 $sid1 历史消息数=$($histResp.messages.Count)" -ForegroundColor Green
$histResp.messages | ForEach-Object { Write-Host "  [$($_.role)] $($_.content.Substring(0, [Math]::Min(40, $_.content.Length)))" }

Write-Host "`n=== TEST 6: SSE流式 (curl测试) ===" -ForegroundColor Cyan
$sid2 = "test-session-stream-" + (Get-Date -Format "HHmmss")
$streamBody = "{`"sessionId`":`"$sid2`",`"message`":`"你好，请用一句话介绍自己`"}"
Write-Host "用curl测试SSE流式输出..."
$out = & curl.exe -s -X POST "$BASE/chat/stream" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d $streamBody --max-time 30
$totalLen = ($out -join "").Length
$hasDone = ($out -join "") -match "\[DONE\]"
if ($hasDone) {
    Write-Host "PASS: SSE流式完成，收到[DONE]标记，总长度=$totalLen" -ForegroundColor Green
} else {
    Write-Host "FAIL: 未收到[DONE]标记" -ForegroundColor Red
}
Write-Host "SSE原始输出(前300字符):"
($out -join "") | Select-Object -First 1 | ForEach-Object { $_.Substring(0, [Math]::Min(300, $_.Length)) }

Write-Host "`n=== 全部测试完成 ===" -ForegroundColor Cyan
