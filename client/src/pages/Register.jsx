import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';

const Register = () => {
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Registration submitted:', formData.email);
        setError('');
        if (!formData.displayName || !formData.email || !formData.password || !formData.confirmPassword) {
            return setError('All fields are required');
        }
        if (formData.password !== formData.confirmPassword) {
            return setError('Passwords do not match');
        }

        setLoading(true);
        try {
            console.log('Sending registration request...');
            const res = await axios.post('http://127.0.0.1:5000/api/auth/register', {
                displayName: formData.displayName,
                email: formData.email,
                password: formData.password,
            });
            console.log('Registration successful:', res.data);
            sessionStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            console.log('Google login success (from register), sent to backend...');
            const res = await axios.post('http://127.0.0.1:5000/api/auth/google', {
                credential: credentialResponse.credential
            });
            console.log('Backend response:', res.data);
            sessionStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Google register error:', err);
            setError(err.response?.data?.message || 'Google registration failed');
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
                        Join the <br /> Future! 🚀
                    </h1>
                    <p className="text-blue-100 text-lg max-w-md font-medium leading-relaxed opacity-90">
                        Create your account and start collaborating with teams around the world. The best ideas start on a shared canvas.
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

            {/* RIGHT COLUMN: REGISTER FORM */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 bg-white">
                <div className="w-full max-w-md">
                    <div className="mb-6">
                        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Create Account</h2>
                        <p className="text-gray-500 font-medium">
                            Already have an account?
                            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold ml-1 border-b-2 border-blue-600/30 hover:border-blue-600 transition-colors">
                                Login here
                            </Link>
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-center gap-3">
                            <span className="text-red-500 font-bold">⚠️</span>
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 tracking-wide uppercase">Full Name</label>
                            <input
                                type="text"
                                name="displayName"
                                value={formData.displayName}
                                onChange={handleChange}
                                placeholder="John Doe"
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 tracking-wide uppercase">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@company.com"
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 tracking-wide uppercase">Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 tracking-wide uppercase">Confirm Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 mt-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${loading
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
                                'Register Now'
                            )}
                        </button>

                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                            <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-4 text-gray-400 font-bold tracking-widest">Or join with</span></div>
                        </div>

                        <div className="flex justify-center w-full">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={() => {
                                    console.log('Registration Failed');
                                    setError('Google Registration Failed');
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

export default Register;
