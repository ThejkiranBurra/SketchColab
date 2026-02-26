import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import API_URL from '../config';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [joinRoomId, setJoinRoomId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [recentRooms, setRecentRooms] = useState([]);
    const [theme, setTheme] = useState('dark');
    const navigate = useNavigate();

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);
        const fetchUser = async () => {
            const token = sessionStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const res = await axios.get(`${API_URL}/api/auth/me`, {
                    headers: { 'x-auth-token': token },
                });
                setUser(res.data.user);
            } catch (err) {
                console.error('Fetch user error:', err);
                sessionStorage.removeItem('token');
                navigate('/login');
            }
        };
        fetchUser();
    }, [navigate]);

    useEffect(() => {
        if (user?.id) {
            const key = `recent_rooms_${user.id}`;
            const rooms = JSON.parse(localStorage.getItem(key) || '[]');
            setRecentRooms(rooms);
        }
    }, [user]);

    const handleCreateRoom = async () => {
        setLoading(true);
        setError('');
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/room/create`, {}, {
                headers: { 'x-auth-token': token }
            });
            navigate(`/whiteboard/${res.data.roomId}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async (e) => {
        e.preventDefault();
        if (!joinRoomId) return setError('Please enter a Room ID');

        setLoading(true);
        setError('');
        try {
            const token = sessionStorage.getItem('token');
            const res = await axios.post(`${API_URL}/api/room/join`, { roomId: joinRoomId }, {
                headers: { 'x-auth-token': token }
            });
            navigate(`/whiteboard/${res.data.roomId}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to join room');
        } finally {
            setLoading(false);
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const getRecentRooms = () => {
        if (!user?.id) return [];
        // Cleanup legacy keys
        localStorage.removeItem('recent_rooms');
        localStorage.removeItem('recent_rooms_undefined');
        const key = `recent_rooms_${user.id}`;
        return JSON.parse(localStorage.getItem(key) || '[]');
    };

    const handleDeleteRecentRoom = (e, targetRoomId) => {
        e.stopPropagation(); // Prevent navigating to the room
        if (!window.confirm('Remove this session from your history?')) return;

        const key = `recent_rooms_${user.id}`;
        const updatedRooms = recentRooms.filter(room => {
            const id = typeof room === 'string' ? room : room.id;
            return id !== targetRoomId;
        });

        localStorage.setItem(key, JSON.stringify(updatedRooms));
        setRecentRooms(updatedRooms);
    };

    const isDark = theme === 'dark';

    return (
        <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'} transition-colors duration-300`}>
            <Navbar user={user} theme={theme} onToggleTheme={toggleTheme} />

            {/* Background decoration */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] ${isDark ? 'bg-blue-600/8' : 'bg-blue-400/10'}`} />
                <div className={`absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] ${isDark ? 'bg-indigo-600/8' : 'bg-indigo-400/10'}`} />
            </div>

            <div className="relative max-w-6xl mx-auto px-6 py-12">
                {/* Hero Section */}
                <div className="mb-12 animate-fade-in-up">
                    <h1 className={`text-4xl md:text-5xl font-black mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Welcome back,{' '}
                        <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                            {user?.displayName || user?.email?.split('@')[0] || 'User'}
                        </span>
                        ! 👋
                    </h1>
                    <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'} max-w-xl`}>
                        Create or join a whiteboard session to start collaborating with your team in real-time.
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-fade-in-up">
                        <span className="text-red-400 text-lg">⚠️</span>
                        <p className="text-red-400 text-sm font-semibold">{error}</p>
                        <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400 transition">✕</button>
                    </div>
                )}

                {/* Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 animate-fade-in-up-delay-1">
                    {/* Create Room Card */}
                    <div className={`
                        group relative overflow-hidden rounded-2xl p-8
                        ${isDark
                            ? 'bg-gray-900/60 border border-gray-800 hover:border-blue-500/30'
                            : 'bg-white border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-lg'
                        }
                        backdrop-blur-sm transition-all duration-300
                    `}>
                        {/* Card glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                                    <span className="text-2xl">🚀</span>
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>New Session</h2>
                                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Start a fresh whiteboard</p>
                                </div>
                            </div>

                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-8 leading-relaxed`}>
                                Create a new whiteboard room and invite others by sharing your unique Room ID.
                            </p>

                            <button
                                onClick={handleCreateRoom}
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl font-bold text-sm text-white
                                    bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
                                    shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40
                                    transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                                    active:scale-[0.98]"
                            >
                                {loading ? 'Processing...' : 'Create Room'}
                            </button>
                        </div>
                    </div>

                    {/* Join Room Card */}
                    <div className={`
                        group relative overflow-hidden rounded-2xl p-8
                        ${isDark
                            ? 'bg-gray-900/60 border border-gray-800 hover:border-indigo-500/30'
                            : 'bg-white border border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow-lg'
                        }
                        backdrop-blur-sm transition-all duration-300
                    `}>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                                    <span className="text-2xl">🤝</span>
                                </div>
                                <div>
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Join Session</h2>
                                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Collaborate with others</p>
                                </div>
                            </div>

                            <form onSubmit={handleJoinRoom} className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Enter Room ID"
                                    value={joinRoomId}
                                    onChange={(e) => setJoinRoomId(e.target.value)}
                                    className={`w-full p-3.5 rounded-xl text-center font-mono tracking-widest uppercase text-sm
                                        ${isDark
                                            ? 'bg-gray-800/80 border-gray-700 text-white placeholder:text-gray-600'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
                                        }
                                        border focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all`}
                                />
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 rounded-xl font-bold text-sm text-white
                                        bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700
                                        shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40
                                        transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                                        active:scale-[0.98]"
                                >
                                    {loading ? 'Joining...' : 'Join Room'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Recent Sessions + Profile Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up-delay-2">
                    {/* Recent Sessions */}
                    <div className={`
                        lg:col-span-2 rounded-2xl p-6
                        ${isDark
                            ? 'bg-gray-900/60 border border-gray-800'
                            : 'bg-white border border-gray-200 shadow-sm'
                        }
                        backdrop-blur-sm
                    `}>
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Recent Sessions
                        </h3>
                        <div className="space-y-2">
                            {user?.id ? (
                                (() => {
                                    const rooms = recentRooms;
                                    return rooms.length > 0 ? (
                                        rooms.map((room) => {
                                            const id = typeof room === 'string' ? room : room.id;
                                            const displayTitle = typeof room === 'string' ? id : (room.title || id);
                                            return (
                                                <div
                                                    key={id}
                                                    onClick={() => navigate(`/whiteboard/${id}`)}
                                                    className={`
                                                        group flex items-center justify-between p-3.5 rounded-xl cursor-pointer
                                                        transition-all duration-200
                                                        ${isDark
                                                            ? 'hover:bg-gray-800/80 border border-transparent hover:border-gray-700'
                                                            : 'hover:bg-gray-50 border border-transparent hover:border-gray-200'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-transform`} />
                                                        <div>
                                                            <p className={`text-sm font-semibold ${isDark ? 'text-gray-200 group-hover:text-white' : 'text-gray-800 group-hover:text-gray-900'} transition-colors`}>
                                                                {displayTitle}
                                                            </p>
                                                            <p className={`text-[11px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                ID: {id}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => handleDeleteRecentRoom(e, id)}
                                                            className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all
                                                                ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500'}
                                                            `}
                                                            title="Remove from history"
                                                        >
                                                            🗑️
                                                        </button>
                                                        <span className={`text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>
                                                            Open →
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className={`text-center py-8 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                            <span className="text-3xl block mb-2">📋</span>
                                            <p className="text-sm font-medium">No recent sessions yet</p>
                                            <p className="text-xs mt-1">Create or join a room to get started</p>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Profile Overview */}
                    <div className={`
                        rounded-2xl p-6
                        ${isDark
                            ? 'bg-gray-900/60 border border-gray-800'
                            : 'bg-white border border-gray-200 shadow-sm'
                        }
                        backdrop-blur-sm
                    `}>
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Your Profile
                        </h3>
                        <div className="flex flex-col items-center text-center">
                            <div
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-blue-500/20 cursor-pointer hover:scale-105 transition-transform mb-4"
                                onClick={() => navigate('/profile')}
                            >
                                {user?.displayName ? user.displayName[0].toUpperCase() : user?.email?.[0]?.toUpperCase() || '?'}
                            </div>
                            <Link
                                to="/profile"
                                className={`text-sm font-bold ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
                            >
                                {user?.displayName || 'Set Display Name'}
                            </Link>
                            <p className={`text-[11px] font-mono mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                {user?.email}
                            </p>
                            <button
                                onClick={() => navigate('/profile')}
                                className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all
                                    ${isDark
                                        ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                    }
                                `}
                            >
                                Edit Profile
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
