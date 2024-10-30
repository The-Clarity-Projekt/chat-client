const { Document } = require('../models/documents.js');
const { CollectorApi } = require('../utils/collectorApi');
const { log, conclude } = require('./helpers/index.js');
const { getVectorDbClass } = require('../utils/helpers/index.js');
const { TranscriptionQueue } = require('../utils/queues/TranscriptionQueue');
const Groq = require('groq-sdk');
const { PanoptoClient } = require('../utils/extensions/Panopto/client.js');
const { default: slugify } = require("slugify");
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create a deterministic identifier for a Panopto video
function createVideoIdentifier(university, videoId) {
  return `panopto-${university}-${videoId}`;
}

async function transcribeAudioWithGroq(audioPath) {
  const groq = new Groq();
  groq.apiKey = process.env.GROQ_API_KEY;

  const transcriptionFn = async (audioPath) => {
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-large-v3-turbo",
        response_format: "text",
        language: "en",
        temperature: 0.0,
      });
      return transcription.text;
    } catch (error) {
      throw new Error(`Groq transcription failed: ${error.message}`);
    }
  };

  // Add to global queue and wait for result
  const queue = TranscriptionQueue.getInstance();
  return await queue.addToQueue(audioPath, transcriptionFn);
}

async function processPanoptoVideo(video, panoptoClient, university) {
  const identifier = createVideoIdentifier(university, video.id);
  const tempDir = path.join(os.tmpdir(), 'panopto-processing');
  
  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const queue = TranscriptionQueue.getInstance();
    log(`Processing video: ${video.title} (${identifier}). Queue length: ${queue.getQueueLength()}, Active transcriptions: ${queue.getActiveTranscriptions()}`);
    
    // Check if already processed
    if (await isVideoProcessed(university, video.id)) {
      log(`Video ${identifier} has already been processed. Skipping.`);
      return null;
    }
    
    const videoData = await panoptoClient.downloadVideo(video.id);
    const audioBuffer = await panoptoClient.extractAudio(videoData);
    
    // Save audio buffer to temporary file
    const audioPath = path.join(tempDir, `${identifier}.mp3`);
    fs.writeFileSync(audioPath, audioBuffer);
    
    // Transcribe using Groq
    const transcript = await transcribeAudioWithGroq(audioPath);
    
    // Clean up temporary file
    fs.unlinkSync(audioPath);
    
    const document = {
      id: video.id,
      title: video.title,
      content: transcript,
      metadata: {
        source: 'panopto',
        identifier: identifier,
        videoId: video.id,
        duration: video.duration,
        creator: video.creator,
        created: video.created,
        folder: video.folderId,
        university: university,
        serverUrl: panoptoClient.serverUrl,
      }
    };

    log(`Transcription complete for ${video.title}. Remaining in queue: ${queue.getQueueLength()}`);
    
    return document;
  } catch (error) {
    log(`Failed to process video ${identifier}: ${error.message}`);
    // Clean up temporary files in case of error
    const audioPath = path.join(tempDir, `${identifier}.mp3`);
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    return null;
  }
}

// Main execution
(async () => {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }

    const collector = new CollectorApi();
    if (!(await collector.online())) {
      log('Could not reach collector API. Exiting.');
      return;
    }

    const { university, authToken, folderId } = process.env.PANOPTO_CONFIG 
      ? JSON.parse(process.env.PANOPTO_CONFIG) 
      : {};

    if (!university || !authToken) {
      log('Missing required Panopto configuration');
      return;
    }

    const panoptoClient = new PanoptoClient({
      university,
      authToken,
    });

    const videos = await panoptoClient.getVideos(folderId);
    log(`Found ${videos.length} videos to process`);

    const processedVideos = [];
    const skippedVideos = [];

    for (const video of videos) {
      const document = await processPanoptoVideo(video, panoptoClient, university);
      if (!document) {
        skippedVideos.push(video.title);
        continue;
      }

      const identifier = createVideoIdentifier(university, video.id);
      const vectorDb = getVectorDbClass();
      
      const filePath = `panopto/${identifier}.json`;
      
      await vectorDb.addDocumentToNamespace(
        'panopto',
        document,
        filePath
      );

      processedVideos.push(video.title);
      log(`Successfully processed video: ${video.title}`);
    }

    log(`Processing complete. Processed ${processedVideos.length} videos, skipped ${skippedVideos.length} videos.`);
    if (skippedVideos.length > 0) {
      log(`Skipped videos: ${skippedVideos.join(', ')}`);
    }

  } catch (error) {
    console.error(error);
    log(`Error: ${error.message}`);
  } finally {
    conclude();
  }
})(); 