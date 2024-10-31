const express = require('express');
const router = express.Router();
const { verifyPayloadIntegrity } = require("../middleware/verifyIntegrity");
const { reqBody } = require('../utils/request');
const { validURL } = require('../utils/validation');

function extensions(app) {
  if (!app) return;

  app.post('/ext/panopto', [verifyPayloadIntegrity], async (request, response) => {
    try {
      const { canvasUrl, canvasToken, courseId, options = {} } = request.body;
      
      if (!canvasUrl || !canvasToken) {
        return response.status(400).json({
          success: false,
          reason: 'Missing required Canvas credentials'
        });
      }
      const collector = new CollectorApi();
      if (!(await collector.online())) {
        return response.status(503).json({
          success: false,
          reason: 'Collector service is not available'
        });
      }
  
      const result = await collector.processPanoptoVideos({
        canvasUrl,
        canvasToken,
        courseId,
      });
  
      return response.status(200).json({
        success: true,
        data: {
          ...result
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
    [verifyPayloadIntegrity, setDataSigner],
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
}

module.exports = extensions;
