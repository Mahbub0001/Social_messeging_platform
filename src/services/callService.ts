import { supabase, isMockMode } from "../lib/supabase";
import { useStore } from "../hooks/useStore";
import { audioSynthesizer } from "../utils/audio";
import type { Profile } from "./mockDb";

class CallServiceClass {
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private userChannel: any = null;
  private sessionChannel: any = null;
  private callId: string | null = null;
  private partnerId: string | null = null;

  // Logging & metadata tracking
  private conversationId: string | null = null;
  private receiverName: string | null = null;
  private callConnectedTime: number | null = null;
  private hasLoggedCurrentCall = false;

  private pendingIceCandidates: any[] = [];

  private iceServers = [
    // STUN servers — help discover public IP
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },

    // TURN relay servers — required on mobile networks (CGNAT/carrier NAT)
    // Without TURN, audio & video never flow when both peers are on cellular
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:80?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];

  // Initialize listening channel for incoming calls
  public init(userId: string) {
    if (isMockMode) return;

    if (this.userChannel) {
      supabase.removeChannel(this.userChannel);
    }

    this.userChannel = supabase.channel(`user-calls:${userId}`);
    this.userChannel
      .on("broadcast", { event: "invite" }, (payload: any) => this.handleInvite(payload.payload))
      .on("broadcast", { event: "cancel" }, (payload: any) => this.handleCancel(payload.payload))
      .on("broadcast", { event: "reject" }, (payload: any) => this.handleReject(payload.payload))
      .on("broadcast", { event: "accept" }, (payload: any) => this.handleAcceptNotification(payload.payload))
      .subscribe();
  }

  public cleanup() {
    if (this.userChannel) {
      supabase.removeChannel(this.userChannel);
      this.userChannel = null;
    }
    this.endCall();
  }

  private async acquireLocalStream(type: "voice" | "video"): Promise<MediaStream> {
    if (type === "video") {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });
      } catch (err1) {
        console.warn("[WebRTC] Preferred video constraints failed, trying basic video constraints:", err1);
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch (err2) {
          console.warn("[WebRTC] Camera unavailable, falling back to voice only:", err2);
          useStore.setState({ callType: "voice" });
          return await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
        }
      }
    } else {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    }
  }

  public async startCall(partner: Profile, type: "voice" | "video", conversationId?: string) {
    const myUser = useStore.getState().user;
    if (!myUser) return;

    this.callId = `call-${Math.random().toString(36).substr(2, 9)}`;
    this.partnerId = partner.id;
    this.receiverName = partner.username;
    this.conversationId = conversationId || null;
    this.callConnectedTime = null;
    this.hasLoggedCurrentCall = false;

    // Set local store state
    useStore.setState({
      callState: "dialing",
      callType: type,
      callPartner: partner,
    });

    if (isMockMode) {
      return;
    }

    try {
      this.localStream = await this.acquireLocalStream(type);
      useStore.setState({ localStream: this.localStream });
    } catch (err) {
      console.error("[WebRTC] Failed to acquire media stream:", err);
      this.endCall();
      alert("Could not start call: Microphone/Camera access denied.");
      return;
    }

    // Ensure we are fully subscribed to session channel before sending invitation
    await this.joinSessionChannel(this.callId);

    // Broadcast invitation
    const callerProfile = {
      id: myUser.id,
      username: myUser.user_metadata?.username || myUser.email.split("@")[0],
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${myUser.id}`,
    };

    const channel = supabase.channel(`user-calls:${partner.id}`);
    channel.subscribe((status: any) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "invite",
          payload: {
            callId: this.callId,
            callerId: myUser.id,
            callerProfile,
            callType: useStore.getState().callType || type,
          },
        });
        setTimeout(() => supabase.removeChannel(channel), 1000);
      }
    });
  }

  private handleInvite(payload: { callId: string; callerId: string; callerProfile: Profile; callType: "voice" | "video" }) {
    const currentCallState = useStore.getState().callState;
    if (currentCallState !== "idle") {
      // Send rejection immediately if busy
      const channel = supabase.channel(`user-calls:${payload.callerId}`);
      channel.subscribe((status: any) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "reject",
            payload: { callId: payload.callId, reason: "busy" },
          });
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });
      return;
    }

    this.callId = payload.callId;
    this.partnerId = payload.callerId;

    useStore.setState({
      callState: "receiving",
      callType: payload.callType,
      callPartner: payload.callerProfile,
    });
  }

  public async acceptCall() {
    const myUser = useStore.getState().user;
    if (!myUser || !this.callId || !this.partnerId) return;

    if (isMockMode) {
      this.callConnectedTime = Date.now();
      useStore.setState({ callState: "active" });
      return;
    }

    const callType = useStore.getState().callType || "voice";

    try {
      this.localStream = await this.acquireLocalStream(callType);
      useStore.setState({ localStream: this.localStream });
    } catch (err) {
      console.error("[WebRTC] Failed to acquire stream on accept:", err);
      this.rejectCall();
      alert("Could not answer call: Microphone/Camera access denied.");
      return;
    }

    // 1. Ensure we are subscribed to the session signaling channel first!
    await this.joinSessionChannel(this.callId);

    // 2. Setup local peer connection
    await this.setupPeerConnection();

    // 3. Transition local state
    useStore.setState({ callState: "active" });

    // 4. ONLY THEN broadcast acceptance so Caller's offer is received reliably
    const channel = supabase.channel(`user-calls:${this.partnerId}`);
    channel.subscribe((status: any) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "accept",
          payload: { callId: this.callId },
        });
        setTimeout(() => supabase.removeChannel(channel), 1000);
      }
    });
  }

  public rejectCall() {
    if (!this.callId || !this.partnerId) return;

    if (!isMockMode) {
      const channel = supabase.channel(`user-calls:${this.partnerId}`);
      channel.subscribe((status: any) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "reject",
            payload: { callId: this.callId, reason: "declined" },
          });
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });
    }

    this.resetCallState();
  }

  public cancelCall() {
    if (!this.callId || !this.partnerId) return;

    if (!isMockMode) {
      const channel = supabase.channel(`user-calls:${this.partnerId}`);
      channel.subscribe((status: any) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "cancel",
            payload: { callId: this.callId },
          });
          setTimeout(() => supabase.removeChannel(channel), 1000);
        }
      });
    }

    this.createCallLog("missed");
    this.resetCallState();
  }

  private handleCancel(payload: { callId: string }) {
    if (payload.callId === this.callId) {
      audioSynthesizer.playDisconnectChime();
      this.resetCallState();
    }
  }

  private handleReject(payload: { callId: string; reason: string }) {
    if (payload.callId === this.callId) {
      audioSynthesizer.playDisconnectChime();
      this.createCallLog("declined");
      this.resetCallState();
      if (payload.reason === "busy") {
        alert("The user is busy on another call.");
      }
    }
  }

  private async handleAcceptNotification(payload: { callId: string }) {
    if (payload.callId !== this.callId) return;

    audioSynthesizer.stopRingtone();
    audioSynthesizer.playConnectChime();

    useStore.setState({ callState: "active" });
    this.callConnectedTime = Date.now();

    // Setup peer connection
    await this.setupPeerConnection();

    // Create and send SDP Offer
    await this.createOffer();
  }

  private joinSessionChannel(callId: string): Promise<void> {
    if (this.sessionChannel) {
      supabase.removeChannel(this.sessionChannel);
      this.sessionChannel = null;
    }

    return new Promise((resolve) => {
      this.sessionChannel = supabase.channel(`call-session:${callId}`);
      this.sessionChannel
        .on("broadcast", { event: "signal" }, (payload: any) => this.handleSignalingMessage(payload.payload))
        .subscribe((status: string) => {
          console.log(`[WebRTC] Session channel ${callId} status: ${status}`);
          if (status === "SUBSCRIBED") {
            resolve();
          }
        });

      // Safety timeout so call setup never hangs if subscription event is slightly delayed
      setTimeout(() => resolve(), 2000);
    });
  }

  private sendSignalingMessage(payload: any) {
    if (!this.sessionChannel) return;

    const myUser = useStore.getState().user;
    if (!myUser) return;

    this.sessionChannel.send({
      type: "broadcast",
      event: "signal",
      payload: {
        senderId: myUser.id,
        ...payload,
      },
    });
  }

  private async handleSignalingMessage(payload: { senderId: string; sdp?: any; candidate?: any; end?: boolean }) {
    const myUser = useStore.getState().user;
    if (!myUser || payload.senderId === myUser.id) return;

    if (payload.end) {
      audioSynthesizer.playDisconnectChime();
      this.createCallLog("completed");
      this.resetCallState();
      return;
    }

    if (!this.peerConnection) return;

    if (payload.sdp) {
      const desc = new RTCSessionDescription(payload.sdp);
      if (desc.type === "offer") {
        if (this.peerConnection.signalingState !== "stable") {
          console.warn("[WebRTC] Received offer in non-stable state:", this.peerConnection.signalingState);
          if (this.peerConnection.signalingState === "have-remote-offer") {
            return;
          }
        }
        await this.peerConnection.setRemoteDescription(desc);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.sendSignalingMessage({ sdp: answer });
        await this.processPendingCandidates();
      } else if (desc.type === "answer") {
        if (this.peerConnection.signalingState === "have-local-offer") {
          await this.peerConnection.setRemoteDescription(desc);
          await this.processPendingCandidates();
        }
      }
    } else if (payload.candidate) {
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (err) {
          console.error("[WebRTC] Error adding ice candidate:", err);
        }
      } else {
        this.pendingIceCandidates.push(payload.candidate);
      }
    }
  }

  private async processPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("[WebRTC] Error applying buffered ice candidate:", err);
        }
      }
    }
  }

  private async setupPeerConnection() {
    if (this.peerConnection) return;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({ candidate: event.candidate });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log("[WebRTC] ontrack received:", event.track.kind, event.streams);
      let stream = this.remoteStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        if (!stream) {
          stream = new MediaStream();
        }
        stream.addTrack(event.track);
      }
      this.remoteStream = stream;
      useStore.setState({ remoteStream: stream });
    };

    this.peerConnection.onicecandidateerror = (event) => {
      console.warn("[WebRTC] ICE candidate error:", event);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log("[WebRTC] ICE connection state:", iceState);
      if (iceState === "failed") {
        // Attempt ICE restart before giving up
        console.warn("[WebRTC] ICE failed — attempting ICE restart");
        this.peerConnection?.restartIce();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log("[WebRTC] Connection state changed:", state);
      if (state === "failed" || state === "closed") {
        this.endCall();
      } else if (state === "disconnected") {
        // Temporary disconnect (e.g. network blip) — wait 5 seconds before ending
        console.warn("[WebRTC] Connection temporarily disconnected, waiting before ending call...");
        setTimeout(() => {
          const currentState = this.peerConnection?.connectionState;
          if (currentState === "disconnected" || currentState === "failed" || currentState === "closed") {
            console.warn("[WebRTC] Connection did not recover, ending call");
            this.endCall();
          }
        }, 5000);
      }
    };

    // Add local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }
  }

  private async createOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.sendSignalingMessage({ sdp: offer });

      // Offer retry loop: if peer hasn't answered yet, re-send offer up to 4 times
      let retries = 0;
      const retryInterval = setInterval(() => {
        if (!this.peerConnection || this.peerConnection.signalingState !== "have-local-offer" || retries >= 4) {
          clearInterval(retryInterval);
          return;
        }
        retries++;
        console.log(`[WebRTC] Re-broadcasting offer attempt ${retries}...`);
        this.sendSignalingMessage({ sdp: offer });
      }, 1500);
    } catch (err) {
      console.error("Failed to create offer:", err);
    }
  }

  public endCall() {
    if (isMockMode) {
      this.createCallLog("completed");
      this.resetCallState();
      return;
    }

    if (this.sessionChannel) {
      this.sendSignalingMessage({ end: true });
    }

    this.createCallLog("completed");
    this.resetCallState();
  }

  private async createCallLog(status: "completed" | "missed" | "declined") {
    if (this.hasLoggedCurrentCall || !this.callId || !this.partnerId) return;
    this.hasLoggedCurrentCall = true;

    const myUser = useStore.getState().user;
    if (!myUser) return;

    let duration = 0;
    if (status === "completed" && this.callConnectedTime) {
      duration = Math.floor((Date.now() - this.callConnectedTime) / 1000);
    }

    const payload = {
      callType: useStore.getState().callType || "voice",
      status,
      duration,
      callerId: myUser.id,
      callerName: myUser.user_metadata?.username || myUser.email.split("@")[0],
      receiverId: this.partnerId,
      receiverName: this.receiverName || "User",
    };

    let conversationId = this.conversationId;
    if (!conversationId) {
      // Find direct conversation in local store
      const conversations = useStore.getState().conversations;
      const directConv = conversations.find(
        (c) =>
          c.is_group === false &&
          c.members &&
          c.members.some((m: any) => m.id === this.partnerId)
      );
      if (directConv) {
        conversationId = directConv.id;
      } else {
        // Fallback: create direct conversation
        try {
          const { chatService } = await import("./chatService");
          const { data } = await chatService.createConversation([myUser.id, this.partnerId], null, false);
          if (data) {
            conversationId = data.id;
          }
        } catch (e) {
          console.error("Failed to auto-create conversation for call log:", e);
        }
      }
    }

    if (conversationId) {
      try {
        const { chatService } = await import("./chatService");
        await chatService.sendMessage(
          conversationId,
          myUser.id,
          JSON.stringify(payload),
          null,
          null
        );
      } catch (err) {
        console.error("Failed to save call log message:", err);
      }
    }
  }

  private resetCallState() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.remoteStream = null;
    this.pendingIceCandidates = [];

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.sessionChannel) {
      supabase.removeChannel(this.sessionChannel);
      this.sessionChannel = null;
    }

    this.callId = null;
    this.partnerId = null;
    this.conversationId = null;
    this.receiverName = null;
    this.callConnectedTime = null;
    this.hasLoggedCurrentCall = false;

    useStore.setState({
      callState: "idle",
      callType: null,
      callPartner: null,
      localStream: null,
      remoteStream: null,
    });
  }

  public toggleMic(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public toggleCam(muted: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }
}

export const callService = new CallServiceClass();
export default callService;

