const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    canvasData: {
        type: String, // Legacy single-page fallback
    },
    pages: [{
        pageIndex: { type: Number, required: true },
        canvasData: { type: String, default: '' }
    }],
    title: {
        type: String,
        default: 'Untitled Session',
    },
    messages: [{
        user: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
        socketId: String
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Room', roomSchema);
