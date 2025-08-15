const express = require('express');
const { authenticateToken } = require('../../../middleware');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;