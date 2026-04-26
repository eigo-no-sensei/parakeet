import * as ort from 'onnxruntime-web/webgpu';

export class TranscriptionEngine {
  constructor() {
    this.sessions = new Map();
    this.currentModel = null;
    this.audioContext = null;
  }

  async initialize(modelKey, options = {}) {
    console.log('[TranscriptionEngine] Initializing model:', modelKey);
    
    // WebGPU execution provider setup
    const sessionOptions = {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      ...options
    };

    console.log('[TranscriptionEngine] Execution providers:', sessionOptions.executionProviders);
    
    try {
      console.log('[TranscriptionEngine] Creating WebGPU session...');
      const session = await ort.InferenceSession.create(modelKey, sessionOptions);
      this.sessions.set(modelKey, session);
      this.currentModel = modelKey;
      console.log('[TranscriptionEngine] WebGPU session created successfully');
      return { success: true, model: modelKey };
    } catch (error) {
      console.warn('WebGPU failed, falling back to WASM:', error.message);
      // Fallback to CPU/WASM
      const fallbackOptions = { executionProviders: ['wasm'] };
      console.log('[TranscriptionEngine] Creating WASM session...');
      const session = await ort.InferenceSession.create(modelKey, fallbackOptions);
      this.sessions.set(modelKey, session);
      return { success: true, model: modelKey, fallback: true };
    }
  }

  async transcribe(audioData, config = {}) {
    const session = this.sessions.get(config.model || this.currentModel);
    if (!session) throw new Error('Model not initialized');

    // Audio preprocessing: 16kHz mono, float32
    const processed = await this.preprocessAudio(audioData, config);
    
    // Run inference
    const feeds = {
      input: new ort.Tensor('float32', processed.samples, processed.shape)
    };
    
    const results = await session.run(feeds);
    
    // Post-process: decode tokens to text
    return this.decodeOutput(results, config);
  }

  async preprocessAudio(audioBuffer, config) {
    // Reuse or create AudioContext
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }
    
    const audioBufferDecoded = await this.audioContext.decodeAudioData(audioBuffer.slice(0));
    
    const channelData = audioBufferDecoded.getChannelData(0);
    return {
      samples: new Float32Array(channelData),
      shape: [1, channelData.length],
      sampleRate: 16000
    };
  }

  /**
   * Decode model output to text
   * Supports CTC (Connectionist Temporal Classification) decoding
   */
  decodeOutput(results, config = {}) {
    try {
      // Get output tensor - ONNX models typically output [batch, time, vocab_size]
      const outputTensor = results.output || results[Object.keys(results)[0]];
      if (!outputTensor) {
        return { text: '', confidence: 0, timestamps: [] };
      }

      const data = outputTensor.data;
      const [batch, time, vocabSize] = outputTensor.dims || [1, data.length, 1];
      
      // CTC decoding: argmax over time dimension
      const text = this.ctcDecode(data, time, vocabSize, config);
      
      return { 
        text, 
        confidence: this.calculateConfidence(data, time, vocabSize),
        timestamps: [] 
      };
    } catch (error) {
      console.error('Decode error:', error);
      return { text: '', confidence: 0, timestamps: [] };
    }
  }

  /**
   * CTC Greedy Decoding
   * - Argmax at each timestep
   * - Collapse consecutive duplicates
   * - Remove blanks
   */
  ctcDecode(data, time, vocabSize, config = {}) {
    // Get argmax for each timestep
    const indices = [];
    for (let t = 0; t < time; t++) {
      let maxIdx = 0;
      let maxVal = -Infinity;
      for (let v = 0; v < vocabSize; v++) {
        const val = data[t * vocabSize + v];
        if (val > maxVal) {
          maxVal = val;
          maxIdx = v;
        }
      }
      indices.push(maxIdx);
    }

    // CTC collapse: remove blanks (0) and consecutive duplicates
    let result = '';
    let prevIdx = -1;
    for (const idx of indices) {
      if (idx !== 0 && idx !== prevIdx) {
        result += String.fromCharCode(idx);
      }
      prevIdx = idx;
    }

    return result;
  }

  calculateConfidence(data, time, vocabSize) {
    // Average softmax confidence across timesteps
    let totalConf = 0;
    let count = 0;
    for (let t = 0; t < time; t++) {
      let maxVal = -Infinity;
      for (let v = 0; v < vocabSize; v++) {
        const val = data[t * vocabSize + v];
        if (val > maxVal) maxVal = val;
      }
      // Convert logit to approximate probability
      totalConf += Math.exp(maxVal);
      count++;
    }
    return count > 0 ? totalConf / count : 0;
  }

  async cleanup() {
    // Close all sessions and AudioContext
    for (const session of this.sessions.values()) {
      session?.end?.();
    }
    this.sessions.clear();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}
