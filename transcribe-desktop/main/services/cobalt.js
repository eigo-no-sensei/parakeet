const axios = require('axios');

class CobaltService {
  constructor(apiUrl = 'https://api.cobalt.tools') {
    this.apiUrl = apiUrl;
  }

  async fetchAudio(youtubeUrl, options = {}) {
    try {
      const response = await axios.post(`${this.apiUrl}/`, {
        url: youtubeUrl,
        audio: true,
        audioFormat: options.format || 'mp3',
        audioQuality: options.quality || 'high',
        filenamePattern: 'basic'
      }, {
        headers: { 'Accept': 'application/json' },
        timeout: 60000
      });

      if (response.data?.url) {
        // Download the audio file
        const audioResponse = await axios.get(response.data.url, { 
          responseType: 'arraybuffer' 
        });
        return {
          success: true,
          buffer: audioResponse.data,
          metadata: response.data
        };
      }
      throw new Error(response.data?.text || 'Failed to fetch audio');
    } catch (error) {
      console.error('Cobalt API error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = CobaltService;
