const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { app } = require('electron');

// Model registry - standardized file order for all models
const MODELS = {
  'parakeet-ctc-0.6b': {
    repo: 'istupakov/parakeet-ctc-0.6b-onnx',
    files: ['model.onnx', 'config.json', 'tokenizer.json'],
    size: '~600MB'
  },
  'parakeet-tdt-0.6b-v3': {
    repo: 'istupakov/parakeet-tdt-0.6b-v3-onnx',
    files: ['model.onnx', 'config.json', 'tokenizer.json'],
    size: '~650MB (INT8)'
  },
  'parakeet-ctc-1.1b': {
    repo: 'onnx-community/parakeet-ctc-1.1b-ONNX',
    files: ['model.onnx', 'config.json', 'tokenizer.json'],
    size: '~1.1GB'
  }
};

class ModelManager {
  constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'models');
  }

  async ensureModelsDir() {
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  async verifyFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      // Basic verification: file exists and has content
      if (stats.size === 0) {
        throw new Error('File is empty');
      }
      // Read first few bytes to verify file is readable
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(4);
      await fd.read(buffer, 0, 4, 0);
      await fd.close();
      return { valid: true, size: stats.size };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async downloadModel(modelKey, onProgress) {
    const model = MODELS[modelKey];
    if (!model) throw new Error(`Unknown model: ${modelKey}`);

    await this.ensureModelsDir();
    const modelDir = path.join(this.modelsDir, modelKey);
    await fs.mkdir(modelDir, { recursive: true });

    const results = [];
    for (const file of model.files) {
      const url = `https://huggingface.co/${model.repo}/resolve/main/${file}`;
      const dest = path.join(modelDir, file);
      
      // Check if already downloaded and verified
      try { 
        const verification = await this.verifyFile(dest);
        if (verification.valid) {
          results.push({ file, status: 'exists', verified: true, size: verification.size }); 
          continue; 
        }
        // File exists but invalid, delete and re-download
        await fs.unlink(dest);
      } catch {}

      // Download with progress and retry logic
      let lastError = null;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await axios.get(url, { 
            responseType: 'stream',
            timeout: 300000, // 5 minute timeout for large files
            maxRedirects: 5,
            headers: {
              'User-Agent': 'transcribe-desktop/1.0.0'
            }
          });
          
          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          
          const writer = fs.createWriteStream(dest);
          
          response.data.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalSize > 0) {
              const percent = Math.round((downloadedBytes / totalSize) * 100);
              onProgress({ file, percent, downloaded: downloadedBytes, total: totalSize });
            }
          });
          
          response.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          
          // Verify the downloaded file
          const verification = await this.verifyFile(dest);
          if (!verification.valid) {
            throw new Error(`Downloaded file verification failed for ${file}: ${verification.error}`);
          }
          
          results.push({ file, status: 'downloaded', verified: true, size: verification.size });
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          // Clean up partial download
          try { await fs.unlink(dest); } catch {}
          
          if (attempt === maxRetries) {
            throw new Error(`Failed to download ${file} after ${maxRetries} attempts: ${error.message}`);
          }
          // Wait before retry (exponential backoff)
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
    return { success: true, model: modelKey, results };
  }

  async listModels() {
    await this.ensureModelsDir();
    const installed = [];
    
    for (const [key, meta] of Object.entries(MODELS)) {
      const modelDir = path.join(this.modelsDir, key);
      try {
        await fs.access(path.join(modelDir, 'model.onnx'));
        installed.push({ key, ...meta, installed: true });
      } catch {
        installed.push({ key, ...meta, installed: false });
      }
    }
    return installed;
  }
}

module.exports = ModelManager;
