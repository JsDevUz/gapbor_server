const express = require('express');
const router = express.Router();
const KeyManagementService = require('../services/key-management.service');
const { UserModel } = require('../models/user.model');

const keyService = new KeyManagementService();

// Generate keys for user (called during registration)
router.post('/generate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const keys = await keyService.generateUserKeys(userId);
    
    res.json({
      isOk: true,
      publicKey: keys.publicKey,
      fingerprint: keys.fingerprint,
      message: 'Encryption keys generated successfully'
    });
  } catch (error) {
    console.error('Error generating keys:', error);
    res.status(500).json({
      isOk: false,
      message: 'Failed to generate encryption keys'
    });
  }
});

// Get user's public key
router.get('/public/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const publicKeyInfo = await keyService.getUserPublicKey(userId);
    
    const response = {
      isOk: true,
      publicKey: publicKeyInfo.publicKey,
      fingerprint: publicKeyInfo.fingerprint,
      version: publicKeyInfo.version
    };
    
    if (publicKeyInfo.newlyGenerated) {
      response.message = 'Keys were auto-generated for this user';
      console.log(`✅ Auto-generated keys for user ${userId}`);
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error getting public key:', error);
    
    if (error.message === 'User not found') {
      res.status(404).json({
        isOk: false,
        message: 'User not found'
      });
    } else {
      res.status(500).json({
        isOk: false,
        message: 'Failed to retrieve public key'
      });
    }
  }
});

// Get multiple public keys for group
router.post('/group', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        isOk: false,
        message: 'User IDs array is required'
      });
    }

    const keyMap = await keyService.getGroupPublicKeys(userIds);
    
    res.json({
      isOk: true,
      keys: keyMap
    });
  } catch (error) {
    console.error('Error getting group keys:', error);
    res.status(500).json({
      isOk: false,
      message: 'Failed to retrieve group public keys'
    });
  }
});

// Rotate user keys
router.post('/rotate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const keys = await keyService.rotateUserKeys(userId);
    
    res.json({
      isOk: true,
      publicKey: keys.publicKey,
      fingerprint: keys.fingerprint,
      message: 'Keys rotated successfully'
    });
  } catch (error) {
    console.error('Error rotating keys:', error);
    res.status(500).json({
      isOk: false,
      message: 'Failed to rotate encryption keys'
    });
  }
});

// Verify key integrity
router.post('/verify/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({
        isOk: false,
        message: 'Public key is required'
      });
    }

    const isValid = await keyService.verifyKeyIntegrity(userId, publicKey);
    
    res.json({
      isOk: true,
      valid: isValid
    });
  } catch (error) {
    console.error('Error verifying key:', error);
    res.status(500).json({
      isOk: false,
      message: 'Failed to verify key integrity'
    });
  }
});

// Check if user has encryption keys
router.get('/has-keys/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const hasKeys = await keyService.hasEncryptionKeys(userId);
    
    res.json({
      isOk: true,
      hasKeys
    });
  } catch (error) {
    console.error('Error checking keys:', error);
    res.status(500).json({
      isOk: false,
      message: 'Failed to check encryption keys'
    });
  }
});

module.exports = router;
