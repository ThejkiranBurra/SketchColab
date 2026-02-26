const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: './.env' });

async function diagnose() {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const User = require('./models/User');
        const users = await User.find({}).limit(5);

        if (users.length === 0) {
            console.log('No users found in database.');
        } else {
            console.log(`Found ${users.length} users:`);
            users.forEach(u => {
                console.log(`- Email: ${u.email}`);
                console.log(`  Password Hash: ${u.password ? u.password.substring(0, 10) + '...' : 'MISSING'}`);
                console.log(`  Is Hash Valid: ${u.password && u.password.startsWith('$2')}`);
            });
        }

        // Test bcryptjs directly
        const testPass = 'password123';
        const hash = await bcrypt.hash(testPass, 10);
        const match = await bcrypt.compare(testPass, hash);
        console.log('BcryptJS Test:', match ? 'Working' : 'FAILED');

        await mongoose.connection.close();
    } catch (err) {
        console.error('Diagnosis Error:', err);
    }
}

diagnose();
