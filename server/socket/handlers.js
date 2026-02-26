const Room = require('../models/Room');
const roomUsers = {}; // { roomId: [{ socketId, userId, email, displayName }] }

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('join-room', ({ roomId, userId, email, displayName }) => {
            console.log(`User ${socket.id} joining room: ${roomId}`);
            socket.join(roomId);

            if (!roomUsers[roomId]) roomUsers[roomId] = [];

            // Remove any old entries for this socket
            roomUsers[roomId] = roomUsers[roomId].filter(u => u.socketId !== socket.id);

            // Add current user metadata
            roomUsers[roomId].push({ socketId: socket.id, userId, email, displayName });

            // Sync user list
            io.to(roomId).emit('update-users', roomUsers[roomId]);

            // System message: User joined
            const userName = displayName || (email ? email.split('@')[0] : 'Unknown');
            io.to(roomId).emit('chat-message', {
                message: `${userName} joined the session`,
                user: 'System',
                timestamp: new Date(),
                isSystem: true
            });

            socket.roomId = roomId;
            socket.userData = { email, displayName };
        });

        // Handle Profile Updates (Sync name change mid-session)
        socket.on('update-profile', ({ roomId, displayName }) => {
            if (roomId && roomUsers[roomId]) {
                const user = roomUsers[roomId].find(u => u.socketId === socket.id);
                if (user) {
                    user.displayName = displayName;
                    io.to(roomId).emit('update-users', roomUsers[roomId]);
                }
            }
        });

        // Handle Session Title Updates
        socket.on('update-title', ({ roomId, title }) => {
            io.to(roomId).emit('update-title', title);
        });

        // Whiteboard Events
        socket.on('draw', (data) => {
            const { roomId } = data;
            socket.to(roomId).emit('draw', data);
        });

        socket.on('clear', (roomId) => {
            socket.to(roomId).emit('clear');
        });

        socket.on('undo', ({ roomId, canvasData }) => {
            socket.to(roomId).emit('undo', canvasData);
        });

        // Multi-page: broadcast page switch to all peers
        socket.on('switch-page', ({ roomId, pageIndex }) => {
            socket.to(roomId).emit('switch-page', { pageIndex });
        });

        // Chat Events
        socket.on('chat-message', async (data) => {
            const { roomId, message, user } = data;
            const chatMsg = {
                message,
                user,
                timestamp: new Date(),
                socketId: socket.id
            };

            io.to(roomId).emit('chat-message', chatMsg);

            try {
                await Room.findOneAndUpdate(
                    { roomId },
                    { $push: { messages: chatMsg } }
                );
            } catch (err) {
                console.error('Error saving chat message:', err);
            }
        });

        socket.on('typing', ({ roomId, displayName }) => {
            socket.to(roomId).emit('user-typing', { socketId: socket.id, displayName });
        });

        socket.on('stop-typing', ({ roomId }) => {
            socket.to(roomId).emit('user-stop-typing', { socketId: socket.id });
        });

        // WebRTC Signaling
        socket.on('join-call', ({ roomId, type }) => {
            socket.to(roomId).emit('user-joined-call', { socketId: socket.id, type });
        });

        socket.on('media-status', ({ roomId, isMuted, isVideoOff }) => {
            socket.to(roomId).emit('media-status', { from: socket.id, isMuted, isVideoOff });
        });

        socket.on('leave-call', ({ roomId }) => {
            socket.to(roomId).emit('user-left-call', { socketId: socket.id });
        });

        socket.on('offer', (data) => {
            socket.to(data.to).emit('offer', { offer: data.offer, from: socket.id, type: data.type });
        });

        socket.on('answer', (data) => {
            socket.to(data.to).emit('answer', { answer: data.answer, from: socket.id, type: data.type });
        });

        socket.on('ice-candidate', (data) => {
            socket.to(data.to).emit('ice-candidate', { candidate: data.candidate, from: socket.id, type: data.type });
        });

        socket.on('disconnect', () => {
            const roomId = socket.roomId;
            const userData = socket.userData;
            if (roomId && roomUsers[roomId]) {
                roomUsers[roomId] = roomUsers[roomId].filter(u => u.socketId !== socket.id);
                io.to(roomId).emit('update-users', roomUsers[roomId]);

                // System message: User left
                if (userData) {
                    const userName = userData.displayName || (userData.email ? userData.email.split('@')[0] : 'Unknown');
                    io.to(roomId).emit('chat-message', {
                        message: `${userName} left the session`,
                        user: 'System',
                        timestamp: new Date(),
                        isSystem: true
                    });
                }

                if (roomUsers[roomId].length === 0) delete roomUsers[roomId];
            }
        });
    });
};
