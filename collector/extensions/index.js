const express = require('express');
const router = express.Router();
const { verifyPayloadIntegrity } = require("../middleware/verifyIntegrity");
const { reqBody } = require('../utils/http');
const { validURL } = require('../utils/validation');
const { processPanoptoVideo } = require('../processors/panopto');

function extensions(app) {
  if (!app) return;

  app.post('/ext/panopto', [verifyPayloadIntegrity], async (request, response) => {
    try {
      const { canvasUrl, canvasToken, courseId, options = {} } = reqBody(request);
      
      if (!canvasUrl || !canvasToken) {
        return response.status(400).json({
          success: false,
          reason: 'Missing required Canvas credentials'
        });
      }

      // Queue the processing job
      processPanoptoVideo({ canvasUrl, canvasToken, courseId, options })
        .catch(error => console.error('Processing failed:', error));

      return response.status(200).json({
        success: true,
        data: {
          message: 'Video processing started'
        }
      });
    } catch (error) {
      console.error(error);
      return response.status(500).json({
        success: false,
        reason: error.message
      });
    }
  });

  app.post(
    "/ext/website-depth",
    [verifyPayloadIntegrity],
    async function (request, response) {
      try {
        const websiteDepth = require("../utils/extensions/WebsiteDepth");
        const { url, depth = 1, maxLinks = 20 } = reqBody(request);
        
        if (!validURL(url)) {
          return response.status(400).json({ 
            success: false, 
            reason: "Not a valid URL." 
          });
        }

        const scrapedData = await websiteDepth(url, depth, maxLinks);
        return response.status(200).json({ success: true, data: scrapedData });
      } catch (e) {
        console.error(e);
        return response.status(400).json({ success: false, reason: e.message });
      }
    }
  );

  app.post(
    "/ext/confluence",
    [verifyPayloadIntegrity],
    async function (request, response) {
      try {
        const { loadConfluence } = require("../utils/extensions/Confluence");
        const { success, reason, data } = await loadConfluence(
          reqBody(request),
          response
        );
        return response.status(200).json({ success, reason, data });
      } catch (e) {
        console.error(e);
        return response.status(400).json({
          success: false,
          reason: e.message,
          data: {
            title: null,
            author: null,
          },
        });
      }
    }
  );

  return router;
}

module.exports = extensions;
