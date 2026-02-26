import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [theme, setTheme] = useState('dark');
    const navigate = useNavigate();

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);

        const fetchUser = async () => {
            const token = sessionStorage.getItem('token');
            if (!token) return navigate('/login');
            try {
                const res = await axios.get('http://127.0.0.1:5000/api/auth/me', {
                    headers: { 'x-auth-token': token },
                });
                setUser(res.data.user);
                setDisplayName(res.data.user.displayName || '');
            } catch (err) {
                console.error(err);
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [navigate]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.put('http://127.0.0.1:5000/api/auth/profile',
                { displayName },
                { headers: { 'x-auth-token': token } }
            );
            setUser(res.data.user);
            setMessage('Profile updated successfully! ✨');
        } catch (err) {
            setMessage('Failed to update profile.');
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const isDark = theme === 'dark';

    if (loading) return (
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'} transition-colors duration-300`}>
            <Navbar user={user} theme={theme} onToggleTheme={toggleTheme} />

            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] ${isDark ? 'bg-blue-600/8' : 'bg-blue-400/10'}`} />
                <div className={`absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[120px] ${isDark ? 'bg-indigo-600/8' : 'bg-indigo-400/10'}`} />
            </div>

            <div className="relative max-w-3xl mx-auto px-6 py-12">
                {/* Profile Header */}
                <div className="flex items-center gap-6 mb-10 animate-fade-in-up">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-blue-500/20">
                        {(user?.displayName ? user.displayName[0] : user?.email[0]).toUpperCase()}
                    </div>
                    <div>
                        <h1 className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Profile Settings
                        </h1>
                        <p className={`text-sm font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{user?.email}</p>
                    </div>
                </div>

                {/* Success/Error Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-2xl border text-sm font-semibold text-center animate-fade-in-up ${message.includes('success')
                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        {message}
                    </div>
                )}

                {/* Profile Form Card */}
                <div className={`
                    rounded-2xl p-8 mb-6 animate-fade-in-up-delay-1
                    ${isDark
                        ? 'bg-gray-900/60 border border-gray-800'
                        : 'bg-white border border-gray-200 shadow-sm'
                    }
                    backdrop-blur-sm
                `}>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Personal Information
                    </h3>

                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div>
                            <label className={`block text-sm font-bold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Display Name
                            </label>
                            <input
                                type="text"
                                placeholder="How should others see you?"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className={`w-full p-4 rounded-xl text-sm font-medium
                                    ${isDark
                                        ? 'bg-gray-800/80 border-gray-700 text-white placeholder:text-gray-600'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                                    }
                                    border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                                    outline-none transition-all`}
                            />
                            <p className={`mt-2 text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                This name will be visible to everyone in collaborative rooms.
                            </p>
                        </div>

                        <div>
                            <label className={`block text-sm font-bold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className={`w-full p-4 rounded-xl text-sm font-medium cursor-not-allowed opacity-60
                                    ${isDark
                                        ? 'bg-gray-800/80 border-gray-700 text-gray-400'
                                        : 'bg-gray-100 border-gray-200 text-gray-500'
                                    }
                                    border`}
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="w-full py-4 rounded-xl font-bold text-sm text-white
                                    bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
                                    shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40
                                    transition-all duration-300 active:scale-[0.98]"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>

                {/* Security Section */}
                <div className={`
                    rounded-2xl p-8 animate-fade-in-up-delay-2
                    ${isDark
                        ? 'bg-gray-900/60 border border-gray-800'
                        : 'bg-white border border-gray-200 shadow-sm'
                    }
                    backdrop-blur-sm
                `}>
                    <h3 className={`text-xs font-bold uppercase tracking-widest mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Security & Account
                    </h3>

                    <div className="space-y-3">
                        <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                            <div>
                                <p className={`text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Password</p>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Last changed: Just now</p>
                            </div>
                            <button className="text-blue-500 text-xs font-bold hover:text-blue-400 transition-colors">
                                Change
                            </button>
                        </div>

                        <div className={`flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10`}>
                            <div>
                                <p className="text-sm font-bold text-red-400">Danger Zone</p>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Once deleted, your data is gone forever.</p>
                            </div>
                            <button className="text-red-500 text-xs font-bold hover:text-red-400 transition-colors">
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
