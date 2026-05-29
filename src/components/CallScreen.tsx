import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../hooks/useStore";
import { audioSynthesizer } from "../utils/audio";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Camera, Loader2 } from "lucide-react";
import { isMockMode } from "../lib/supabase";

export const CallScreen: React.FC = () => {
  const { callState, callType, callPartner, acceptCall, endCall, localStream, remoteStream } = useStore();
  const [seconds, setSeconds] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const timerRef = useRef<number | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Bind WebRTC streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, camMuted]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // 1. Audio and Call Transitions Handler
  useEffect(() => {
    if (callState === "dialing") {
      audioSynthesizer.startDialingTone();

      let timeout: any = null;
      if (isMockMode) {
        // Mock Bot Auto-Answer
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
      audioSynthesizer.startIncomingRingtone();
      return () => {
        audioSynthesizer.stopRingtone();
      };
    } else if (callState === "active") {
      // Start call timer
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
  }, [callState, acceptCall]);

  const handleDecline = () => {
    audioSynthesizer.playDisconnectChime();
    endCall();
  };

  const handleAccept = () => {
    audioSynthesizer.stopRingtone();
    audioSynthesizer.playConnectChime();
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

  const formatCallTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (callState === "idle" || !callPartner) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-md select-none text-white font-sans">
      {/* Decorative calling wave rings */}
      <div className="absolute w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-2xl pointer-events-none animate-pulse"></div>

      {/* Profile display */}
      <div className="flex flex-col items-center mb-10 z-10">
        <div className="relative mb-6">
          <img
            src={callPartner.avatar_url}
            alt={callPartner.username}
            className={`w-28 h-28 rounded-full object-cover border-2 border-violet-500/40 bg-slate-900 shadow-xl ${
              callState === "dialing" || callState === "receiving"
                ? "animate-pulse ring-8 ring-violet-500/10"
                : ""
            }`}
          />
          {callType === "video" && callState === "active" && (
            <div className="absolute bottom-1 right-1 bg-emerald-500 p-1.5 rounded-full border border-slate-950">
              <Video className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold mb-2">{callPartner.username}</h2>
        
        {/* Status text or timer */}
        {callState === "dialing" && (
          <p className="text-sm text-violet-400 flex items-center gap-1.5 font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Calling...</span>
          </p>
        )}
        {callState === "receiving" && (
          <p className="text-sm text-violet-400 font-semibold animate-bounce">
            Incoming {callType} call
          </p>
        )}
        {callState === "active" && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
              Connected
            </span>
            <p className="text-md font-semibold tracking-wider text-slate-300 font-mono mt-1">
              {formatCallTime(seconds)}
            </p>
          </div>
        )}
      </div>

      {/* Real WebRTC video containers */}
      {!isMockMode && callState === "active" && (
        <div className="relative w-full max-w-xs sm:max-w-lg aspect-[3/4] sm:aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-8 shadow-2xl flex items-center justify-center">
          {/* Remote Video / Audio Feed */}
          {callType === "video" ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full bg-violet-600/10 flex items-center justify-center border border-violet-500/20 animate-pulse">
                <Mic className="w-8 h-8 text-violet-400" />
              </div>
              <span className="text-xs text-slate-400">Voice call active</span>
            </div>
          )}

          {/* Hidden Remote Audio Stream Player for Voice Calls */}
          {callType === "voice" && (
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden w-0 h-0" />
          )}

          {/* Local PIP Video overlay */}
          {callType === "video" && (
            <div className="absolute bottom-3 right-3 w-20 sm:w-32 aspect-[3/4] sm:aspect-video bg-slate-950 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg z-20 flex items-center justify-center">
              {camMuted ? (
                <div className="text-slate-500 text-[10px] flex flex-col items-center">
                  <VideoOff className="w-4 h-4 mb-0.5" />
                  <span>Cam Muted</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Simulated camera screen overlay for Video Calls in Mock Mode */}
      {isMockMode && callType === "video" && callState === "active" && (
        <div className="w-full max-w-xs sm:w-72 h-80 sm:h-44 bg-slate-900 border border-slate-800 rounded-2xl relative overflow-hidden mb-8 shadow-inner flex items-center justify-center">
          {camMuted ? (
            <div className="text-slate-500 flex flex-col items-center gap-1">
              <VideoOff className="w-6 h-6" />
              <span className="text-[10px]">Camera Muted</span>
            </div>
          ) : (
            <>
              {/* Simulated camera feed layout */}
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 to-indigo-950/40 animate-pulse"></div>
              <Camera className="w-8 h-8 text-slate-700 opacity-20" />
              <span className="absolute top-2 left-2 text-[8px] bg-slate-950/60 px-1.5 py-0.5 rounded font-mono">
                LOCAL FEED
              </span>
            </>
          )}
        </div>
      )}

      {/* Action Buttons Panel */}
      <div className="flex items-center gap-6 z-10">
        {/* Outgoing Dialing Actions */}
        {callState === "dialing" && (
          <button
            onClick={handleHangUp}
            className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Incoming Call Actions */}
        {callState === "receiving" && (
          <>
            <button
              onClick={handleDecline}
              className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={handleAccept}
              className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform animate-bounce"
            >
              <Phone className="w-6 h-6 text-white" />
            </button>
          </>
        )}

        {/* Active Call Controls */}
        {callState === "active" && (
          <>
            {/* Mute Mic */}
            <button
              onClick={handleToggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                micMuted
                  ? "bg-slate-800 border-slate-750 text-red-400"
                  : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900"
              }`}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Hang Up */}
            <button
              onClick={handleHangUp}
              className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>

            {/* Mute Camera (Only for Video calls) */}
            {callType === "video" && (
              <button
                onClick={handleToggleCam}
                className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                  camMuted
                    ? "bg-slate-800 border-slate-750 text-red-400"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900"
                }`}
              >
                {camMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CallScreen;

