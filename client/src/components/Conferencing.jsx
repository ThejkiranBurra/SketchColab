import React, { useEffect, useRef, useState, useCallback } from 'react';

const Conferencing = ({ socket, roomId, user, participants, initialVideo, initialScreen, onCloseCall, onCloseScreen }) => {
    const [localStream, setLocalStream] = useState(null);
    const [screenStream, setScreenStream] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [peerStatus, setPeerStatus] = useState({}); // { socketId: { isMuted, isVideoOff } }

    // peers state for UI: { socketId: { mediaStream, screenStream } }
    const [peers, setPeers] = useState({});

    // Zoom/Fullscreen State
    const [fullScreenStream, setFullScreenStream] = useState(null); // { stream, label, socketId }

    // WebRTC Refs
    const peersRef = useRef({}); // { [socketId-type]: RTCPeerConnection }
    const pendingCandidatesRef = useRef({});

    // Media Refs
    const localStreamRef = useRef(null);
    const screenStreamRef = useRef(null);

    // Video DOM Refs
    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef({});
    const fullScreenVideoRef = useRef(null);

    const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };

    const getUserName = (socketId) => {
        const p = participants?.find(p => p.socketId === socketId);
        return p ? p.displayName : 'Collaborator';
    };

    useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
    useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

    // Local Video Binding
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Fullscreen Video Binding
    useEffect(() => {
        if (fullScreenVideoRef.current && fullScreenStream?.stream) {
            fullScreenVideoRef.current.srcObject = fullScreenStream.stream;
        }
    }, [fullScreenStream]);

    const cleanupPeer = useCallback((id) => {
        const [socketId, type] = id.split('-');

        // If the peer leaving was in fullscreen, exit fullscreen
        setFullScreenStream(prev => (prev?.socketId === socketId ? null : prev));

        if (peersRef.current[id]) {
            peersRef.current[id].close();
            delete peersRef.current[id];
        }
        delete pendingCandidatesRef.current[id];
        delete remoteVideoRefs.current[id];

        setPeers(prev => {
            const next = { ...prev };
            if (next[socketId]) {
                if (type === 'media') delete next[socketId].mediaStream;
                if (type === 'screen') delete next[socketId].screenStream;
                if (Object.keys(next[socketId]).length === 0) delete next[socketId];
            }
            return next;
        });
    }, []);

    const createPeerConnection = useCallback((targetSocketId, type) => {
        const id = `${targetSocketId}-${type}`;
        if (peersRef.current[id]) return peersRef.current[id];

        console.log(`Creating PeerConnection for ${id}`);
        const pc = new RTCPeerConnection(configuration);
        peersRef.current[id] = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    to: targetSocketId,
                    roomId,
                    type
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`Track received on ${id}: ${event.track.kind}`);
            const stream = event.streams[0];

            setPeers(prev => {
                const existing = prev[targetSocketId] || {};
                return {
                    ...prev,
                    [targetSocketId]: {
                        ...existing,
                        [type === 'media' ? 'mediaStream' : 'screenStream']: stream
                    }
                };
            });

            setTimeout(() => {
                const el = remoteVideoRefs.current[id];
                if (el) el.srcObject = stream;
            }, 500);
        };

        pc.onnegotiationneeded = async () => {
            try {
                console.log(`Negotiation needed for ${id}`);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { offer, to: targetSocketId, roomId, type });
            } catch (err) {
                console.error(`Error during negotiation for ${id}:`, err);
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                cleanupPeer(id);
            }
        };

        const stream = type === 'media' ? localStreamRef.current : screenStreamRef.current;
        if (stream) {
            console.log(`Adding ${type} tracks for ${id}`);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }

        return pc;
    }, [socket, roomId, cleanupPeer]);

    const handleOffer = useCallback(async ({ offer, from, type }) => {
        const pc = createPeerConnection(from, type);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const id = `${from}-${type}`;
            if (pendingCandidatesRef.current[id]) {
                for (const candidate of pendingCandidatesRef.current[id]) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
                delete pendingCandidatesRef.current[id];
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { answer, to: from, roomId, type });
        } catch (err) {
            console.error(`Error handling ${type} offer:`, err);
        }
    }, [socket, roomId, createPeerConnection]);

    const handleAnswer = useCallback(async ({ answer, from, type }) => {
        const id = `${from}-${type}`;
        const pc = peersRef.current[id];
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                if (pendingCandidatesRef.current[id]) {
                    for (const candidate of pendingCandidatesRef.current[id]) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    delete pendingCandidatesRef.current[id];
                }
            } catch (err) {
                console.error(`Error handling ${type} answer:`, err);
            }
        }
    }, []);

    const handleIceCandidate = useCallback(async ({ candidate, from, type }) => {
        const id = `${from}-${type}`;
        const pc = peersRef.current[id];
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error(`Error adding ICE candidate for ${id}:`, err);
            }
        } else {
            if (!pendingCandidatesRef.current[id]) pendingCandidatesRef.current[id] = [];
            pendingCandidatesRef.current[id].push(candidate);
        }
    }, []);

    const broadcastJoin = useCallback((type) => {
        console.log(`Broadcasting ${type} share`);
        participants.forEach(p => {
            if (p.socketId !== socket.id) {
                createPeerConnection(p.socketId, type);
            }
        });
        socket.emit('join-call', { roomId, type });
    }, [participants, socket, roomId, createPeerConnection]);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            broadcastJoin('media');
        } catch (err) {
            console.error('Error accessing camera:', err);
            onCloseCall();
        }
    }, [broadcastJoin, onCloseCall]);

    const stopCamera = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            setLocalStream(null);
            Object.keys(peersRef.current).forEach(id => {
                if (id.endsWith('-media')) cleanupPeer(id);
            });
        }
    }, [localStream, cleanupPeer]);

    const startScreen = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setScreenStream(stream);
            stream.getVideoTracks()[0].onended = () => {
                stopScreen();
                onCloseScreen();
            };
            broadcastJoin('screen');
        } catch (err) {
            console.error('Error sharing screen:', err);
            onCloseScreen();
        }
    }, [broadcastJoin, onCloseScreen]);

    const stopScreen = useCallback(() => {
        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
            setScreenStream(null);
            Object.keys(peersRef.current).forEach(id => {
                if (id.endsWith('-screen')) cleanupPeer(id);
            });
        }
    }, [screenStream, cleanupPeer]);

    useEffect(() => {
        if (initialVideo && !localStream) startCamera();
        else if (!initialVideo && localStream) stopCamera();
    }, [initialVideo]);

    useEffect(() => {
        if (initialScreen && !screenStream) startScreen();
        else if (!initialScreen && screenStream) stopScreen();
    }, [initialScreen]);

    useEffect(() => {
        if (!socket) return;

        socket.on('user-joined-call', async ({ socketId, type = 'media' }) => {
            console.log(`User ${socketId} joined for ${type}`);
            createPeerConnection(socketId, type);
        });

        socket.on('offer', handleOffer);
        socket.on('answer', handleAnswer);
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('media-status', ({ from, isMuted, isVideoOff }) => {
            setPeerStatus(prev => ({ ...prev, [from]: { isMuted, isVideoOff } }));
        });

        socket.on('user-left-call', ({ socketId }) => {
            cleanupPeer(`${socketId}-media`);
            cleanupPeer(`${socketId}-screen`);
        });

        return () => {
            socket.off('user-joined-call');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('media-status');
            socket.off('user-left-call');
        };
    }, [socket, roomId, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate, cleanupPeer]);

    useEffect(() => {
        if (!localStream) return;
        Object.keys(peersRef.current).forEach(id => {
            if (id.endsWith('-media')) {
                const pc = peersRef.current[id];
                const senders = pc.getSenders();
                localStream.getTracks().forEach(track => {
                    const alreadySent = senders.find(s => s.track && s.track.id === track.id);
                    if (!alreadySent) pc.addTrack(track, localStream);
                });
            }
        });
    }, [localStream]);

    useEffect(() => {
        if (!screenStream) return;
        Object.keys(peersRef.current).forEach(id => {
            if (id.endsWith('-screen')) {
                const pc = peersRef.current[id];
                const senders = pc.getSenders();
                screenStream.getTracks().forEach(track => {
                    const alreadySent = senders.find(s => s.track && s.track.id === track.id);
                    if (!alreadySent) pc.addTrack(track, screenStream);
                });
            }
        });
    }, [screenStream]);

    useEffect(() => {
        return () => {
            if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
            if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
            Object.values(peersRef.current).forEach(pc => pc.close());
        };
    }, []);

    const toggleMute = () => {
        if (localStream) {
            const enabled = !isMuted;
            localStream.getAudioTracks().forEach(t => t.enabled = enabled);
            setIsMuted(!isMuted);
            socket.emit('media-status', { roomId, isMuted: !isMuted, isVideoOff });
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const enabled = isVideoOff;
            localStream.getVideoTracks().forEach(t => t.enabled = enabled);
            setIsVideoOff(!isVideoOff);
            socket.emit('media-status', { roomId, isMuted, isVideoOff: !isVideoOff });
        }
    };

    const hasAnyStream = localStream || screenStream || Object.keys(peers).length > 0;
    if (!hasAnyStream) return null;

    // totalBlocks for grid (Excluding local screen)
    const totalBlocks = (localStream ? 1 : 0) +
        Object.values(peers).reduce((acc, p) => acc + (p.mediaStream ? 1 : 0) + (p.screenStream ? 1 : 0), 0);

    const getGridLayout = () => {
        if (totalBlocks <= 1) return 'grid-cols-1';
        if (totalBlocks <= 4) return 'grid-cols-2';
        return 'grid-cols-3';
    };

    return (
        <>
            {/* FullScreen Zoom View */}
            {fullScreenStream && (
                <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex flex-col animate-fade-in">
                    <div className="p-4 flex justify-between items-center border-b border-gray-800 bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">
                                Viewing: {fullScreenStream.label}
                            </span>
                        </div>
                        <button
                            onClick={() => setFullScreenStream(null)}
                            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10 active:scale-95 flex items-center gap-2"
                        >
                            <span>←</span> Back to Whiteboard
                        </button>
                    </div>
                    <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
                        <video
                            ref={fullScreenVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5"
                        />
                    </div>
                </div>
            )}

            <div className={`fixed bottom-24 right-6 z-50 flex flex-col gap-4 w-[420px] max-h-[70vh] rounded-3xl border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl shadow-2xl p-4 animate-fade-in-up ${fullScreenStream ? 'opacity-20 pointer-events-none scale-95 blur-sm' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Collaboration Hub</h3>
                        <p className="text-[8px] text-gray-500 uppercase font-bold">{totalBlocks} item{totalBlocks !== 1 ? 's' : ''} in grid</p>
                    </div>
                    <div className="flex gap-2">
                        {localStream && (
                            <>
                                <button onClick={toggleMute} title="Toggle Mic" className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                                    {isMuted ? '🔇' : '🎤'}
                                </button>
                                <button onClick={toggleVideo} title="Toggle Camera" className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isVideoOff ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                                    {isVideoOff ? '🚫' : '📹'}
                                </button>
                            </>
                        )}
                        <button onClick={() => { onCloseCall(); onCloseScreen(); }} title="Close Hub" className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-xs font-bold ring-1 ring-red-500/20">✕</button>
                    </div>
                </div>

                <div className={`grid ${getGridLayout()} gap-3 overflow-y-auto custom-scrollbar pr-1 content-start`}>
                    {localStream && (
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-gray-800 ring-2 ring-blue-500/20 group shadow-lg">
                            <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-500 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
                            {isVideoOff && <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-black text-[10px] uppercase tracking-tighter">Camera Off</div>}
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[8px] font-black uppercase tracking-widest text-white border border-white/10 flex items-center gap-1">
                                {isMuted && <span className="text-red-500">🔇</span>} You
                            </div>
                        </div>
                    )}

                    {/* Local screen share is hidden for the sharer as per user request */}

                    {Object.entries(peers).map(([sockId, streams]) => (
                        <React.Fragment key={sockId}>
                            {streams.mediaStream && (
                                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-gray-800 group shadow-md transition-transform hover:scale-[1.02]">
                                    <video
                                        ref={el => { if (el) { remoteVideoRefs.current[`${sockId}-media`] = el; el.srcObject = streams.mediaStream; } }}
                                        autoPlay
                                        playsInline
                                        className={`w-full h-full object-cover transition-opacity duration-500 ${peerStatus[sockId]?.isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                                    />
                                    {peerStatus[sockId]?.isVideoOff && <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-black text-[10px] uppercase tracking-tighter">Video Off</div>}
                                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[8px] font-black uppercase tracking-widest text-white border border-white/10 flex items-center gap-1">
                                        {peerStatus[sockId]?.isMuted && <span className="text-red-500">🔇</span>} {getUserName(sockId)}
                                    </div>
                                </div>
                            )}
                            {streams.screenStream && (
                                <div
                                    className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-blue-500/40 shadow-lg shadow-blue-500/10 cursor-zoom-in transition-all hover:border-blue-500/80 active:scale-95 group"
                                    onClick={() => setFullScreenStream({ stream: streams.screenStream, label: `${getUserName(sockId)}'s Screen`, socketId: sockId })}
                                >
                                    <video
                                        ref={el => { if (el) { remoteVideoRefs.current[`${sockId}-screen`] = el; el.srcObject = streams.screenStream; } }}
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-contain pointer-events-none"
                                    />
                                    <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="px-3 py-1.5 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-xl shadow-blue-500/30">Click to Zoom</div>
                                    </div>
                                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-blue-500/80 backdrop-blur-md text-[8px] font-black uppercase tracking-widest text-white">{getUserName(sockId)}'s Screen</div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </>
    );
};

export default Conferencing;
