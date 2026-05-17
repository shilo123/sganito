# גיבוי נתונים תפעוליים מ-DB סגנית לקובץ JSON יחיד
# שימוש:  powershell -ExecutionPolicy Bypass -File scripts\db_backup.ps1
$ErrorActionPreference = 'Stop'

$connStr = "Data Source=.\SQLEXPRESS01;Initial Catalog=Sganit;Integrated Security=True;Connect Timeout=30;"

# הטבלאות התפעוליות לגיבוי (בלי טבלאות עזר/הגדרה)
$tables = @(
  'Teacher','Class','ClassTeacher','TeacherAssignment','TeacherHours',
  'ShehyaGroup','Hakbatza','HakbatzaClass','HakbatzaTeacher','GroupInfo',
  'SchoolHours','Mikz_Tiyuv','BetKneset','TeacherTiyuv'
)

$conn = New-Object System.Data.SqlClient.SqlConnection $connStr
$conn.Open()

function Get-TableJson($name) {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = "SELECT * FROM [$name] FOR JSON PATH, INCLUDE_NULL_VALUES"
  $reader = $cmd.ExecuteReader()
  $sb = New-Object System.Text.StringBuilder
  while ($reader.Read()) { [void]$sb.Append($reader.GetString(0)) }
  $reader.Close()
  $s = $sb.ToString()
  if ([string]::IsNullOrEmpty($s)) { return '[]' }
  return $s
}

function Get-TableCount($name) {
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = "SELECT COUNT(*) FROM [$name]"
  return [int]$cmd.ExecuteScalar()
}

$out = New-Object System.Text.StringBuilder
[void]$out.AppendLine('{')

# מטא-דאטה
$now = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
$counts = [ordered]@{}
foreach ($t in $tables) { $counts[$t] = Get-TableCount $t }
$countsJson = ($counts | ConvertTo-Json -Compress)
[void]$out.AppendLine("  ""_meta"": {")
[void]$out.AppendLine("    ""createdAt"": ""$now"",")
[void]$out.AppendLine("    ""database"": ""Sganit"",")
[void]$out.AppendLine("    ""scope"": ""operational-data-only"",")
[void]$out.AppendLine("    ""rowCounts"": $countsJson")
[void]$out.AppendLine("  },")

# נתוני הטבלאות
for ($i = 0; $i -lt $tables.Count; $i++) {
  $t = $tables[$i]
  $json = Get-TableJson $t
  $comma = if ($i -lt $tables.Count - 1) { ',' } else { '' }
  [void]$out.AppendLine("  ""$t"": $json$comma")
  Write-Host ("  {0,-20} {1,5} rows" -f $t, $counts[$t])
}
[void]$out.AppendLine('}')

$conn.Close()

$stamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$path  = "C:\Users\Administrator\sganit\sganit_backup_operational_$stamp.json"
[System.IO.File]::WriteAllText($path, $out.ToString(), (New-Object System.Text.UTF8Encoding $false))

$size = [math]::Round((Get-Item $path).Length / 1KB, 1)
Write-Host ""
Write-Host "BACKUP_FILE=$path"
Write-Host "BACKUP_SIZE_KB=$size"
Write-Host "TOTAL_ROWS=$(($counts.Values | Measure-Object -Sum).Sum)"
