export function calculateStats(transcription, audioMetadata, inferenceMetadata) {
  const text = transcription.text?.trim() || '';
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const characters = text.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;
  
  const durationSec = audioMetadata?.duration || 0;
  const inferenceTime = inferenceMetadata?.inferenceTime || 0;
  
  return {
    // Text metrics
    wordCount: words.length,
    characterCount: characters,
    sentenceCount: sentences,
    avgWordLength: words.length > 0 
      ? (characters / words.length).toFixed(1) 
      : 0,
    
    // Timing metrics
    audioDuration: formatDuration(durationSec),
    wordsPerMinute: durationSec > 0 
      ? Math.round((words.length / durationSec) * 60) 
      : 0,
    
    // Performance metrics
    inferenceTimeMs: Math.round(inferenceTime),
    realtimeFactor: durationSec > 0 && inferenceTime > 0
      ? (durationSec * 1000 / inferenceTime).toFixed(2)
      : null,
    
    // Quality metrics
    confidence: inferenceMetadata?.confidence 
      ? (inferenceMetadata.confidence * 100).toFixed(1) + '%' 
      : 'N/A',
    
    // Model info
    model: inferenceMetadata?.model || 'Unknown',
    language: inferenceMetadata?.language || 'auto'
  };
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function updateStatsUI(stats) {
  document.getElementById('statDuration').textContent = stats.audioDuration;
  document.getElementById('statWords').textContent = stats.wordCount;
  document.getElementById('statWpm').textContent = stats.wordsPerMinute;
  document.getElementById('statConfidence').textContent = stats.confidence;
  document.getElementById('statInference').textContent = `${stats.inferenceTimeMs}ms`;
  document.getElementById('statModel').textContent = stats.model;
}
