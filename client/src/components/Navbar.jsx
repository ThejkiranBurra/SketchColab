import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = ({ user, theme, onToggleTheme }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const navLinks = [
        { path: '/dashboard', label: 'Dashboard', icon: '⬜' },
        { path: '/analytics', label: 'Analytics', icon: '📊' },
        { path: '/profile', label: 'Profile', icon: '👤' },
    ];

    return (
        <nav className={`
            sticky top-0 z-50 w-full
            ${theme === 'dark'
                ? 'bg-gray-900/80 border-gray-800'
                : 'bg-white/80 border-gray-200'
            }
            backdrop-blur-xl border-b
            transition-all duration-300
        `}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    {/* LEFT: Brand */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => navigate('/dashboard')}
                    >
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transform -rotate-6 group-hover:rotate-0 transition-transform duration-300">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        <span className={`text-lg font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'} group-hover:text-blue-500 transition-colors`}>
                            SketchColab
                        </span>
                    </div>

                    {/* CENTER: Navigation Links */}
                    <div className="hidden sm:flex items-center gap-1">
                        {navLinks.map(({ path, label }) => (
                            <button
                                key={path}
                                onClick={() => navigate(path)}
                                className={`
                                    relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                                    ${isActive(path)
                                        ? theme === 'dark'
                                            ? 'text-blue-400 bg-blue-500/10'
                                            : 'text-blue-600 bg-blue-50'
                                        : theme === 'dark'
                                            ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                    }
                                `}
                            >
                                {label}
                                {isActive(path) && (
                                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* RIGHT: User Controls */}
                    <div className="flex items-center gap-3">
                        {/* Theme Toggle */}
                        <button
                            onClick={onToggleTheme}
                            className={`
                                w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
                                ${theme === 'dark'
                                    ? 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                }
                            `}
                            title="Toggle Theme"
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>

                        {/* User Avatar */}
                        <button
                            onClick={() => navigate('/profile')}
                            className="group flex items-center gap-2.5"
                        >
                            <div className={`
                                w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm uppercase
                                bg-gradient-to-br from-blue-500 to-indigo-600 text-white
                                shadow-lg shadow-blue-500/20
                                group-hover:shadow-blue-500/40 group-hover:scale-105
                                transition-all duration-200
                            `}>
                                {user?.displayName ? user.displayName[0] : user?.email?.[0] || '?'}
                            </div>
                            <span className={`hidden md:block text-sm font-semibold ${theme === 'dark' ? 'text-gray-300 group-hover:text-white' : 'text-gray-600 group-hover:text-gray-900'} transition-colors`}>
                                {user?.displayName || user?.email?.split('@')[0] || 'User'}
                            </span>
                        </button>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            className={`
                                px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200
                                ${theme === 'dark'
                                    ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                                    : 'text-red-500 hover:bg-red-50 hover:text-red-600'
                                }
                            `}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
