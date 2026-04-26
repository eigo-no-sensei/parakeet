export async function copyToClipboard(text) {
  try {
    await window.electronAPI.copyToClipboard(text);
    return { success: true };
  } catch (error) {
    // Fallback to navigator.clipboard
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to copy to clipboard' };
    }
  }
}

export function generateSrt(transcription, options = {}) {
  // Convert transcription with timestamps to SRT format
  const { text, chunks = [] } = transcription;
  
  if (chunks.length === 0) {
    return `1\n00:00:00,000 --> 00:00:05,000\n${text}\n\n`;
  }
  
  return chunks.map((chunk, i) => {
    const start = formatTime(chunk.timestamp?.[0] || 0);
    const end = formatTime(chunk.timestamp?.[1] || 0);
    return `${i + 1}\n${start} --> ${end}\n${chunk.text}\n`;
  }).join('\n');
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

export function generateStats(transcription, metadata) {
  const wordCount = transcription.text.trim().split(/\s+/).filter(w => w).length;
  const duration = metadata.duration || 0;
  const wpm = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;
  
  return {
    duration: `${Math.round(duration)}s`,
    words: wordCount,
    wpm: wpm,
    confidence: `${Math.round((metadata.confidence || 0) * 100)}%`,
    inferenceTime: `${Math.round(metadata.inferenceTime || 0)}ms`,
    model: metadata.model
  };
}
