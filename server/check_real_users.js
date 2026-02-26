const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = require('./models/User');
        const users = await User.find({});

        console.log(`Total Users: ${users.length}`);
        users.forEach(u => {
            if (!u.email.startsWith('test_')) {
                console.log(`Email: ${u.email}`);
                console.log(`Password Hash: ${u.password}`);
            }
        });

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}
checkUsers();
