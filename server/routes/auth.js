const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/register', async (req, res) => {
    console.log('Registering user in auth.js:', req.body.email);
    try {
        const { email, password, displayName } = req.body;

        console.log('Searching for user...');
        let user = await User.findOne({ email });
        if (user) {
            console.log('User already exists');
            return res.status(400).json({ message: 'User already exists' });
        }

        console.log('Creating new user...');
        user = new User({ email, password, displayName });
        await user.save();

        console.log('User saved, signing token...');
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token, user: { id: user._id.toString(), email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error('Registration Catch Block Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message, stack: err.stack });
    }
});

// Login
router.post('/login', async (req, res) => {
    console.log('Login attempt for:', req.body.email);
    try {
        const { email, password } = req.body;
        console.log(`Searching for user with email: [${email}]`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User NOT found in DB for: [${email}]`);
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        console.log(`User found: ${user.email}, ID: ${user._id}`);

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Invalid password for:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        console.log('Login successful for:', email);
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, user: { id: user._id.toString(), email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Google OAuth Login/Register
router.post('/google', async (req, res) => {
    const { credential } = req.body;
    try {
        console.log('Verifying Google token...');
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { email, name, sub } = payload;

        console.log(`Google user: ${email} (${name})`);

        let user = await User.findOne({ email });

        if (!user) {
            console.log('Creating new user from Google account...');
            // Create a new user if they don't exist
            // We use the Google 'sub' as a placeholder password or just leave it since we'll use OAuth
            user = new User({
                email,
                displayName: name,
                password: sub, // Dummy password for schema compliance
            });
            await user.save();
        }

        console.log(`Google login successful for: ${email}`);
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            token,
            user: {
                id: user._id.toString(),
                email: user.email,
                displayName: user.displayName
            }
        });
    } catch (err) {
        console.error('Google Auth Error Details:', {
            message: err.message,
            stack: err.stack,
            body: req.body
        });
        res.status(400).json({ message: 'Google authentication failed', error: err.message });
    }
});

const authMiddleware = require('../middleware/auth');

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ user: { id: user._id.toString(), email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { displayName } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (displayName !== undefined) user.displayName = displayName;

        await user.save();
        res.json({ user: { id: user._id.toString(), email: user.email, displayName: user.displayName } });
    } catch (err) {
        console.error('Profile Update Error:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
