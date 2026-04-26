const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { app } = require('electron');

class AudioExtractor {
  constructor() {
    this.tempDir = path.join(app.getPath('temp'), 'transcribe-app');
    fs.mkdir(this.tempDir, { recursive: true });
  }

  async extractAudio(videoPath, options = {}) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(this.tempDir, `extracted-${Date.now()}.wav`);
      
      ffmpeg(videoPath)
        .audioFrequency(16000) // Standard ASR sample rate
        .audioChannels(1)       // Mono
        .audioCodec('pcm_s16le') // Uncompressed WAV
        .outputOptions('-y')    // Overwrite
        .save(outputPath)
        .on('end', async () => {
          try {
            const buffer = await fs.readFile(outputPath);
            await fs.unlink(outputPath); // Cleanup
            resolve({ success: true, buffer, format: 'wav', sampleRate: 16000 });
          } catch (err) {
            reject(err);
          }
        })
        .on('error', reject);
    });
  }

  async getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        const stream = metadata.streams.find(s => s.codec_type === 'audio');
        resolve({
          duration: stream?.duration || metadata.format.duration,
          sampleRate: stream?.sample_rate,
          channels: stream?.channels,
          codec: stream?.codec_name
        });
      });
    });
  }
}

module.exports = AudioExtractor;
