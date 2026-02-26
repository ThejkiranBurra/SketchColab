const axios = require('axios');

async function testAuth() {
    try {
        console.log('Checking Base URL...');
        const baseRes = await axios.get('http://127.0.0.1:5000/');
        console.log('Base URL Response:', baseRes.data);

        try {
            console.log('Testing Registration...');
            const registerRes = await axios.post('http://127.0.0.1:5000/api/auth/register', {
                email: 'verify2@example.com',
                password: 'password123'
            });
            console.log('Registration Success:', registerRes.data);
        } catch (err) {
            if (err.response && err.response.data.message === 'User already exists') {
                console.log('Registration: User already exists, proceeding to login...');
            } else {
                throw err;
            }
        }

        console.log('Testing Login...');
        const loginRes = await axios.post('http://127.0.0.1:5000/api/auth/login', {
            email: 'verify2@example.com',
            password: 'password123'
        });
        console.log('Login Success:', loginRes.data);

        const token = loginRes.data.token;
        console.log('Testing Protected Route...');
        const meRes = await axios.get('http://127.0.0.1:5000/api/auth/me', {
            headers: { 'x-auth-token': token }
        });
        console.log('Protected Route Success:', meRes.data);

    } catch (err) {
        console.error('Test Failed:', err.response ? err.response.data : err.message);
    }
}

testAuth();
