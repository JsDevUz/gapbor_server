const express = require('express');
const router = express.Router();
const meetController = require('../controllers/meet.controller');
const { checkAuth } = require('../middlewares/checkAuth');

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer")) {
    const token = auth.split(" ")[1];
    const jwt = require("jsonwebtoken");
    const { decodeJWT } = require("../lib");
    
    decodeJWT(token).then(me => {
      if (me) {
        req.user = { _id: me.userId };
        next();
      } else {
        res.status(401).json({ success: false, message: "Token eskirgan" });
      }
    }).catch(() => {
      res.status(401).json({ success: false, message: "Token noto'g'ri" });
    });
  } else {
    res.status(401).json({ success: false, message: "Token kerak" });
  }
};

// Meet yaratish
router.post('/create', authMiddleware, meetController.createMeet);

// Meet ga qo'shilish uchun so'rov
router.post('/:meetId/join', authMiddleware, meetController.joinMeetRequest);

// Meet ga qo'shilishga ruxsat berish (creator uchun)
router.post('/:meetId/approve', authMiddleware, (req, res) => {
  console.log('Approve route hit:', req.params);
  meetController.approveJoinRequest(req, res);
});

// Meet ni tugatish (creator uchun)
router.post('/:meetId/end', authMiddleware, meetController.endMeet);

// Foydalanuvchining active meetlari
router.get('/user/meets', authMiddleware, meetController.getUserMeets);

// Meet ma'lumotlarini olish
router.get('/:meetId', authMiddleware, meetController.getMeetInfo);

module.exports = router;
