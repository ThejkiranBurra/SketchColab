const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

async function checkUserHash() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = require('./models/User');
        const user = await User.findOne({ email: { $not: /^test_/ } });

        if (user) {
            console.log('Email:', user.email);
            console.log('Hash:', user.password);
            console.log('Length:', user.password ? user.password.length : 'N/A');
        } else {
            console.log('No non-test user found.');
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}
checkUserHash();
