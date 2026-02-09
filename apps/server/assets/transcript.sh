#!/bin/bash

MODEL="$HOME/.cache/whispercpp/ggml-base.bin"

echo "🎙️ Transcribing mp3 files (French)"
echo ""

find . -type f -iname "*.mp3" | while read -r file; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📹 Processing: $file"
    
    whisper-cli -m "$MODEL" -l fr -f "$file" -otxt -of "${file%.mp3}"
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Saved to: ${file%.mp3}.txt"
    else
        echo "❌ Failed: $file"
    fi
    echo ""
done

echo "🏁 Done!"
