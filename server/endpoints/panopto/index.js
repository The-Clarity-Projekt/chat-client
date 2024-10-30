const express = require('express');
const router = express.Router();
const { CollectorApi } = require('../../utils/collectorApi');
const { reqBody } = require('../../utils/http');

router.post('/', async (request, response) => {
  try {
    const { canvasUrl, canvasToken, courseId } = reqBody(request);
    
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

    return response.status(200).json(result);

  } catch (error) {
    console.error(error);
    return response.status(500).json({
      success: false,
      reason: error.message
    });
  }
});

module.exports = router; 