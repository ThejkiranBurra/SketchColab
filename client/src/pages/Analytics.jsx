import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

const Analytics = () => {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({
        hostedCount: 0,
        joinedCount: 0,
        recentSessions: [],
        dailyActivity: []
    });
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState('dark');
    const navigate = useNavigate();

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        setTheme(savedTheme);

        const fetchData = async () => {
            const token = sessionStorage.getItem('token');
            if (!token) return navigate('/login');

            try {
                console.log('Fetching analytics data...');
                // Fetch user info
                const userRes = await axios.get('http://127.0.0.1:5000/api/auth/me', {
                    headers: { 'x-auth-token': token },
                });
                setUser(userRes.data.user);

                // Fetch analytics
                const analyticsRes = await axios.get('http://127.0.0.1:5000/api/room/analytics', {
                    headers: { 'x-auth-token': token },
                });
                setStats(analyticsRes.data);
            } catch (err) {
                console.error('Analytics fetch error:', err);
                if (err.response?.status === 401) navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const isDark = theme === 'dark';

    // Custom Tooltip component
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className={`p-3 rounded-xl border shadow-xl ${isDark ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'
                    }`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-xl font-black text-blue-500">{payload[0].value} <span className="text-[10px] text-gray-500">Sessions</span></p>
                </div>
            );
        }
        return null;
    };

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
                <div className={`absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] ${isDark ? 'bg-blue-600/8' : 'bg-blue-400/10'}`} />
                <div className={`absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[120px] ${isDark ? 'bg-indigo-600/8' : 'bg-indigo-400/10'}`} />
            </div>

            <div className="relative max-w-6xl mx-auto px-6 py-12">
                <div className="mb-12 animate-fade-in-up">
                    <h1 className={`text-4xl font-black mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Session <span className="text-blue-500">Analytics</span>
                    </h1>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Insights into your collaborative productivity</p>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-fade-in-up-delay-1">
                    <div className={`p-8 rounded-3xl border ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Hosted Sessions</p>
                        <h2 className={`text-5xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.hostedCount}</h2>
                        <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Rooms created and led by you</p>
                    </div>

                    <div className={`p-8 rounded-3xl border ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Joined Sessions</p>
                        <h2 className={`text-5xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.joinedCount}</h2>
                        <p className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Rooms you participated in as a guest</p>
                    </div>
                </div>

                {/* Activity Chart Section */}
                <div className={`p-8 rounded-3xl border mb-8 animate-fade-in-up-delay-2 ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                        <div>
                            <h3 className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly Activity</h3>
                            <p className="text-[10px] text-gray-500 mt-1">Number of sessions over the last 7 days</p>
                        </div>
                        <div className="flex items-center gap-3 mt-4 md:mt-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-[10px] font-bold text-gray-500">Activity Level</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.dailyActivity}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke={isDark ? '#1f2937' : '#f3f4f6'}
                                />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: isDark ? '#6b7280' : '#9ca3af', fontSize: 10, fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: isDark ? '#6b7280' : '#9ca3af', fontSize: 10, fontWeight: 600 }}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ fill: isDark ? '#1f2937' : '#f9fafb', opacity: 0.4 }}
                                />
                                <Bar
                                    dataKey="count"
                                    radius={[6, 6, 0, 0]}
                                    barSize={32}
                                >
                                    {stats.dailyActivity.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill="url(#barGradient)"
                                            style={{ filter: 'drop-shadow(0px 4px 8px rgba(59, 130, 246, 0.2))' }}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Sessions List */}
                <div className={`p-8 rounded-3xl border animate-fade-in-up-delay-3 ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <h3 className={`text-xs font-black uppercase tracking-widest mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Session History</h3>
                    <div className="space-y-4">
                        {stats.recentSessions.length > 0 ? (
                            stats.recentSessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => navigate(`/whiteboard/${session.id}`)}
                                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${isDark
                                        ? 'hover:bg-gray-800 border-transparent hover:border-gray-700'
                                        : 'hover:bg-gray-50 border-transparent hover:border-gray-100'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${session.isHost ? 'bg-blue-500' : 'bg-indigo-500'}`} />
                                        <div>
                                            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{session.title || 'Untitled Session'}</p>
                                            <p className={`text-[10px] font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ID: {session.id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-[10px] font-bold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {new Date(session.createdAt).toLocaleDateString()}
                                        </p>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${session.isHost ? 'text-blue-500' : 'text-indigo-500'}`}>
                                            {session.isHost ? 'Host' : 'Participant'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No session data recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
