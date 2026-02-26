import React, { useRef, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Conferencing from '../components/Conferencing';

const Whiteboard = () => {
    const { roomId } = useParams();
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(4);
    const [participants, setParticipants] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [user, setUser] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [hostId, setHostId] = useState(null);
    const [history, setHistory] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [theme, setTheme] = useState('light');
    const [selectedTool, setSelectedTool] = useState('pencil'); // 'pencil', 'eraser', 'rectangle', 'circle', 'line', 'arrow', 'fill', 'text', 'pan'
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isRecording, setIsRecording] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isSharingActive, setIsSharingActive] = useState(false);
    const [title, setTitle] = useState('Untitled Session');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const [fontSize, setFontSize] = useState(20);
    const [fontFamily, setFontFamily] = useState('Inter, sans-serif');
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [canvasSnapshot, setCanvasSnapshot] = useState(null);
    const [bgPattern, setBgPattern] = useState('grid'); // 'plain', 'grid', 'dots'
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [typingUsers, setTypingUsers] = useState({}); // { socketId: displayName }

    // Multi-page state
    const [pages, setPages] = useState([{ pageIndex: 0, canvasData: '' }]);
    const [currentPage, setCurrentPage] = useState(0);
    const pagesRef = useRef([{ pageIndex: 0, canvasData: '' }]);
    const currentPageRef = useRef(0);

    // Keep currentPageRef always in sync
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const chatEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const navigate = useNavigate();

    // Palette Colors
    const palette = [
        '#000000', '#4b5563', '#ef4444', '#f97316', '#eab308',
        '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'
    ];

    // 1. Authentication & Room Data fetching
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchUserAndRoom = async () => {
            try {
                const userRes = await axios.get('http://127.0.0.1:5000/api/auth/me', {
                    headers: { 'x-auth-token': token },
                });
                const userData = userRes.data.user;
                setUser(userData);

                const roomRes = await axios.post('http://127.0.0.1:5000/api/room/join', { roomId }, {
                    headers: { 'x-auth-token': token }
                });

                const hostIdFromServer = roomRes.data.host.toString();
                setHostId(hostIdFromServer);
                if (hostIdFromServer === userData.id.toString()) setIsHost(true);
                setTitle(roomRes.data.title || 'Untitled Session');

                // Load pages (multi-page support)
                if (roomRes.data.pages && roomRes.data.pages.length > 0) {
                    const loadedPages = roomRes.data.pages;
                    setPages(loadedPages);
                    pagesRef.current = loadedPages;
                    setCurrentPage(0);
                    if (loadedPages[0]?.canvasData) {
                        applyCanvasState(loadedPages[0].canvasData);
                        setHistory([loadedPages[0].canvasData]);
                    }
                }
                if (roomRes.data.messages) {
                    setChatMessages(prev => {
                        // Merge logic: avoid duplicates if possible, or just append live messages if API took a while
                        const combined = [...roomRes.data.messages];
                        // If we already received live messages (like system join messages) during the API fetch, don't lose them
                        prev.forEach(pMsg => {
                            if (!combined.some(cMsg => cMsg.timestamp === pMsg.timestamp && cMsg.message === pMsg.message)) {
                                combined.push(pMsg);
                            }
                        });
                        return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    });
                }

                // Save to Recent Sessions
                const recentKey = `recent_rooms_${userData.id}`;
                const recentRooms = JSON.parse(localStorage.getItem(recentKey) || '[]');
                const roomInfo = { id: roomId, title: roomRes.data.title || 'Untitled Session', lastVisited: new Date().toISOString() };

                // Filter out existing occurrence of this room and add to front
                const updatedRecent = [roomInfo, ...recentRooms.filter(r => (typeof r === 'string' ? r : r.id) !== roomId)].slice(0, 10);
                localStorage.setItem(recentKey, JSON.stringify(updatedRecent));

            } catch (err) {
                console.error('Fetch error:', err);
                navigate('/dashboard');
            }
        };

        fetchUserAndRoom();
    }, [roomId, navigate]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Tool switching (1-9)
            if (e.key === 'q') setSelectedTool('pencil');
            if (e.key === 'w') setSelectedTool('eraser');
            if (e.key === 'e') setSelectedTool('rectangle');
            if (e.key === 'r') setSelectedTool('circle');
            if (e.key === 't') setSelectedTool('line');
            if (e.key === 'a') setSelectedTool('arrow');
            if (e.key === 's') setSelectedTool('fill');
            if (e.key === 'd') setSelectedTool('text');
            if (e.key === 'f') setSelectedTool('pan');

            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, redoStack]);

    // Socket Management
    useEffect(() => {
        if (!user) return;

        if (!socketRef.current) {
            console.log("Initializing socket connection for user:", user.displayName);
            socketRef.current = io('http://127.0.0.1:5000');
        }

        const socket = socketRef.current;

        console.log("Joining room:", roomId);

        socket.emit('join-room', {
            roomId,
            userId: user.id,
            email: user.email,
            displayName: user.displayName
        });

        socket.on('update-users', (users) => setParticipants(users));

        socket.on('draw', (data) => {
            const { type, x, y, lastX, lastY, color, size, startX, startY, text, params } = data;
            if (type === 'pencil' || type === 'eraser') {
                drawOnCanvas(lastX, lastY, x, y, color, size);
            } else if (['rectangle', 'circle', 'line', 'arrow'].includes(type)) {
                drawShape(type, startX, startY, x, y, color, size);
            } else if (type === 'fill') {
                floodFill(x, y, color);
            } else if (type === 'text') {
                drawText(text, x, y, color, params.fontSize, params.fontFamily);
            }
        });

        socket.on('clear', () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHistory([]);
            setRedoStack([]);
        });

        socket.on('chat-message', (data) => {
            setChatMessages((prev) => [...prev, data]);
        });

        socket.on('update-title', (newTitle) => {
            setTitle(newTitle);
        });

        socket.on('user-typing', ({ socketId, displayName }) => {
            setTypingUsers(prev => ({ ...prev, [socketId]: displayName }));
        });

        socket.on('user-stop-typing', ({ socketId }) => {
            setTypingUsers(prev => {
                const newState = { ...prev };
                delete newState[socketId];
                return newState;
            });
        });

        socket.on('undo', (canvasData) => {
            applyCanvasState(canvasData);
        });

        // Multi-page: listen for remote page switches
        socket.on('switch-page', ({ pageIndex }) => {
            // Ensure the page exists locally (remote user may have added a new page)
            setPages(prev => {
                if (pageIndex >= prev.length) {
                    const newPages = [...prev];
                    while (newPages.length <= pageIndex) {
                        newPages.push({ pageIndex: newPages.length, canvasData: '' });
                    }
                    pagesRef.current = newPages;
                    return newPages;
                }
                return prev;
            });
            switchPage(pageIndex, false);
        });

        return () => {
            socket.off('update-users');
            socket.off('draw');
            socket.off('clear');
            socket.off('chat-message');
            socket.off('undo');
            socket.off('switch-page');
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user, roomId]);

    // Auto-scroll Chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const saveToDB = async (dataURL) => {
        setIsSaving(true);
        try {
            const token = sessionStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            // Save current canvas into the active page slot before sending
            const activePage = currentPageRef.current;
            const updatedPages = pagesRef.current.map((p, i) =>
                i === activePage ? { ...p, canvasData: dataURL } : p
            );
            pagesRef.current = updatedPages;
            setPages(updatedPages);

            const response = await axios.post('http://127.0.0.1:5000/api/room/save', {
                roomId,
                pages: updatedPages
            }, {
                headers: { 'x-auth-token': token }
            });
            console.log('[Save] Success:', response.data.message);
            return { success: true };
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            const status = err.response?.status;
            console.error(`[Save] Failed (${status}):`, msg);
            return { success: false, error: `${msg} (${status || 'Network Error'})` };
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    const saveHistory = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataURL = canvas.toDataURL();
        setHistory((prev) => [...prev, dataURL]);
        setRedoStack([]);
        saveToDB(dataURL);
    };

    // Multi-page: switch to a different page
    const switchPage = (targetIndex, broadcast = true) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Save current page canvas state using ref (avoids stale closure)
        const activePage = currentPageRef.current;
        const currentData = canvas.toDataURL();
        const updatedPages = pagesRef.current.map((p, i) =>
            i === activePage ? { ...p, canvasData: currentData } : p
        );
        pagesRef.current = updatedPages;
        setPages(updatedPages);

        // Switch to target page
        currentPageRef.current = targetIndex;
        setCurrentPage(targetIndex);
        setHistory([]);
        setRedoStack([]);

        // Load target page
        const targetPage = updatedPages[targetIndex];
        if (targetPage && targetPage.canvasData) {
            applyCanvasState(targetPage.canvasData);
        } else {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Broadcast to peers
        if (broadcast && socketRef.current) {
            socketRef.current.emit('switch-page', { roomId, pageIndex: targetIndex });
        }
    };

    const addPage = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Save current page first using ref (avoids stale closure)
        const activePage = currentPageRef.current;
        const currentData = canvas.toDataURL();
        const newPageIndex = pagesRef.current.length;
        const updatedPages = [
            ...pagesRef.current.map((p, i) =>
                i === activePage ? { ...p, canvasData: currentData } : p
            ),
            { pageIndex: newPageIndex, canvasData: '' }
        ];
        pagesRef.current = updatedPages;
        setPages(updatedPages);

        // Switch to the new page
        currentPageRef.current = newPageIndex;
        setCurrentPage(newPageIndex);
        setHistory([]);
        setRedoStack([]);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Broadcast
        if (socketRef.current) {
            socketRef.current.emit('switch-page', { roomId, pageIndex: newPageIndex });
        }

        // Save to DB
        saveToDB('');
    };

    const deletePage = (targetIndex) => {
        if (pagesRef.current.length <= 1) return; // Can't delete the last page
        if (!window.confirm(`Delete Page ${targetIndex + 1}?`)) return;

        const updatedPages = pagesRef.current
            .filter((_, i) => i !== targetIndex)
            .map((p, i) => ({ ...p, pageIndex: i }));
        pagesRef.current = updatedPages;
        setPages(updatedPages);

        // Determine which page to show after deletion
        let newPageIdx = currentPageRef.current;
        if (targetIndex === currentPageRef.current) {
            // Deleted the active page — go to previous or 0
            newPageIdx = Math.max(0, targetIndex - 1);
        } else if (targetIndex < currentPageRef.current) {
            // Deleted a page before the active one — shift index down
            newPageIdx = currentPageRef.current - 1;
        }

        currentPageRef.current = newPageIdx;
        setCurrentPage(newPageIdx);
        setHistory([]);
        setRedoStack([]);

        const canvas = canvasRef.current;
        if (canvas) {
            const targetPage = updatedPages[newPageIdx];
            if (targetPage && targetPage.canvasData) {
                applyCanvasState(targetPage.canvasData);
            } else {
                canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        // Save updated pages to DB
        saveToDB(updatedPages[newPageIdx]?.canvasData || '');
    };

    const applyCanvasState = (dataURL) => {
        if (!dataURL) return;
        const canvas = canvasRef.current;
        if (!canvas) {
            // If canvas isn't ready, retry in a bit
            console.log('[Canvas] Canvas not ready, retrying applyCanvasState...');
            setTimeout(() => applyCanvasState(dataURL), 100);
            return;
        }
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = dataURL;
        img.onload = () => {
            console.log('[Canvas] Applying loaded state to canvas');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
        img.onerror = (err) => console.error('[Canvas] Failed to load snapshot:', err);
    };

    const getCanvasCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom
        };
    };

    const drawOnCanvas = (lastX, lastY, x, y, strokeColor, strokeSize) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const drawShape = (type, sX, sY, eX, eY, strokeColor, strokeSize) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeSize;
        ctx.beginPath();

        if (type === 'rectangle') {
            ctx.strokeRect(sX, sY, eX - sX, eY - sY);
        } else if (type === 'circle') {
            const radius = Math.sqrt(Math.pow(eX - sX, 2) + Math.pow(eY - sY, 2));
            ctx.arc(sX, sY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (type === 'line') {
            ctx.moveTo(sX, sY);
            ctx.lineTo(eX, eY);
            ctx.stroke();
        } else if (type === 'arrow') {
            const headlen = 12;
            const angle = Math.atan2(eY - sY, eX - sX);
            ctx.moveTo(sX, sY);
            ctx.lineTo(eX, eY);
            ctx.lineTo(eX - headlen * Math.cos(angle - Math.PI / 6), eY - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(eX, eY);
            ctx.lineTo(eX - headlen * Math.cos(angle + Math.PI / 6), eY - headlen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        }
    };

    const drawText = (val, x, y, fillStyle, fSize, fFamily) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = fillStyle;
        ctx.font = `${fSize}px ${fFamily}`;
        ctx.fillText(val, x, y);
    };

    const floodFill = (startX, startY, fillColor) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const getPixelPos = (x, y) => (y * canvas.width + x) * 4;
        const getPixelColor = (x, y) => {
            const pos = getPixelPos(x, y);
            return [data[pos], data[pos + 1], data[pos + 2], data[pos + 3]];
        };

        const targetColor = getPixelColor(Math.round(startX), Math.round(startY));
        const fillRGB = hexToRgb(fillColor);

        if (colorsMatch(targetColor, [fillRGB.r, fillRGB.g, fillRGB.b, 255])) return;

        const pixelsToCheck = [Math.round(startX), Math.round(startY)];
        while (pixelsToCheck.length > 0) {
            const y = pixelsToCheck.pop();
            const x = pixelsToCheck.pop();

            const pos = getPixelPos(x, y);
            data[pos] = fillRGB.r;
            data[pos + 1] = fillRGB.g;
            data[pos + 2] = fillRGB.b;
            data[pos + 3] = 255;

            [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nx, ny]) => {
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height && colorsMatch(getPixelColor(nx, ny), targetColor)) {
                    pixelsToCheck.push(nx, ny);
                }
            });
        }
        ctx.putImageData(imageData, 0, 0);
    };

    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    };

    const colorsMatch = (c1, c2) => {
        return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && Math.abs(c1[3] - c2[3]) < 50;
    };

    const startDrawing = (e) => {
        console.log('[Draw] Mouse down - starting drawing session');
        const { x, y } = getCanvasCoordinates(e);

        if (selectedTool === 'pan') {
            setIsDrawing(true);
            canvasRef.current.lastMouseX = e.clientX;
            canvasRef.current.lastMouseY = e.clientY;
            return;
        }

        setIsDrawing(true);
        setStartPos({ x, y });

        const canvas = canvasRef.current;
        canvas.lastX = x;
        canvas.lastY = y;

        if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
            setCanvasSnapshot(canvas.toDataURL());
        }

        if (selectedTool === 'fill') {
            floodFill(x, y, color);
            socketRef.current.emit('draw', { roomId, type: 'fill', x, y, color });
            saveHistory();
        }
    };

    const draw = (e) => {
        if (!isDrawing) return;

        if (selectedTool === 'pan') {
            const dx = e.clientX - canvasRef.current.lastMouseX;
            const dy = e.clientY - canvasRef.current.lastMouseY;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            canvasRef.current.lastMouseX = e.clientX;
            canvasRef.current.lastMouseY = e.clientY;
            return;
        }

        const { x, y } = getCanvasCoordinates(e);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const drawColor = selectedTool === 'eraser' ? (theme === 'dark' ? '#0a0a0a' : '#ffffff') : color;

        if (selectedTool === 'pencil' || selectedTool === 'eraser') {
            drawOnCanvas(canvas.lastX, canvas.lastY, x, y, drawColor, brushSize);
            socketRef.current.emit('draw', {
                roomId,
                type: selectedTool,
                x, y,
                lastX: canvas.lastX,
                lastY: canvas.lastY,
                color: drawColor,
                size: brushSize,
            });
            canvas.lastX = x;
            canvas.lastY = y;
        } else if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
            const img = new Image();
            img.src = canvasSnapshot;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                drawShape(selectedTool, startPos.x, startPos.y, x, y, drawColor, brushSize);
            };
        }
    };

    const stopDrawing = (e) => {
        if (!isDrawing) return;
        console.log('[Draw] Mouse up - session ending, triggering save');
        setIsDrawing(false);

        if (selectedTool === 'pan') return;

        const { x, y } = getCanvasCoordinates(e);
        const drawColor = selectedTool === 'eraser' ? (theme === 'dark' ? '#0a0a0a' : '#ffffff') : color;

        if (['rectangle', 'circle', 'line', 'arrow'].includes(selectedTool)) {
            socketRef.current.emit('draw', {
                roomId,
                type: selectedTool,
                startX: startPos.x,
                startY: startPos.y,
                x, y,
                color: drawColor,
                size: brushSize
            });
        } else if (selectedTool === 'text') {
            const text = prompt('Enter your text:');
            if (text) {
                drawText(text, x, y, color, fontSize, fontFamily);
                socketRef.current.emit('draw', {
                    roomId,
                    type: 'text',
                    text,
                    x, y,
                    color,
                    params: { fontSize, fontFamily }
                });
            }
        }

        saveHistory();
    };

    const undo = () => {
        if (history.length === 0) return;
        const newHistory = history.slice(0, -1);
        setRedoStack((prev) => [canvasRef.current.toDataURL(), ...prev]);
        setHistory(newHistory);
        const stateToApply = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
        if (stateToApply) {
            applyCanvasState(stateToApply);
            socketRef.current.emit('undo', { roomId, canvasData: stateToApply });
        } else {
            canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            socketRef.current.emit('clear', roomId);
        }
    };

    const redo = () => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[0];
        setHistory((prev) => [...prev, nextState]);
        setRedoStack(redoStack.slice(1));
        applyCanvasState(nextState);
        socketRef.current.emit('undo', { roomId, canvasData: nextState });
    };

    const clearCanvas = () => {
        if (!isHost) return alert('Only the host can clear the board!');
        if (window.confirm('Clear board?')) {
            const canvas = canvasRef.current;
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            setHistory([]);
            setRedoStack([]);
            socketRef.current.emit('clear', roomId);
            saveToDB(canvas.toDataURL());
        }
    };

    const exportImage = () => {
        const link = document.createElement('a');
        link.download = `whiteboard-${roomId}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    const startRecording = () => {
        const canvas = canvasRef.current;
        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `whiteboard-recording-${roomId}.webm`;
            link.click();
            chunksRef.current = [];
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        const senderName = user.displayName || user.email.split('@')[0];
        socketRef.current.emit('chat-message', {
            roomId,
            message: newMessage,
            user: senderName,
        });
        setNewMessage('');
        socketRef.current.emit('stop-typing', { roomId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };

    const handleTyping = (e) => {
        setNewMessage(e.target.value);
        if (!socketRef.current) return;

        const displayName = user.displayName || user.email.split('@')[0];
        socketRef.current.emit('typing', { roomId, displayName });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current.emit('stop-typing', { roomId });
        }, 3000);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataURL = event.target.result;
            applyCanvasState(dataURL);
            socketRef.current.emit('undo', { roomId, canvasData: dataURL });
            saveHistory();
        };
        reader.readAsDataURL(file);
    };

    const handleCopyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUpdateTitle = async () => {
        if (!tempTitle.trim()) {
            setIsEditingTitle(false);
            return;
        }
        try {
            const token = sessionStorage.getItem('token');
            await axios.put('http://127.0.0.1:5000/api/room/update-title',
                { roomId, title: tempTitle },
                { headers: { 'x-auth-token': token } }
            );
            setTitle(tempTitle);
            socketRef.current.emit('update-title', { roomId, title: tempTitle });
            setIsEditingTitle(false);
        } catch (err) {
            console.error('Failed to update title:', err);
            setIsEditingTitle(false);
        }
    };

    const isDark = theme === 'dark';

    // Tool Config
    const tools = [
        { id: 'pan', icon: '🖐️', label: 'Pan', key: 'F' },
        { id: 'pencil', icon: '✏️', label: 'Pencil', key: 'Q' },
        { id: 'eraser', icon: '🧽', label: 'Eraser', key: 'W' },
        { id: 'rectangle', icon: '⬜', label: 'Rect', key: 'E' },
        { id: 'circle', icon: '⭕', label: 'Circle', key: 'R' },
        { id: 'line', icon: '📏', label: 'Line', key: 'T' },
        { id: 'arrow', icon: '↗️', label: 'Arrow', key: 'A' },
        { id: 'fill', icon: '🪣', label: 'Fill', key: 'S' },
        { id: 'text', icon: 'Aa', label: 'Text', key: 'D' },
    ];

    return (
        <div className={`flex flex-col h-screen overflow-hidden transition-colors duration-500 ${isDark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>

            {/* 1. TOP NAVBAR (Floating Style) */}
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 ${isDark ? 'bg-gray-900/90 border-gray-700/50' : 'bg-white/90 border-gray-200'}`}>
                <div className="flex items-center gap-1 px-1.5">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-white text-[10px] font-black">SC</span>
                    </div>
                </div>

                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {tools.slice(0, 3).map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setSelectedTool(tool.id)}
                        className={`group relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 
                        ${selectedTool === tool.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'hover:bg-gray-500/10'}`}
                    >
                        <span className="text-base">{tool.icon}</span>
                        <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{tool.label} ({tool.key})</span>
                    </button>
                ))}
                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                {tools.slice(3, 7).map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setSelectedTool(tool.id)}
                        className={`group relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 
                        ${selectedTool === tool.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'hover:bg-gray-500/10'}`}
                    >
                        <span className="text-base">{tool.icon}</span>
                        <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{tool.label} ({tool.key})</span>
                    </button>
                ))}
                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                {tools.slice(7).map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => setSelectedTool(tool.id)}
                        className={`group relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 
                        ${selectedTool === tool.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'hover:bg-gray-500/10'}`}
                    >
                        <span className="text-base">{tool.icon}</span>
                        <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-gray-800 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{tool.label} ({tool.key})</span>
                    </button>
                ))}

                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {/* Sidebar Shortcuts */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all active:scale-95 group border ${isSidebarOpen ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'hover:bg-gray-500/10 border-transparent'}`}
                    title="Toggle Chat & Users"
                >
                    <span className="text-base">💬</span>
                    <span className="text-[9px] font-black uppercase tracking-tighter hidden md:block italic">Collab</span>
                </button>

                <div className={`w-px h-5 mx-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                {/* UTILITY BUTTONS (Theme & Exit) */}
                <div className="flex items-center gap-0.5 px-0.5">
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90 ${isDark ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' : 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20'}`}
                        title="Toggle Theme"
                    >
                        {isDark ? '☀️' : '🌙'}
                    </button>
                    <button
                        onClick={async () => {
                            if (canvasRef.current) {
                                // Wait for save to complete before moving to dashboard
                                const result = await saveToDB(canvasRef.current.toDataURL());
                                if (!result.success) {
                                    if (!window.confirm(`Save failed: ${result.error}. Exit anyway?`)) return;
                                }
                            }
                            navigate('/dashboard');
                        }}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90 ${isSaving ? 'animate-pulse opacity-50 pointer-events-none' : ''}`}
                        title={isSaving ? "Saving..." : "Save & Exit"}
                    >
                        {isSaving ? '⏳' : '🚪'}
                    </button>
                </div>
            </div>

            {/* 2. LEFT PROPERTY PANEL */}
            <div className={`fixed top-20 left-4 z-40 w-52 p-4 rounded-2xl border shadow-xl backdrop-blur-xl transition-all duration-500 animate-fade-in-up
                ${isDark ? 'bg-gray-900/80 border-gray-700/50' : 'bg-white/90 border-gray-200'}`}>

                <div className="mb-6">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-3">Stroke Color</label>
                    <div className="grid grid-cols-5 gap-2">
                        {palette.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95
                                ${color === c ? 'border-blue-500 shadow-lg shadow-blue-500/30' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <div className="mt-3 relative h-10 rounded-xl overflow-hidden border border-gray-700/30">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                        />
                        <div className="w-full h-full flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-bold">Custom: {color}</span>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Brush Size</label>
                        <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 px-1.5 rounded">{brushSize}px</span>
                    </div>
                    <input
                        type="range" min="1" max="50" value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full h-1.5 rounded-lg bg-gray-700/30 appearance-none cursor-pointer accent-blue-500 mb-4"
                    />
                    <div className="flex items-center justify-center h-12 bg-gray-500/5 rounded-xl border border-dashed border-gray-500/20 overflow-hidden relative">
                        <div
                            className="bg-blue-500 rounded-full transition-all duration-200 shadow-lg shadow-blue-500/20"
                            style={{ width: brushSize, height: brushSize, maxWidth: '100%', maxHeight: '100%' }}
                        />
                        <span className="absolute bottom-1 right-1 text-[8px] opacity-30 font-bold uppercase">Preview</span>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-700/20 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">History</span>
                        <div className="flex gap-1">
                            <button onClick={undo} className="p-1.5 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 transition-all active:scale-90" title="Undo (Ctrl+Z)">↩️</button>
                            <button onClick={redo} className="p-1.5 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 transition-all active:scale-90" title="Redo (Ctrl+Y)">↪️</button>
                        </div>
                    </div>
                    <button onClick={clearCanvas} className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all duration-300 mt-2 border border-red-500/20 hover:bg-red-500/10 text-red-400 group">
                        <span className="group-hover:animate-pulse">🗑️ Clear Board</span>
                    </button>
                </div>
            </div>

            {/* 3. MAIN WORKSPACE (Canvas + Sidebar) */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Canvas Area */}
                <main className="flex-1 relative overflow-hidden flex items-stretch bg-gray-50/50 dark:bg-black/20">
                    <div
                        className={`flex-1 relative z-0 flex items-center justify-center transition-all duration-300 ${bgPattern === 'grid' ? (isDark ? 'bg-grid-dark' : 'bg-grid-light') : bgPattern === 'dots' ? (isDark ? 'bg-dots-dark' : 'bg-dots-light') : (isDark ? 'bg-black' : 'bg-white')}`}
                        onWheel={(e) => {
                            if (e.ctrlKey) {
                                setZoom(prev => Math.min(5, Math.max(0.1, prev - e.deltaY * 0.001)));
                            } else {
                                setPanOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
                            }
                        }}
                    >
                        <div
                            style={{
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                                transformOrigin: 'center center',
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                width={2400}
                                height={1400}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseOut={stopDrawing}
                                className={`shadow-2xl bg-white transition-opacity ${isDark ? 'opacity-90' : 'opacity-100'} ${selectedTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                            />
                        </div>

                        {/* Canvas Controls (Bottom Left) */}
                        <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2">
                            <div className={`flex items-center gap-1 p-1 rounded-2xl border shadow-xl backdrop-blur-xl ${isDark ? 'bg-gray-900/80 border-gray-700/50' : 'bg-white/90 border-gray-200'}`}>
                                <button onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-500/10 transition-all active:scale-90 opacity-70">➖</button>
                                <span onClick={() => setZoom(1)} className="text-[10px] font-mono font-bold min-w-[40px] text-center cursor-pointer hover:text-blue-500">{(zoom * 100).toFixed(0)}%</span>
                                <button onClick={() => setZoom(prev => Math.min(5, prev + 0.1))} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-500/10 transition-all active:scale-90 opacity-70">➕</button>
                            </div>

                            {/* Page Navigator */}
                            <div className={`flex items-center gap-1 p-1 rounded-2xl border shadow-xl backdrop-blur-xl ${isDark ? 'bg-gray-900/80 border-gray-700/50' : 'bg-white/90 border-gray-200'}`}>
                                <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 px-1.5">📄</span>
                                {pages.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => { if (idx !== currentPage) switchPage(idx); }}
                                        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 text-[10px] font-black
                                        ${currentPage === idx
                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105'
                                                : 'hover:bg-gray-500/10 text-gray-500'}`}
                                        title={`Page ${idx + 1}`}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                                <button
                                    onClick={addPage}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-green-500/10 text-green-500 transition-all active:scale-90 text-sm font-bold"
                                    title="Add New Page"
                                >
                                    +
                                </button>
                                {pages.length > 1 && (
                                    <button
                                        onClick={() => deletePage(currentPage)}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-red-500 transition-all active:scale-90 text-[10px]"
                                        title={`Delete Page ${currentPage + 1}`}
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {/* 4. SIDEBAR (Collapsible) */}
                <aside
                    className={`relative z-40 flex flex-col transition-all duration-500 ease-in-out border-l shadow-2xl flex-shrink-0 overflow-hidden h-full
                    ${isSidebarOpen ? 'w-80' : 'w-0 border-none'}
                    ${isDark ? 'bg-gray-950 border-gray-800' : 'bg-white border-gray-200'}`}
                >
                    <div className="flex flex-col h-full w-80">
                        {/* Header */}
                        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                            <div className="flex flex-col">
                                {isEditingTitle && isHost ? (
                                    <input
                                        autoFocus value={tempTitle}
                                        onChange={(e) => setTempTitle(e.target.value)}
                                        onBlur={handleUpdateTitle}
                                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
                                        className="bg-transparent border-b border-blue-500 text-sm font-black focus:outline-none w-full uppercase tracking-wider"
                                    />
                                ) : (
                                    <h2
                                        onClick={() => { if (isHost) { setTempTitle(title); setIsEditingTitle(true); } }}
                                        className="font-black text-sm uppercase tracking-wider truncate max-w-[220px] cursor-pointer hover:text-blue-500 transition-colors text-blue-600 dark:text-blue-400"
                                    >
                                        {title}
                                    </h2>
                                )}
                                <div className="flex items-center gap-2 mt-2 opacity-100 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/10 transition-all hover:bg-blue-500/10">
                                    <span className="text-[11px] font-black uppercase tracking-tighter text-blue-500">Room:</span>
                                    <span className="text-[13px] font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 select-all">{roomId}</span>
                                    <button onClick={handleCopyRoomId} className="hover:scale-125 active:scale-95 transition-all text-lg ml-1" title="Copy Room ID">{copied ? '✅' : '📋'}</button>
                                </div>
                            </div>
                            <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-xl bg-gray-500/10 hover:bg-gray-500/20 transition-all active:scale-95 flex items-center justify-center group">
                                <span className="group-hover:rotate-90 transition-transform text-xs">✕</span>
                            </button>
                        </div>

                        {/* Participants Section */}
                        <div className="px-5 py-3 border-b border-gray-800/10 max-h-[105px] overflow-y-auto custom-scrollbar bg-gray-500/5">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Collaborators</span>
                                <span className="flex items-center gap-1">
                                    <span className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                    <span className="text-[9px] font-bold text-green-500">{participants.length} Active</span>
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {participants.map((p, i) => (
                                    <div key={i} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all ${p.userId === user?.id ? 'bg-blue-500/5 border border-blue-500/10' : 'hover:bg-gray-500/5'}`}>
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white shadow-md flex-shrink-0 relative
                                            ${p.userId === user?.id ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-600'}`}>
                                            {(p.displayName || p.email)[0].toUpperCase()}
                                            {p.userId === hostId && (
                                                <span className="absolute -top-1.5 -right-1.5 text-[10px] drop-shadow-md" title="Host">👑</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className={`text-[11px] font-bold truncate ${p.userId === user?.id ? 'text-blue-500' : ''}`}>
                                                {p.displayName || p.email.split('@')[0]}
                                                {p.userId === user?.id && <span className="text-[8px] ml-1 opacity-50">(You)</span>}
                                            </span>
                                            {p.userId === hostId && (
                                                <span className="text-[8px] font-black uppercase tracking-widest text-yellow-500">Host</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Chat Section */}
                        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                                {chatMessages.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3">
                                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-current flex items-center justify-center text-2xl">⏳</div>
                                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Messages...</p>
                                    </div>
                                )}
                                {chatMessages.map((msg, idx) => {
                                    if (msg.isSystem) {
                                        return (
                                            <div key={idx} className="flex justify-center my-6 animate-fade-in">
                                                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isDark ? 'bg-gray-800/30 border-gray-700/50 text-gray-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                                    {msg.message}
                                                </span>
                                            </div>
                                        );
                                    }

                                    const isMe = msg.socketId === socketRef.current?.id;
                                    return (
                                        <div key={idx} className={`message-group ${isMe ? 'message-self' : 'message-other'} animate-fade-in-up`}>
                                            <span className="sender-name">
                                                {isMe ? 'You' : msg.user}
                                            </span>
                                            <div className="bubble-wrapper">
                                                {!isMe && (
                                                    <div className="avatar-small shadow-sm ring-1 ring-gray-200/50">
                                                        {msg.user[0].toUpperCase()}
                                                    </div>
                                                )}
                                                <div className={`prof-bubble ${isMe ? 'prof-bubble-self shadow-blue-500/20' : 'prof-bubble-other'}`}>
                                                    <div className="break-words whitespace-pre-wrap">{msg.message}</div>
                                                    <div className={`msg-time flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                {isMe && (
                                                    <div className="avatar-small shadow-sm !bg-blue-500/20 !text-blue-500 ring-1 ring-blue-500/30">
                                                        {msg.user[0].toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {Object.keys(typingUsers).length > 0 && (
                                    <div className="message-group message-other animate-fade-in-up opacity-60">
                                        <div className="bubble-wrapper">
                                            <div className="avatar-small">
                                                {Object.values(typingUsers)[0][0].toUpperCase()}
                                            </div>
                                            <div className="prof-bubble prof-bubble-other">
                                                <div className="flex items-center gap-1.5 h-3">
                                                    <span className="dot" />
                                                    <span className="dot" />
                                                    <span className="dot" />
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[8px] font-black text-blue-500 ml-9 mt-1 uppercase tracking-tighter">
                                            {Object.values(typingUsers).join(', ')} typing...
                                        </span>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <form onSubmit={handleSendMessage} className={`p-6 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'} bg-transparent backdrop-blur-md`}>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={handleTyping}
                                        placeholder="Type a message..."
                                        className={`w-full ${isDark ? 'bg-gray-800/50 border-gray-700/50 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-2xl pl-5 pr-14 py-4 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-inner`}
                                    />
                                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-500 hover:bg-blue-600 w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-lg active:scale-95">
                                        <span className="text-xl text-white">✈️</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </aside>
            </div>

            {/* 5. FOOTER / STATUS BAR */}
            <footer className={`fixed bottom-4 right-1/2 translate-x-1/2 z-[70] flex items-center gap-4 px-5 py-2 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in-up-delay-2
                ${isDark ? 'bg-gray-900/80 border-gray-700/50' : 'bg-white/80 border-gray-200'}`}>

                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isSaving ? 'text-blue-500 animate-pulse' : 'text-gray-500'}`}>
                        {isSaving ? '⚡ Saving Changes' : '✅ Syncing State'}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-blue-500 animate-ping' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`} />
                </div>

                <div className={`w-px h-6 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                <div className="flex gap-2">
                    <button onClick={exportImage} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 
                            ${isDark ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        💾 Export PNG
                    </button>
                    <button onClick={isRecording ? stopRecording : startRecording} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2
                            ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40' : (isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100')}`}>
                        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-red-500'}`} />
                        {isRecording ? 'Rec' : '⏺️ Record'}
                    </button>
                    <button
                        onClick={() => {
                            if (!isCallActive) {
                                setIsCallActive(true);
                            } else {
                                if (window.confirm('Leave call?')) {
                                    setIsCallActive(false);
                                    if (socketRef.current) socketRef.current.emit('leave-call', { roomId });
                                }
                            }
                        }}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2
                            ${isCallActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40' : (isDark ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100')}`}
                    >
                        <span>{isCallActive ? '📞 In Call' : '🤙 Video Call'}</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!isSharingActive) {
                                setIsSharingActive(true);
                            } else {
                                setIsSharingActive(false);
                            }
                        }}
                        className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2
                            ${isSharingActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40' : (isDark ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100')}`}
                    >
                        <span>{isSharingActive ? '🖥️ Sharing' : '📺 Screen Share'}</span>
                    </button>
                </div>

                <div className={`w-px h-6 mx-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />

                <button
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-500/10 hover:bg-gray-500/20 transition-all font-mono text-xs text-gray-500 active:scale-90"
                    title="Keyboard Shortcuts"
                >
                    ⌨️
                </button>
            </footer>

            {/* 6. MODALS / OVERLAYS */}
            <Conferencing
                socket={socketRef.current}
                roomId={roomId}
                user={user}
                participants={participants}
                initialVideo={isCallActive}
                initialScreen={isSharingActive}
                onCloseCall={() => setIsCallActive(false)}
                onCloseScreen={() => setIsSharingActive(false)}
            />
            {
                showShortcuts && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowShortcuts(false)}>
                        <div className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl transition-all duration-500 scale-100 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black">Keyboard Shortcuts</h3>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Boost your workflow</p>
                                </div>
                                <button onClick={() => setShowShortcuts(false)} className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 transition-all hover:text-white">✕</button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                {tools.map(t => (
                                    <div key={t.id} className="flex items-center justify-between group">
                                        <span className="text-sm font-bold opacity-60 group-hover:opacity-100 transition-opacity">{t.icon} {t.label}</span>
                                        <kbd className={`px-2 py-1 rounded-lg text-[10px] font-black border-b-2 shadow-md ${isDark ? 'bg-gray-800 border-gray-950 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'}`}>{t.key}</kbd>
                                    </div>
                                ))}
                                <div className="col-span-2 pt-4 border-t border-gray-700/20 mt-2 flex flex-col gap-4">
                                    <div className="flex items-center justify-between group">
                                        <span className="text-sm font-bold opacity-60 group-hover:opacity-100 transition-opacity">↩️ Undo</span>
                                        <kbd className={`px-2 py-1 rounded-lg text-[10px] font-black border-b-2 shadow-md ${isDark ? 'bg-gray-800 border-gray-950 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'}`}>Ctrl+Z</kbd>
                                    </div>
                                    <div className="flex items-center justify-between group">
                                        <span className="text-sm font-bold opacity-60 group-hover:opacity-100 transition-opacity">↪️ Redo</span>
                                        <kbd className={`px-2 py-1 rounded-lg text-[10px] font-black border-b-2 shadow-md ${isDark ? 'bg-gray-800 border-gray-950 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'}`}>Ctrl+Y</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Global CSS for Grid/Dots */}
            <style>{`
                .bg-grid-light { 
                    background-image: 
                        linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px);
                    background-size: 40px 40px;
                }
                .bg-grid-dark { 
                    background-image: 
                        linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 40px 40px;
                    background-color: #030303;
                }
                .bg-dots-light {
                    background-image: radial-gradient(rgba(0,0,0,0.1) 1px, transparent 1px);
                    background-size: 20px 20px;
                }
                .bg-dots-dark {
                    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
                    background-size: 20px 20px;
                    background-color: #030303;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(155, 155, 155, 0.2);
                    border-radius: 10px;
                }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }

                /* Professional Chat Styles */
                .chat-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .message-group {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    max-width: 85%;
                }
                .message-self {
                    align-items: flex-end;
                    margin-left: auto;
                }
                .message-other {
                    align-items: flex-start;
                    margin-right: auto;
                }
                .sender-name {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 4px;
                    margin-left: 4px;
                    margin-right: 4px;
                    opacity: 0.7;
                }
                .bubble-wrapper {
                    display: flex;
                    gap: 8px;
                    align-items: flex-end;
                }
                .avatar-small {
                    width: 24px;
                    height: 24px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: 900;
                    background: ${isDark ? '#374151' : '#e5e7eb'};
                    color: ${isDark ? '#9ca3af' : '#4b5563'};
                    flex-shrink: 0;
                    margin-bottom: 2px;
                }
                .prof-bubble {
                    position: relative;
                    padding: 12px 16px;
                    border-radius: 16px;
                    font-size: 12px;
                    line-height: 1.5;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                    transition: transform 0.2s ease;
                }
                .prof-bubble:hover {
                    transform: translateY(-1px);
                }
                .prof-bubble-other {
                    background: ${isDark ? '#1f2937' : '#ffffff'};
                    color: ${isDark ? '#f3f4f6' : '#1f2937'};
                    border: 1px solid ${isDark ? '#374151' : '#f3f4f6'};
                    border-bottom-left-radius: 4px;
                }
                .prof-bubble-other::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: -6px;
                    width: 12px;
                    height: 12px;
                    background: inherit;
                    border-left: 1px solid ${isDark ? '#374151' : '#f3f4f6'};
                    border-bottom: 1px solid ${isDark ? '#374151' : '#f3f4f6'};
                    transform: skewX(45deg);
                    z-index: -1;
                }
                .prof-bubble-self {
                    background: linear-gradient(135deg, #3b82f6, #6366f1);
                    color: #ffffff;
                    border-bottom-right-radius: 4px;
                }
                .prof-bubble-self::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    right: -6px;
                    width: 12px;
                    height: 12px;
                    background: #6366f1;
                    transform: skewX(-45deg);
                    z-index: -1;
                }
                .msg-time {
                    font-size: 9px;
                    opacity: 0.5;
                    margin-top: 6px;
                    font-weight: 600;
                }

                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-4px); }
                }
                .dot {
                    display: inline-block;
                    width: 4px;
                    height: 4px;
                    margin: 0 1px;
                    background: currentColor;
                    border-radius: 50%;
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                .dot:nth-child(2) { animation-delay: -0.32s; }
                .dot:nth-child(3) { animation-delay: -0.16s; }
            `}</style>

        </div >
    );
};

export default Whiteboard;
