const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    },
});

// Increase payload limits for large canvas data
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cors());

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// MongoDB Connection
console.log('Connecting to:', process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sketchcolab');
mongoose
    .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sketchcolab')
    .then(() => {
        console.log('Connected to MongoDB');
        startServer();
    })
    .catch((err) => console.error('MongoDB connection error:', err));

// Socket.io handlers
const setupSocketHandlers = require('./socket/handlers');
setupSocketHandlers(io);

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const authMiddleware = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/room', roomRoutes);

app.get('/', (req, res) => {
    res.send('SketchColab API is running...');
});

const PORT = process.env.PORT || 5000;
function startServer() {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
