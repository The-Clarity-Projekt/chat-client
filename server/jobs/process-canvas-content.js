const { Document } = require('../models/documents.js');
const { CollectorApi } = require('../utils/collectorApi');
const { log, conclude } = require('./helpers/index.js');
const { getVectorDbClass } = require('../utils/helpers/index.js');
const { CanvasClient } = require('../utils/extensions/Canvas/client.js');
const { default: slugify } = require("slugify");
const path = require('path');
const fs = require('fs');
const { convert } = require('html-to-text');
const { GroqLLM } = require('../utils/AiProviders/groq');

// Create deterministic identifiers for Canvas content
function createIdentifier(university, courseId, type, itemId) {
  return `canvas-${university}-${courseId}-${type}-${itemId}`;
}

async function isContentProcessed(identifier) {
  try {
    const existingDocs = await Document.where({
      metadata: {
        contains: identifier
      }
    });
    return existingDocs.length > 0;
  } catch (error) {
    log(`Error checking for existing content: ${error.message}`);
    return false;
  }
}

async function processCoursePage(course, page, canvasClient) {
  const identifier = createIdentifier(canvasClient.university, course.id, 'page', page.url);
  
  try {
    if (await isContentProcessed(identifier)) {
      log(`Page ${identifier} already processed. Skipping.`);
      return null;
    }

    const content = await canvasClient.getPageContent(course.id, page.url);
    const textContent = convert(content, {
      wordwrap: false,
      preserveNewlines: true,
    });

    return {
      id: identifier,
      title: page.title,
      content: textContent,
      metadata: {
        source: 'canvas',
        type: 'page',
        identifier,
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        pageUrl: page.url,
        lastUpdated: page.updated_at,
        university: canvasClient.university,
      }
    };
  } catch (error) {
    log(`Failed to process page ${identifier}: ${error.message}`);
    return null;
  }
}

async function processCourseFiles(course, file, canvasClient) {
  const identifier = createIdentifier(canvasClient.university, course.id, 'file', file.id);
  
  try {
    if (await isContentProcessed(identifier)) {
      log(`File ${identifier} already processed. Skipping.`);
      return null;
    }

    // Only process text-based files
    if (!file.content_type.includes('text') && !file.content_type.includes('pdf')) {
      log(`Skipping non-text file: ${file.filename}`);
      return null;
    }

    const fileData = await canvasClient.downloadFile(file.url);
    // Here you would process the file based on its type
    // Similar to how you handle other document types in your system
    
    return {
      id: identifier,
      title: file.filename,
      content: processedContent, // This would come from your file processing
      metadata: {
        source: 'canvas',
        type: 'file',
        identifier,
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        fileType: file.content_type,
        size: file.size,
        lastUpdated: file.updated_at,
        university: canvasClient.university,
      }
    };
  } catch (error) {
    log(`Failed to process file ${identifier}: ${error.message}`);
    return null;
  }
}

async function processPanoptoVideosForCourse(course, canvasClient, groq) {
  try {
    log(`Getting Panopto videos for course: ${course.name}`);
    const videos = await canvasClient.getPanoptoVideos(course.id);
    
    const processedVideos = [];
    const skippedVideos = [];

    for (const video of videos) {
      const identifier = `canvas-panopto-${canvasClient.university}-${course.id}-${video.id}`;
      
      // Check if already processed
      if (await isContentProcessed(identifier)) {
        log(`Video ${identifier} already processed. Skipping.`);
        skippedVideos.push(video.title);
        continue;
      }

      try {
        const videoData = await video.download();
        const audioBuffer = await video.extractAudio(videoData);
        const transcript = await groq.transcribeAudio(audioBuffer);

        const document = {
          id: identifier,
          title: `${course.name} - ${video.title}`,
          content: transcript,
          metadata: {
            source: 'canvas-panopto',
            type: 'video',
            identifier,
            courseId: course.id,
            courseName: course.name,
            courseCode: course.code,
            videoId: video.id,
            duration: video.duration,
            creator: video.creator,
            created: video.created,
            university: canvasClient.university,
          }
        };

        const vectorDb = getVectorDbClass();
        await vectorDb.addDocumentToNamespace(
          'canvas',
          document,
          `canvas/panopto/${identifier}.json`
        );

        processedVideos.push(video.title);
        log(`Successfully processed video: ${video.title}`);
      } catch (error) {
        log(`Failed to process video ${video.title}: ${error.message}`);
        skippedVideos.push(video.title);
      }
    }

    return { processedVideos, skippedVideos };
  } catch (error) {
    log(`Failed to process Panopto videos for course ${course.name}: ${error.message}`);
    return { processedVideos: [], skippedVideos: [] };
  }
}

(async () => {
  try {
    const collector = new CollectorApi();
    if (!(await collector.online())) {
      log('Could not reach collector API. Exiting.');
      return;
    }

    const { university, authToken } = process.env.CANVAS_CONFIG 
      ? JSON.parse(process.env.CANVAS_CONFIG) 
      : {};

    if (!university || !authToken) {
      log('Missing required Canvas configuration');
      return;
    }

    const canvasClient = new CanvasClient({
      university,
      authToken,
    });

    const courses = await canvasClient.getCourses();
    log(`Found ${courses.length} courses to process`);

    const processedItems = [];
    const skippedItems = [];
    const vectorDb = getVectorDbClass();
    const groq = new GroqLLM();

    for (const course of courses) {
      // Process course syllabus if it exists
      if (course.syllabus) {
        const syllabusIdentifier = createIdentifier(university, course.id, 'syllabus', 'main');
        if (!(await isContentProcessed(syllabusIdentifier))) {
          const textContent = convert(course.syllabus, {
            wordwrap: false,
            preserveNewlines: true,
          });

          const syllabusDoc = {
            id: syllabusIdentifier,
            title: `${course.name} Syllabus`,
            content: textContent,
            metadata: {
              source: 'canvas',
              type: 'syllabus',
              identifier: syllabusIdentifier,
              courseId: course.id,
              courseName: course.name,
              courseCode: course.code,
              university: canvasClient.university,
            }
          };

          await vectorDb.addDocumentToNamespace(
            'canvas',
            syllabusDoc,
            `canvas/${syllabusIdentifier}.json`
          );
          processedItems.push(`Syllabus: ${course.name}`);
        }
      }

      // Process pages
      const pages = await canvasClient.getPages(course.id);
      for (const page of pages) {
        const document = await processCoursePage(course, page, canvasClient);
        if (!document) {
          skippedItems.push(`Page: ${page.title}`);
          continue;
        }

        await vectorDb.addDocumentToNamespace(
          'canvas',
          document,
          `canvas/${document.id}.json`
        );
        processedItems.push(`Page: ${page.title}`);
      }

      // Process files
      const files = await canvasClient.getFiles(course.id);
      for (const file of files) {
        const document = await processCourseFiles(course, file, canvasClient);
        if (!document) {
          skippedItems.push(`File: ${file.filename}`);
          continue;
        }

        await vectorDb.addDocumentToNamespace(
          'canvas',
          document,
          `canvas/${document.id}.json`
        );
        processedItems.push(`File: ${file.filename}`);
      }

      // Process Panopto videos
      const { processedVideos, skippedVideos } = await processPanoptoVideosForCourse(
        course, 
        canvasClient,
        groq
      );
      
      processedItems.push(...processedVideos.map(title => `Video: ${title}`));
      skippedItems.push(...skippedVideos.map(title => `Video: ${title}`));
    }

    log(`Processing complete. Processed ${processedItems.length} items, skipped ${skippedItems.length} items.`);
    if (skippedItems.length > 0) {
      log(`Skipped items: ${skippedItems.join(', ')}`);
    }

  } catch (error) {
    console.error(error);
    log(`Error: ${error.message}`);
  } finally {
    conclude();
  }
})(); 