const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { app } = require('electron');

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
  },
  'cohere-transcribe-03-2026': {
    repo: 'onnx-community/cohere-transcribe-03-2026-ONNX',
    files: ['model.onnx', 'tokenizer.json', 'config.json'],
    size: '~2GB (INT4 quantized)'
  }
};

class ModelManager {
  constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'models');
  }

  async ensureModelsDir() {
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  async downloadModel(modelKey) {
    const model = MODELS[modelKey];
    if (!model) throw new Error(`Unknown model: ${modelKey}`);

    await this.ensureModelsDir();
    const modelDir = path.join(this.modelsDir, modelKey);
    await fs.mkdir(modelDir, { recursive: true });

    const results = [];
    for (const file of model.files) {
      const url = `https://huggingface.co/${model.repo}/resolve/main/${file}`;
      const dest = path.join(modelDir, file);
      
      // Check if already downloaded
      try { await fs.access(dest); results.push({ file, status: 'exists' }); continue; } 
      catch {}

      // Download with progress
      const response = await axios.get(url, { responseType: 'stream' });
      const writer = fs.createWriteStream(dest);
      
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      results.push({ file, status: 'downloaded' });
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
