const axios = require('axios');

async function testAuth() {
    const email = `test_${Date.now()}@example.com`;
    const password = 'password123';
    const displayName = 'Test User';

    try {
        console.log('--- Registering ---');
        const regRes = await axios.post('http://127.0.0.1:5000/api/auth/register', {
            email,
            password,
            displayName
        });
        console.log('Register Success:', regRes.data.user.email);

        console.log('--- Logging In ---');
        const loginRes = await axios.post('http://127.0.0.1:5000/api/auth/login', {
            email,
            password
        });
        console.log('Login Success! Token:', loginRes.data.token.substring(0, 10) + '...');
    } catch (err) {
        console.error('Auth Test FAILED');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}

testAuth();
