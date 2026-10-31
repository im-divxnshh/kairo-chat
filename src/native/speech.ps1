param([Parameter(Mandatory=$true)][string]$StopFile)
Add-Type -AssemblyName System.Speech
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
    $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $recognizer.SetInputToDefaultAudioDevice()
    $recognizer.BabbleTimeout = [TimeSpan]::FromSeconds(10)
    $words = New-Object System.Collections.Generic.List[string]
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $deadline -and -not (Test-Path -LiteralPath $StopFile)) {
        $result = $recognizer.Recognize([TimeSpan]::FromSeconds(3))
        if ($null -ne $result) { $words.Add($result.Text) }
    }
    if ($words.Count -eq 0) { throw 'No speech detected. Check microphone and speech settings.' }
    @{text=($words -join ' ')} | ConvertTo-Json -Compress
} catch { [Console]::Error.WriteLine('Speech recognition failed. Check microphone and Windows speech settings.'); exit 1 }
finally { $recognizer.Dispose() }
