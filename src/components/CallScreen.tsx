import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../hooks/useStore";
import { audioSynthesizer } from "../utils/audio";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Loader2, SwitchCamera, Sparkles } from "lucide-react";
import { isMockMode } from "../lib/supabase";
import { chatService } from "../services/chatService";

export const CallScreen: React.FC = () => {
  const { callState, callType, callPartner, acceptCall, endCall, localStream, remoteStream } = useStore();
  const [seconds, setSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const timerRef = useRef<number | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Global gesture unlock to ensure audio playback is never restricted by mobile browser policies
  const handleUserInteraction = () => {
    audioSynthesizer.unlockAudio();
    if (remoteAudioRef.current && remoteAudioRef.current.paused) {
      remoteAudioRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current && remoteVideoRef.current.paused) {
      remoteVideoRef.current.play().catch(() => {});
    }
    if (localVideoRef.current && localVideoRef.current.paused) {
      localVideoRef.current.play().catch(() => {});
    }
  };

  const bindRemoteAudio = (el: HTMLAudioElement | null) => {
    remoteAudioRef.current = el;
    if (el) {
      el.muted = false;
      el.volume = 1.0;
      if (remoteStream && el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
      }
      el.play().catch((err) => {
        console.warn("[WebRTC] Remote audio autoplay waiting for touch gesture:", err);
      });
    }
  };

  const bindRemoteVideo = (el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el) {
      // Crucial: Keep video element muted so browser autoplay policies never block or pause video frames
      el.muted = true;
      el.volume = 0;
      if (remoteStream && el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
      }
      el.play().catch((err) => {
        console.warn("[WebRTC] Remote video play error:", err);
      });
    }
  };

  const bindLocalVideo = (el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el) {
      // Crucial: Keep local video muted to prevent audio feedback loop and avoid autoplay blocking
      el.muted = true;
      el.volume = 0;
      if (localStream && el.srcObject !== localStream) {
        el.srcObject = localStream;
      }
      el.play().catch((err) => {
        console.warn("[WebRTC] Local video play error:", err);
      });
    }
  };

  // Bind WebRTC audio element whenever remoteStream updates
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch((err) => {
        console.warn("[WebRTC] Audio auto-play retry deferred:", err);
      });
    }
  }, [remoteStream, callState]);

  // Bind WebRTC remote video whenever remoteStream updates
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current && callType === "video") {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.play().catch((err) => {
        console.warn("[WebRTC] Remote video auto-play error:", err);
      });
    }
  }, [remoteStream, callType, callState]);

  // Bind WebRTC local video whenever localStream updates
  useEffect(() => {
    if (localStream && localVideoRef.current && callType === "video") {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch((err) => {
        console.warn("[WebRTC] Local video auto-play error:", err);
      });
    }
  }, [localStream, camMuted, callType, callState]);

  // Handle call transitions and ringtones
  useEffect(() => {
    if (callState === "dialing") {
      audioSynthesizer.startDialingTone();

      let timeout: any = null;
      if (isMockMode) {
        timeout = setTimeout(() => {
          audioSynthesizer.stopRingtone();
          audioSynthesizer.playConnectChime();
          acceptCall();
        }, 3500);
      }

      return () => {
        if (timeout) clearTimeout(timeout);
        audioSynthesizer.stopRingtone();
      };
    } else if (callState === "receiving") {
      const currentUserId = useStore.getState().user?.id;
      const convs = useStore.getState().conversations;
      const partnerConv = callPartner ? convs.find((c) => !c.is_group && c.members?.some((m) => m.id === callPartner.id)) : null;
      const isMuted = currentUserId && partnerConv ? chatService.isConversationMuted(currentUserId, partnerConv.id, "call") : false;

      if (!isMuted) {
        const selectedRingtone = localStorage.getItem("kb_ringtone") || "classic";
        audioSynthesizer.startIncomingRingtone(selectedRingtone);
      }
      return () => {
        audioSynthesizer.stopRingtone();
      };
    } else if (callState === "active") {
      audioSynthesizer.stopRingtone();
      audioSynthesizer.unlockAudio();

      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);

      return () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
        }
      };
    }
  }, [callState, acceptCall, callPartner]);

  const handleDecline = () => {
    audioSynthesizer.playDisconnectChime();
    endCall();
  };

  const handleAccept = () => {
    audioSynthesizer.stopRingtone();
    audioSynthesizer.playConnectChime();
    audioSynthesizer.unlockAudio();
    acceptCall();
  };

  const handleHangUp = () => {
    audioSynthesizer.playDisconnectChime();
    endCall();
  };

  const handleToggleMic = async () => {
    const nextMuted = !micMuted;
    setMicMuted(nextMuted);
    if (!isMockMode) {
      const { callService } = await import("../services/callService");
      callService.toggleMic(nextMuted);
    }
  };

  const handleToggleCam = async () => {
    const nextMuted = !camMuted;
    setCamMuted(nextMuted);
    if (!isMockMode) {
      const { callService } = await import("../services/callService");
      callService.toggleCam(nextMuted);
    }
  };

  const handleSwitchCamera = async () => {
    if (!isMockMode) {
      const { callService } = await import("../services/callService");
      callService.switchCamera();
    }
  };

  const formatCallTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (callState === "idle" || !callPartner) return null;

  const hasRemoteVideo = Boolean(
    remoteStream &&
    remoteStream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
  );

  return (
    <div
      onClick={handleUserInteraction}
      onTouchStart={handleUserInteraction}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 select-none text-white font-sans overflow-hidden"
    >
      {/* Hidden dedicated audio player for high-fidelity remote voice audio */}
      <audio
        ref={bindRemoteAudio}
        autoPlay
        playsInline
        className="hidden pointer-events-none"
      />

      {/* ===================== VIDEO CALL ACTIVE VIEW ===================== */}
      {callState === "active" && callType === "video" && !isMockMode ? (
        <div className="relative w-full h-full flex flex-col justify-between">
          {/* Main Remote Video Stream Background */}
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center overflow-hidden">
            <video
              ref={bindRemoteVideo}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                hasRemoteVideo ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Connecting placeholder overlay if remote video frames are not ready yet */}
            {!hasRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900">
                <div className="relative mb-6">
                  <div className="absolute -inset-4 rounded-full bg-violet-600/20 blur-xl animate-pulse"></div>
                  <img
                    src={callPartner.avatar_url}
                    alt={callPartner.username}
                    className="w-28 h-28 rounded-full object-cover border-2 border-violet-500/50 shadow-2xl relative z-10"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-violet-600 p-2 rounded-full border-2 border-slate-950 z-20">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-1">{callPartner.username}</h3>
                <p className="text-sm text-violet-400 flex items-center gap-1.5 font-medium animate-pulse">
                  <span>Connecting video feed...</span>
                </p>
              </div>
            )}
          </div>

          {/* Top Video Overlay Header */}
          <div className="relative z-30 p-4 sm:p-6 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={callPartner.avatar_url}
                alt={callPartner.username}
                className="w-10 h-10 rounded-full object-cover border border-violet-500/40 shadow"
              />
              <div>
                <h3 className="text-base font-semibold leading-tight drop-shadow">{callPartner.username}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-xs text-slate-300 font-mono drop-shadow">{formatCallTime(seconds)}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-violet-900/60 border border-violet-400/30 text-violet-200 rounded">
                    HD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Local Camera Picture-In-Picture (PIP) */}
          <div className="absolute top-20 right-4 sm:top-24 sm:right-6 w-28 sm:w-36 aspect-[3/4] bg-slate-900/90 border-2 border-violet-500/50 rounded-2xl overflow-hidden shadow-2xl z-30 backdrop-blur-md">
            {camMuted ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 text-xs gap-1.5 p-2 text-center">
                <VideoOff className="w-5 h-5 text-red-400" />
                <span className="text-[11px] font-medium">Camera off</span>
              </div>
            ) : (
              <video
                ref={bindLocalVideo}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
          </div>

          {/* Bottom Floating Control Bar */}
          <div className="relative z-30 p-6 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent flex items-center justify-center gap-5">
            {/* Mute Mic */}
            <button
              onClick={handleToggleMic}
              title={micMuted ? "Unmute Mic" : "Mute Mic"}
              className={`w-13 h-13 p-3.5 rounded-full flex items-center justify-center border transition-all active:scale-90 backdrop-blur-md shadow-lg ${
                micMuted
                  ? "bg-red-500/20 border-red-500/50 text-red-400"
                  : "bg-slate-900/70 border-slate-700/60 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Toggle Camera */}
            <button
              onClick={handleToggleCam}
              title={camMuted ? "Turn Camera On" : "Turn Camera Off"}
              className={`w-13 h-13 p-3.5 rounded-full flex items-center justify-center border transition-all active:scale-90 backdrop-blur-md shadow-lg ${
                camMuted
                  ? "bg-red-500/20 border-red-500/50 text-red-400"
                  : "bg-slate-900/70 border-slate-700/60 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {camMuted ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            {/* Switch / Flip Camera */}
            {!camMuted && (
              <button
                onClick={handleSwitchCamera}
                title="Flip Camera"
                className="w-13 h-13 p-3.5 rounded-full flex items-center justify-center border bg-slate-900/70 border-slate-700/60 text-slate-200 hover:bg-slate-800 transition-all active:scale-90 backdrop-blur-md shadow-lg"
              >
                <SwitchCamera className="w-6 h-6" />
              </button>
            )}

            {/* End Call */}
            <button
              onClick={handleHangUp}
              title="End Call"
              className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      ) : (
        /* ===================== STANDARD CALL VIEW (Voice Call / Dialing / Receiving) ===================== */
        <div className="relative w-full h-full flex flex-col items-center justify-between py-12 px-6">
          {/* Ambient glowing wave rings in background */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

          {/* Top Info Bar */}
          <div className="flex items-center gap-2 z-10 text-xs text-slate-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>End-to-end encrypted {callType} call</span>
          </div>

          {/* Central Profile & Status Presentation */}
          <div className="flex flex-col items-center z-10">
            <div className="relative mb-6">
              <div
                className={`absolute -inset-4 rounded-full bg-violet-600/15 blur-xl transition-all duration-700 ${
                  callState === "dialing" || callState === "receiving" ? "scale-125 opacity-100 animate-pulse" : "opacity-40"
                }`}
              ></div>
              <img
                src={callPartner.avatar_url}
                alt={callPartner.username}
                className={`w-32 h-32 rounded-full object-cover border-2 border-violet-500/40 bg-slate-900 shadow-2xl relative z-10 ${
                  callState === "dialing" || callState === "receiving"
                    ? "ring-8 ring-violet-500/15 animate-pulse"
                    : ""
                }`}
              />
              {callType === "video" && (
                <div className="absolute bottom-1 right-1 bg-emerald-500 p-2 rounded-full border-2 border-slate-950 z-20 shadow">
                  <Video className="w-4 h-4 text-white" />
                </div>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2 tracking-tight">{callPartner.username}</h2>

            {/* Status indicators */}
            {callState === "dialing" && (
              <p className="text-sm text-violet-400 flex items-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Calling...</span>
              </p>
            )}

            {callState === "receiving" && (
              <p className="text-sm text-violet-400 font-semibold animate-bounce flex items-center gap-1.5">
                <span>Incoming {callType} call</span>
              </p>
            )}

            {callState === "active" && (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <span className="text-xs px-2.5 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded-full font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>Connected</span>
                </span>
                <p className="text-lg font-mono font-semibold tracking-wider text-slate-300 mt-1">
                  {formatCallTime(seconds)}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons Panel */}
          <div className="flex items-center gap-6 z-10">
            {/* Outgoing Dialing Actions */}
            {callState === "dialing" && (
              <button
                onClick={handleHangUp}
                title="Cancel Call"
                className="w-16 h-16 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
            )}

            {/* Incoming Call Actions */}
            {callState === "receiving" && (
              <>
                <button
                  onClick={handleDecline}
                  title="Decline"
                  className="w-16 h-16 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <button
                  onClick={handleAccept}
                  title="Answer"
                  className="w-16 h-16 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform animate-bounce"
                >
                  <Phone className="w-7 h-7 text-white" />
                </button>
              </>
            )}

            {/* Active Voice Call Controls */}
            {callState === "active" && (
              <>
                <button
                  onClick={handleToggleMic}
                  title={micMuted ? "Unmute Mic" : "Mute Mic"}
                  className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-lg ${
                    micMuted
                      ? "bg-red-500/20 border-red-500/50 text-red-400"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                  onClick={handleHangUp}
                  title="End Call"
                  className="w-16 h-16 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-transform"
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallScreen;
