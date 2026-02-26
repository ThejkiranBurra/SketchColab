const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');

// Generate unique Room ID
const generateRoomId = () => {
    return crypto.randomBytes(4).toString('hex'); // 8 character hex string
};

// @route   POST /api/room/create
// @desc    Create a new room
// @access  Private
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const roomId = generateRoomId();
        const newRoom = new Room({
            roomId,
            host: req.user.id,
            participants: [req.user.id]
        });

        await newRoom.save();
        res.status(201).json({ roomId, host: req.user.id });
    } catch (err) {
        console.error('Room Creation Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/room/join
// @desc    Validate and join a room
// @access  Private
router.post('/join', authMiddleware, async (req, res) => {
    try {
        const { roomId } = req.body;
        const room = await Room.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Add user to participants if not already there
        if (!room.participants.includes(req.user.id)) {
            room.participants.push(req.user.id);
            await room.save();
        }

        // Return pages data (with backward compat for legacy single-page canvasData)
        const pages = (room.pages && room.pages.length > 0)
            ? room.pages
            : (room.canvasData ? [{ pageIndex: 0, canvasData: room.canvasData }] : [{ pageIndex: 0, canvasData: '' }]);

        res.json({ roomId, host: room.host, pages, title: room.title, messages: room.messages });
    } catch (err) {
        console.error('Room Join Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/room/save
// @desc    Save canvas state
// @access  Private
router.post('/save', authMiddleware, async (req, res) => {
    try {
        const { roomId, canvasData, pages } = req.body;
        const room = await Room.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        if (pages && pages.length > 0) {
            // Multi-page save
            room.pages = pages;
            room.canvasData = pages[0]?.canvasData || ''; // Keep legacy field in sync with page 0
            console.log(`[DB-Save] Room ${roomId}: Saving ${pages.length} pages.`);
        } else if (canvasData) {
            // Legacy single-page save
            room.canvasData = canvasData;
            console.log(`[DB-Save] Room ${roomId}: Legacy single-page save.`);
        }

        await room.save();
        console.log(`[DB-Save] Room ${roomId} saved successfully.`);
        res.json({ message: 'Canvas saved' });
    } catch (err) {
        console.error('Canvas Save Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/room/update-title
// @desc    Update room title
// @access  Private
router.put('/update-title', authMiddleware, async (req, res) => {
    try {
        const { roomId, title } = req.body;
        const room = await Room.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Only host can change title
        console.log(`Title update attempt for room ${roomId} by user ${req.user.id}`);
        console.log(`Room host is ${room.host}`);

        if (room.host.toString() !== req.user.id) {
            console.log('Permission denied: User is not host');
            return res.status(403).json({ message: 'Only the host can change the title' });
        }

        room.title = title;
        await room.save();
        console.log(`Title successfully updated to: ${title}`);
        res.json({ message: 'Title updated', title: room.title });
    } catch (err) {
        console.error('Title Update Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/room/analytics
// @desc    Get session analytics for user
// @access  Private
router.get('/analytics', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch all rooms where user is host or participant
        const rooms = await Room.find({
            participants: userId
        }).sort({ createdAt: -1 });

        const hostedRooms = rooms.filter(room => room.host && room.host.toString() === userId);
        const joinedRooms = rooms.filter(room => room.host && room.host.toString() !== userId);

        // Calculate daily activity for last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);

            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const count = rooms.filter(room => {
                const roomDate = new Date(room.createdAt);
                roomDate.setHours(0, 0, 0, 0);
                return roomDate.getTime() === d.getTime();
            }).length;

            last7Days.push({ name: dayName, count });
        }

        res.json({
            hostedCount: hostedRooms.length,
            joinedCount: joinedRooms.length,
            dailyActivity: last7Days,
            recentSessions: rooms.slice(0, 10).map(room => ({
                id: room.roomId,
                title: room.title || 'Untitled Session',
                createdAt: room.createdAt,
                isHost: room.host && room.host.toString() === userId
            }))
        });
    } catch (err) {
        console.error('Analytics Fetch Error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
