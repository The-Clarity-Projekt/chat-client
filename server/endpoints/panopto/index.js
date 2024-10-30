const express = require('express');
const router = express.Router();
const { processPanoptoVideosFromCanvas } = require('../../jobs/process-panopto-videos');
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

    // Start processing in background
    processPanoptoVideosFromCanvas({ canvasUrl, canvasToken, courseId })
      .catch(error => console.error('Background processing failed:', error));

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

module.exports = router; 