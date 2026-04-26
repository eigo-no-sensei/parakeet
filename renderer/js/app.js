import { TranscriptionEngine } from './transcription.js';
import { copyToClipboard, generateSrt, generateStats } from './utils/clipboard.js';
import { calculateStats, updateStatsUI } from './utils/stats.js';

class App {
  constructor() {
    this.engine = new TranscriptionEngine();
    this.currentAudio = null;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingStartTime = null;
    this.timerInterval = null;
    
    this.initElements();
    this.bindEvents();
    this.checkWebGPUSupport();
  }

  initElements() {
    // Model selection
    this.modelSelect = document.getElementById('modelSelect');
    this.loadModelBtn = document.getElementById('loadModelBtn');
    this.modelStatus = document.getElementById('modelStatus');
    
    // Input tabs
    this.tabs = document.querySelectorAll('.tab');
    this.inputPanels = document.querySelectorAll('.input-panel');
    
    // File input
    this.audioFileInput = document.getElementById('audioFile');
    
    // YouTube input
    this.youtubeUrlInput = document.getElementById('youtubeUrl');
    this.fetchYouTubeBtn = document.getElementById('fetchYouTubeBtn');
    
    // Recording
    this.recordBtn = document.getElementById('recordBtn');
    this.stopRecordBtn = document.getElementById('stopRecordBtn');
    this.recordingTimer = document.getElementById('recordingTimer');
    
    // Controls
    this.transcribeBtn = document.getElementById('transcribeBtn');
    this.cancelBtn = document.getElementById('cancelBtn');
    this.progressFill = document.getElementById('progressFill');
    this.progressText = document.getElementById('progressText');
    
    // Results
    this.transcriptionText = document.getElementById('transcriptionText');
    this.copyBtn = document.getElementById('copyBtn');
    this.exportTxtBtn = document.getElementById('exportTxtBtn');
    this.exportSrtBtn = document.getElementById('exportSrtBtn');
    this.exportJsonBtn = document.getElementById('exportJsonBtn');
  }

  bindEvents() {
    // Model loading
    this.loadModelBtn.addEventListener('click', () => this.loadModel());
    
    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    
    // File input
    this.audioFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    // YouTube fetch
    this.fetchYouTubeBtn.addEventListener('click', () => this.fetchYouTubeAudio());
    
    // Recording
    this.recordBtn.addEventListener('click', () => this.startRecording());
    this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
    
    // Transcription
    this.transcribeBtn.addEventListener('click', () => this.transcribe());
    this.cancelBtn.addEventListener('click', () => this.cancelTranscription());
    
    // Export actions
    this.copyBtn.addEventListener('click', () => this.copyTranscription());
    this.exportTxtBtn.addEventListener('click', () => this.exportTxt());
    this.exportSrtBtn.addEventListener('click', () => this.exportSrt());
    this.exportJsonBtn.addEventListener('click', () => this.exportJson());
  }

  async checkWebGPUSupport() {
    if (!navigator.gpu) {
      this.modelStatus.textContent = '⚠️ WebGPU not available';
      this.modelStatus.className = 'status error';
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        this.modelStatus.textContent = '⚠️ No GPU adapter found';
        this.modelStatus.className = 'status error';
        return false;
      }
      
      this.modelStatus.textContent = '✓ WebGPU ready';
      this.modelStatus.className = 'status success';
      return true;
    } catch (error) {
      this.modelStatus.textContent = '⚠️ WebGPU error';
      this.modelStatus.className = 'status error';
      console.error('WebGPU check failed:', error);
      return false;
    }
  }

  switchTab(tabName) {
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    this.inputPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}Input`);
    });
  }

  async loadModel() {
    const modelName = this.modelSelect.value;
    this.modelStatus.textContent = '⏳ Loading...';
    this.modelStatus.className = 'status loading';
    this.loadModelBtn.disabled = true;

    try {
      // Check if model exists locally first
      const models = await window.electronAPI.listModels();
      const modelInfo = models.find(m => m.key === modelName);
      
      if (!modelInfo?.installed) {
        this.progressText.textContent = 'Downloading model...';
        await window.electronAPI.downloadModel(modelName);
      }
      
      // Initialize in renderer
      await this.engine.initialize(modelName);
      
      this.modelStatus.textContent = '✓ Model loaded';
      this.modelStatus.className = 'status success';
      this.transcribeBtn.disabled = false;
    } catch (error) {
      this.modelStatus.textContent = '✗ Load failed';
      this.modelStatus.className = 'status error';
      console.error('Model load error:', error);
    } finally {
      this.loadModelBtn.disabled = false;
    }
  }

  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentAudio = e.target.result;
      this.transcribeBtn.disabled = false;
      this.progressText.textContent = `📁 ${file.name}`;
    };
    reader.readAsArrayBuffer(file);
  }

  async fetchYouTubeAudio() {
    const url = this.youtubeUrlInput.value.trim();
    if (!url) {
      alert('Please enter a YouTube URL');
      return;
    }

    this.fetchYouTubeBtn.disabled = true;
    this.progressText.textContent = '🎬 Fetching audio...';

    try {
      const result = await window.electronAPI.fetchYouTubeAudio(url);
      
      if (result.success) {
        this.currentAudio = result.buffer;
        this.transcribeBtn.disabled = false;
        this.progressText.textContent = '✓ Audio fetched';
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.progressText.textContent = '✗ Fetch failed';
      console.error('YouTube fetch error:', error);
      alert('Failed to fetch audio: ' + error.message);
    } finally {
      this.fetchYouTubeBtn.disabled = false;
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (e) => {
        this.audioChunks.push(e.data);
      };
      
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        this.currentAudio = arrayBuffer;
        this.transcribeBtn.disabled = false;
        this.progressText.textContent = '✓ Recording ready';
      };
      
      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      
      this.recordBtn.disabled = true;
      this.stopRecordBtn.disabled = false;
      this.progressText.textContent = '🎤 Recording...';
      
      // Start timer
      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        this.recordingTimer.textContent = `${mins}:${secs}`;
      }, 1000);
      
    } catch (error) {
      console.error('Recording error:', error);
      alert('Failed to access microphone: ' + error.message);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      
      this.isRecording = false;
      this.recordBtn.disabled = false;
      this.stopRecordBtn.disabled = true;
      this.recordingTimer.textContent = '00:00';
      
      clearInterval(this.timerInterval);
    }
  }

  async transcribe() {
    if (!this.currentAudio) {
      alert('Please select or record audio first');
      return;
    }

    this.transcribeBtn.disabled = true;
    this.cancelBtn.disabled = false;
    this.progressFill.style.width = '0%';
    this.progressText.textContent = '⏳ Transcribing...';
    this.transcriptionText.value = '';

    const startTime = performance.now();
    const modelName = this.modelSelect.value;

    try {
      let result;
      
      // Use Cohere pipeline for cohere-transcribe model
      if (modelName === 'cohere-transcribe-03-2026') {
        if (!this.engine.transcriber) {
          await this.engine.loadCohereTranscribe();
        }
        // Create blob URL for transcription
        const audioBlob = new Blob([this.currentAudio], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        result = await this.engine.transcribeWithCohere(audioUrl);
        URL.revokeObjectURL(audioUrl);
      } else {
        result = await this.engine.transcribe(this.currentAudio, { model: modelName });
      }

      const inferenceTime = performance.now() - startTime;
      
      // Display results
      this.transcriptionText.value = result.text;
      this.progressFill.style.width = '100%';
      this.progressText.textContent = '✓ Complete';
      
      // Update stats
      const stats = calculateStats(
        result,
        { duration: 0 }, // Would get from audio metadata
        { 
          inferenceTime,
          confidence: result.confidence || 0.95,
          model: modelName
        }
      );
      updateStatsUI(stats);
      
      // Store for export
      this.currentResult = { ...result, metadata: { inferenceTime, model: modelName } };
      
    } catch (error) {
      this.progressText.textContent = '✗ Error';
      console.error('Transcription error:', error);
      alert('Transcription failed: ' + error.message);
    } finally {
      this.transcribeBtn.disabled = false;
      this.cancelBtn.disabled = true;
    }
  }

  cancelTranscription() {
    // Cancel ongoing transcription (would need engine support)
    this.transcribeBtn.disabled = false;
    this.cancelBtn.disabled = true;
    this.progressText.textContent = 'Cancelled';
  }

  async copyTranscription() {
    const text = this.transcriptionText.value;
    if (!text) return;
    
    const result = await copyToClipboard(text);
    if (result.success) {
      this.copyBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        this.copyBtn.textContent = '📋 Copy';
      }, 2000);
    }
  }

  async exportTxt() {
    const text = this.transcriptionText.value;
    if (!text) return;
    
    await window.electronAPI.saveFile(text, 'transcription.txt', '.txt');
  }

  async exportSrt() {
    if (!this.currentResult) return;
    
    const srtContent = generateSrt(this.currentResult);
    await window.electronAPI.saveFile(srtContent, 'transcription.srt', '.srt');
  }

  async exportJson() {
    if (!this.currentResult) return;
    
    const jsonContent = JSON.stringify(this.currentResult, null, 2);
    await window.electronAPI.saveFile(jsonContent, 'transcription.json', '.json');
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
