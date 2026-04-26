# 🎙️ WebGPU Electron Transcription App

Parakeet + Cohere-Transcribe Speech-to-Text Desktop Application with WebGPU acceleration.

## 📋 Features

- **Multi-Model Support**: Choose from 4 state-of-the-art ASR models
  - Parakeet CTC 0.6B (English, Fast)
  - Parakeet TDT 0.6B v3 (25 Languages)
  - Parakeet CTC 1.1B (English, Accurate)
  - Cohere Transcribe 03-2026 (SOTA, 14 Languages)
- **WebGPU Acceleration**: GPU-powered inference with automatic fallback to CPU/WASM
- **Multiple Input Methods**:
  - 📁 Local audio/video files (MP3, WAV, M4A, MP4, WebM, MKV)
  - 🎬 YouTube URL extraction via Cobalt API
  - 🎤 Real-time microphone recording
- **Export Options**: TXT, SRT (subtitles), JSON formats
- **Privacy-First**: All inference runs locally on your machine

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Electron-compatible system with WebGPU support
- Modern GPU with Vulkan/DX12/Metal support

### Installation

```bash
cd transcribe-desktop
npm install
```

### Run the App

```bash
npm start
```

### Build for Distribution

```bash
npm run build
```

## 📁 Project Structure

```
transcribe-desktop/
├── package.json              # Dependencies & scripts
├── electron-builder.yml      # Build configuration
├── main/                     # Electron main process
│   ├── main.js               # Main entry point
│   ├── preload.js            # Context bridge API
│   └── services/
│       ├── cobalt.js         # YouTube audio fetcher
│       ├── ffmpeg.js         # Audio extraction
│       └── model-manager.js  # ONNX model downloads
├── renderer/                 # UI layer
│   ├── index.html            # Main HTML
│   ├── css/styles.css        # Styling
│   ├── js/
│   │   ├── app.js            # Main application logic
│   │   ├── transcription.js  # WebGPU inference engine
│   │   └── utils/
│   │       ├── audio.js      # Audio helpers
│   │       ├── clipboard.js  # Export utilities
│   │       └── stats.js      # Metrics calculation
│   └── assets/               # Static resources
├── models/                   # Downloaded ONNX models
└── utils/
    └── webgpu-check.js       # Feature detection
```

## 🔧 Configuration

### WebGPU Setup

WebGPU is enabled automatically in Electron with these flags:
- `--enable-unsafe-webgpu`
- `--enable-features=Vulkan`

If WebGPU is unavailable, the app falls back to WASM execution.

### Model Management

Models are downloaded on-demand from HuggingFace and stored in your user data directory:
- **Windows**: `%APPDATA%\transcribe-desktop\models`
- **macOS**: `~/Library/Application Support/transcribe-desktop/models`
- **Linux**: `~/.config/transcribe-desktop/models`

Each model requires 600MB–2GB disk space depending on quantization.

## 🧠 Models

| Model | Size | Languages | Speed | Accuracy |
|-------|------|-----------|-------|----------|
| Parakeet CTC 0.6B | ~600MB | English | ⚡⚡⚡ | Good |
| Parakeet TDT 0.6B v3 | ~650MB | 25 langs | ⚡⚡ | Very Good |
| Parakeet CTC 1.1B | ~1.1GB | English | ⚡⚡ | Excellent |
| Cohere Transcribe | ~2GB | 14 langs | ⚡ | SOTA |

**Supported Languages (Cohere)**: en, fr, de, es, it, pt, nl, pl, el, ar, ja, zh, vi, ko

## 🛠️ Development

### Adding New Models

1. Add model metadata to `main/services/model-manager.js`:
```javascript
'my-new-model': {
  repo: 'username/repo-name-onnx',
  files: ['model.onnx', 'config.json', 'tokenizer.json'],
  size: '~XXXMB'
}
```

2. Add option to `renderer/index.html` dropdown

3. Update transcription logic if needed in `renderer/js/transcription.js`

### Debugging

Enable Electron DevTools by adding to `main/main.js`:
```javascript
win.webContents.openDevTools();
```

Check WebGPU support:
```javascript
navigator.gpu.requestAdapter().then(adapter => {
  console.log('GPU:', adapter.name);
  console.log('Features:', adapter.features);
});
```

## ⚠️ Important Notes

1. **Memory Usage**: Large models can consume 2–4GB RAM. Monitor usage on low-end systems.

2. **First Run**: Initial model download may take several minutes depending on connection speed.

3. **FFmpeg**: Required for video audio extraction. Bundle binaries or use WASM version for portability.

4. **Cobalt API**: Public instances may have rate limits. Self-host for production use.

5. **WebGPU Compatibility**: Requires Electron ≥24 and compatible GPU drivers.

## 📦 Build Outputs

After running `npm run build`, find distributables in `dist/`:

- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` portable app

## 🔗 Resources

- [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-js.html)
- [Transformers.js](https://huggingface.co/docs/transformers.js)
- [WebGPU Spec](https://www.w3.org/TR/webgpu/)
- [Electron Docs](https://www.electronjs.org/docs)

## 📝 License

MIT License – see LICENSE file for details.

---

Built with ❤️ using Electron, WebGPU, and ONNX Runtime
