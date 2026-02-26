const axios = require('axios');
const testGoogleLogin = async () => {
    try {
        const res = await axios.post('http://127.0.0.1:5000/api/auth/google', {
            credential: 'dummy_token'
        });
        console.log('Success (unexpected):', res.data);
    } catch (err) {
        console.log('Error (expected):', err.response?.data || err.message);
    }
};
testGoogleLogin();
