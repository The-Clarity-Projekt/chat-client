const axios = require('axios');
const { Canopto } = require('canopto');

class PanoptoClient {
  constructor({ university, authToken }) {
    this.university = university;
    this.serverUrl = `https://${university}.hosted.panopto.com`;
    this.canopto = new Canopto({
      server: this.serverUrl,
      authToken: authToken,
    });
  }

  createIdentifier(videoId) {
    return `panopto-${this.university}-${videoId}`;
  }

  async getVideos(folderId = null) {
    try {
      const sessions = await this.canopto.getSessions({
        folderId: folderId,
      });
      
      return sessions.map(session => ({
        id: session.id,
        identifier: this.createIdentifier(session.id),
        title: session.name,
        duration: session.duration,
        creator: session.creator,
        created: session.created,
        folderId: session.folderId,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Panopto videos: ${error.message}`);
    }
  }

  async downloadVideo(videoId) {
    try {
      return await this.canopto.downloadVideo(videoId);
    } catch (error) {
      throw new Error(`Failed to download video ${videoId}: ${error.message}`);
    }
  }

  async extractAudio(videoData) {
    // Implementation of audio extraction
    // This would use ffmpeg to extract audio from video
  }
}

module.exports = { PanoptoClient }; 