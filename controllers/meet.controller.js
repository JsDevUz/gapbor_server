const Meet = require('../models/Meet');
const { UserModel } = require("../models/user.model");
const { v4: uuidv4 } = require('uuid');

class MeetController {
  // Yangi meet yaratish
  async createMeet(req, res) {
    try {
      const { title, description } = req.body;
      const userId = req.user._id;

      // Meet ID yaratish
      const meetId = uuidv4().slice(0, 8); // 8 xonali ID

      // Yangi meet yaratish
      const meet = new Meet({
        meetId,
        title: title || 'Video Meeting',
        description: description || '',
        creator: userId,
        participants: [userId], // Creator avtomatik qo'shiladi
        isActive: true,
        createdAt: new Date()
      });

      await meet.save();

      // Creator ma'lumotlarini qo'shish
      const creator = await UserModel.findById(userId).select('fullName pic');
      
      res.status(201).json({
        success: true,
        meet: {
          ...meet.toObject(),
          creator: {
            id: creator._id,
            fullName: creator.fullName,
            pic: creator.pic
          }
        }
      });
    } catch (error) {
      console.error('Error creating meet:', error);
      res.status(500).json({
        success: false,
        message: 'Meet yaratishda xatolik',
        error: error.message
      });
    }
  }

  // Meet ga qo'shilish uchun so'rov
  async joinMeetRequest(req, res) {
    try {
      const { meetId } = req.params;
      const userId = req.user._id;
console.log(userId);

      // Meet ni topish
      const meet = await Meet.findOne({ meetId, isActive: true })
        .populate('creator', 'fullName pic')
        .populate('participants', 'fullName pic');

      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meet topilmadi yoki faol emas'
        });
      }

      // User allaqachon qo'shilganmi
      if (meet.participants.some(p => p._id.toString() === userId)) {
        return res.status(400).json({
          success: false,
          message: 'Siz allaqachon ushbu meetda qatnashmoqdasiz'
        });
      }

      // User ma'lumotlarini olish
      const user = await UserModel.findById(userId).select('fullName pic');

      res.status(200).json({
        success: true,
        meet: {
          ...meet.toObject(),
          joinRequest: {
            userId,
            fullName: user?.fullName||'fd',
            pic: user?.pic||'fd',
            requestedAt: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Error joining meet:', error);
      res.status(500).json({
        success: false,
        message: 'Meet ga qo\'shilishda xatolik',
        error: error.message
      });
    }
  }

  // Meet ga qo'shilishga ruxsat berish (creator uchun)
  async approveJoinRequest(req, res) {
    try {
      const { meetId } = req.params;
      const { userId } = req.body;
      const creatorId = req.user._id;

      // Meet ni topish va creator ekanligini tekshirish
      const meet = await Meet.findOne({ meetId, creator: creatorId, isActive: true });
console.log(meet,creatorId,meetId,userId);

      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meet topilmadi yoki siz creator emassiz'
        });
      }

      // User allaqachon qo'shilganmi
      if (meet.participants.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: 'User allaqachon qo\'shilgan'
        });
      }

      // User ni qo'shish
      meet.participants.push(userId);
      await meet.save();

      // User ma'lumotlarini olish
      const user = await UserModel.findById(userId).select('fullName pic');

      res.status(200).json({
        success: true,
        message: 'User muvaffaqiyatli qo\'shildi',
        participant: {
          id: user._id,
          fullName: user.fullName,
          pic: user.pic
        }
      });
    } catch (error) {
      console.error('Error approving join request:', error);
      res.status(500).json({
        success: false,
        message: 'Ruxsat berishda xatolik',
        error: error.message
      });
    }
  }

  // Meet ni tugatish (creator uchun)
  async endMeet(req, res) {
    try {
      const { meetId } = req.params;
      const creatorId = req.user.id;

      // Meet ni topish va creator ekanligini tekshirish
      const meet = await Meet.findOne({ meetId, creator: creatorId, isActive: true });

      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meet topilmadi yoki siz creator emassiz'
        });
      }

      // Meet ni tugatish
      meet.isActive = false;
      meet.endedAt = new Date();
      await meet.save();

      res.status(200).json({
        success: true,
        message: 'Meet muvaffaqiyatli tugatildi'
      });
    } catch (error) {
      console.error('Error ending meet:', error);
      res.status(500).json({
        success: false,
        message: 'Meet ni tugatishda xatolik',
        error: error.message
      });
    }
  }

  // Meet ma'lumotlarini olish
  async getMeetInfo(req, res) {
    try {
      const { meetId } = req.params;

      const meet = await Meet.findOne({ meetId, isActive: true })
        .populate('creator', 'fullName pic')
        .populate('participants', 'fullName pic');

      if (!meet) {
        return res.status(404).json({
          success: false,
          message: 'Meet topilmadi yoki faol emas'
        });
      }

      res.status(200).json({
        success: true,
        meet
      });
    } catch (error) {
      console.error('Error getting meet info:', error);
      res.status(500).json({
        success: false,
        message: 'Meet ma\'lumotlarini olishda xatolik',
        error: error.message
      });
    }
  }

  // Foydalanuvchining active meetlari
  async getUserMeets(req, res) {
    try {
      const userId = req.user.id;

      const meets = await Meet.find({
        $or: [
          { creator: userId, isActive: true },
          { participants: userId, isActive: true }
        ]
      })
      .populate('creator', 'fullName pic')
      .populate('participants', 'fullName pic')
      .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        meets
      });
    } catch (error) {
      console.error('Error getting user meets:', error);
      res.status(500).json({
        success: false,
        message: 'Meetlarni olishda xatolik',
        error: error.message
      });
    }
  }
}

module.exports = new MeetController();
