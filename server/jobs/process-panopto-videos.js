const { Document } = require('../models/documents.js');
const { CollectorApi } = require('../utils/collectorApi');
const { log, conclude } = require('./helpers/index.js');
const { getVectorDbClass } = require('../utils/helpers/index.js');
const { GroqLLM } = require('../utils/AiProviders/groq');
const { PanoptoClient } = require('../utils/extensions/Panopto/client.js');
const { default: slugify } = require("slugify");
const path = require('path');
const fs = require('fs');

// Create a deterministic identifier for a Panopto video
function createVideoIdentifier(university, videoId) {
  return `panopto-${university}-${videoId}`;
}

// Check if video has already been processed
async function isVideoProcessed(university, videoId, documentsPath) {
  const identifier = createVideoIdentifier(university, videoId);
  try {
    // Check if any documents contain this identifier
    const existingDocs = await Document.where({
      metadata: {
        contains: identifier
      }
    });
    return existingDocs.length > 0;
  } catch (error) {
    log(`Error checking for existing video: ${error.message}`);
    return false;
  }
}

async function processPanoptoVideo(video, panoptoClient, groq, university) {
  const identifier = createVideoIdentifier(university, video.id);
  
  try {
    log(`Processing video: ${video.title} (${identifier})`);
    
    // Check if already processed
    if (await isVideoProcessed(university, video.id, documentsPath)) {
      log(`Video ${identifier} has already been processed. Skipping.`);
      return null;
    }
    
    const videoData = await panoptoClient.downloadVideo(video.id);
    const audioBuffer = await panoptoClient.extractAudio(videoData);
    const transcript = await groq.transcribeAudio(audioBuffer);
    
    const document = {
      id: video.id,
      title: video.title,
      content: transcript,
      metadata: {
        source: 'panopto',
        identifier: identifier, // Add deterministic identifier to metadata
        videoId: video.id,
        duration: video.duration,
        creator: video.creator,
        created: video.created,
        folder: video.folderId,
        university: university,
        serverUrl: panoptoClient.serverUrl,
      }
    };

    return document;
  } catch (error) {
    log(`Failed to process video ${identifier}: ${error.message}`);
    return null;
  }
}

(async () => {
  try {
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

    const groq = new GroqLLM();
    const videos = await panoptoClient.getVideos(folderId);
    log(`Found ${videos.length} videos to process`);

    const processedVideos = [];
    const skippedVideos = [];

    for (const video of videos) {
      const document = await processPanoptoVideo(video, panoptoClient, groq, university);
      if (!document) {
        skippedVideos.push(video.title);
        continue;
      }

      const identifier = createVideoIdentifier(university, video.id);
      const vectorDb = getVectorDbClass();
      
      // Use deterministic file path based on identifier
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