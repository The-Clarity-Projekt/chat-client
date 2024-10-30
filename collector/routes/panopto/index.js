const express = require('express');
const router = express.Router();
const { processPanoptoVideo } = require('../../processors/panopto');
const { validateRequest } = require('../../utils/middleware');

router.post('/', validateRequest, async (request, response) => {
  try {
    const { canvasUrl, canvasToken, courseId } = request.body;
    
    if (!canvasUrl || !canvasToken) {
      return response.status(400).json({
        success: false,
        reason: 'Missing required Canvas credentials'
      });
    }

    // Queue the processing job
    processPanoptoVideo({ canvasUrl, canvasToken, courseId })
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

module.exports = router; 