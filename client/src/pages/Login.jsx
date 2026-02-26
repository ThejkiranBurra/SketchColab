import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import API_URL from '../config';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Login form submitted with:', formData.email);
        setError('');
        setLoading(true);
        try {
            console.log('Sending POST request to backend...');
            const res = await axios.post(`${API_URL}/api/auth/login`, {
                email: formData.email,
                password: formData.password,
            });
            console.log('Login response received:', res.data);
            sessionStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Login error detail:', err);
            const msg = err.response?.data?.message || 'Login failed - check your connection';
            setError(msg);
            console.log('Error message shown to user:', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            console.log('Google login success, sent to backend...');
            const res = await axios.post(`${API_URL}/api/auth/google`, {
                credential: credentialResponse.credential
            });
            console.log('Backend response:', res.data);
            sessionStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Google login error:', err);
            setError(err.response?.data?.message || 'Google login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 overflow-hidden">
            {/* LEFT COLUMN: BRANDING & GRADIENT */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-12 flex-col justify-between relative overflow-hidden">
                {/* Abstract background shapes */}
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-16">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg transform -rotate-6">
                            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        <span className="text-white text-2xl font-bold tracking-tight">SketchColab</span>
                    </div>

                    <h1 className="text-6xl font-black text-white leading-tight mb-6">
                        Hello <br /> Collab! 👋
                    </h1>
                    <p className="text-blue-100 text-lg max-w-md font-medium leading-relaxed opacity-90">
                        Join your team on the ultimate digital whiteboard. Visualize ideas, collaborate in real-time, and build something amazing together.
                    </p>
                </div>

                <div className="relative z-10">
                    <div className="flex gap-4 items-center text-blue-100 text-sm font-semibold opacity-60">
                        <span>EST. 2026</span>
                        <span className="w-1 h-1 bg-current rounded-full"></span>
                        <span>v2.0 PROFESSIONAL</span>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: LOGIN FORM */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 bg-white">
                <div className="w-full max-w-md">
                    <div className="mb-10">
                        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome Back!</h2>
                        <p className="text-gray-500 font-medium">
                            Don't have an account?
                            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold ml-1 border-b-2 border-blue-600/30 hover:border-blue-600 transition-colors">
                                Create a new account now
                            </Link>
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-center gap-3">
                            <span className="text-red-500 font-bold">⚠️</span>
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700 tracking-wide">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@company.com"
                                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-bold text-gray-700 tracking-wide">Password</label>
                                <a href="#" className="text-xs font-bold text-blue-600 hover:text-blue-700">Forgot password?</a>
                            </div>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading
                                ? 'bg-blue-400 cursor-not-allowed text-white/50'
                                : 'bg-gray-900 hover:bg-black text-white hover:shadow-xl hover:translate-y-[-2px]'
                                }`}
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Login Now'
                            )}
                        </button>

                        <div className="relative py-4">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-bold tracking-widest">Or login with</span></div>
                        </div>

                        <div className="flex justify-center w-full">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => {
                                    console.log('Login Failed');
                                    setError('Google Login Failed');
                                }}
                                useOneTap
                                theme="outline"
                                shape="pill"
                                width="100%"
                            />
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
