const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { reqBody } = require('../../utils/http');

// Update workspace endpoints to only require authentication, not admin
router.post('/upload', requireAuth, async (request, response) => {
  try {
    // ... existing upload logic ...
  } catch (error) {
    console.error(error);
    response.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/connector', requireAuth, async (request, response) => {
  try {
    const { type, settings } = reqBody(request);
    // ... existing connector logic ...
  } catch (error) {
    console.error(error);
    response.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ... other workspace endpoints ...

module.exports = router; 