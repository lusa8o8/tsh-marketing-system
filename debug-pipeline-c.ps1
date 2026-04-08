# Debug script for Pipeline C with full context
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bWR3bHRma3hzdGl3bnd3aXVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODYxMDIsImV4cCI6MjA5MDU2MjEwMn0.KxhpCmssGVUJKkZvbc0KXCE5cP4SGL4ER8BmCXpi8uo"

$Body = @{
    orgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
    today = "2026-04-04"
    calendarEvent = @{
        id = "demo-event-001"
        event_type = "exam_window"
        event_date = "2026-05-11"
        event_end_date = "2026-05-29"
        label = "UNZA semester 1 exams 2026"
        universities = @("UNZA")
        lead_days = 21
    }
} | ConvertTo-Json -Depth 5

Write-Host "Invoking Pipeline C with error logging..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod `
      -Method POST `
      -Uri "https://jxmdwltfkxstiwnwwiuf.supabase.co/functions/v1/pipeline-c-campaign" `
      -Headers @{ Authorization = "Bearer $ANON_KEY" } `
      -ContentType "application/json" `
      -Body $Body
    
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Host "`nError Details:" -ForegroundColor Red
    $result = $_.Exception.Response.GetResponseStream() | %{ (New-Object System.IO.StreamReader($_)).ReadToEnd() }
    $result | ConvertTo-Json -Depth 5
}
