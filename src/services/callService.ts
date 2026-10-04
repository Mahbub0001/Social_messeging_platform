import { supabase, isMockMode } from "../lib/supabase";
import { useStore } from "../hooks/useStore";
import { audioSynthesizer } from "../utils/audio";
import { pushNotificationService } from "./pushNotificationService";
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
  private hasCreatedAnswer = false;
  private currentFacingMode: "user" | "environment" = "user";

  private pendingIceCandidates: any[] = [];

  private iceServers: RTCIceServer[] = [
    // Fast & highly reliable public STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
    // Global free TURN relay servers (OpenRelay by Metered) to traverse symmetric NAT / 4G / 5G / cellular CGNAT
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:80?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turns:standard.relay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];

  // Initialize listening channel for incoming calls
  public init(userId: string) {
    // Native bridge listener for incoming calls handled from Android notification / lock screen
    (window as any).handleIncomingCallAction = (
      action: "show" | "answer" | "decline",
      callId: string,
      callerId: string,
      callerName: string,
      callType: "voice" | "video",
      callerAvatar?: string
    ) => {
      console.log("[CallService] Received native call action:", action, callId, callerName);
      if (!callId) return;

      if (action === "decline") {
        this.callId = callId;
        this.partnerId = callerId;
        this.rejectCall();
        return;
      }

      const callerProfile: Profile = {
        id: callerId,
        username: callerName || "User",
        avatar_url: callerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerId}`,
        full_name: callerName || "User",
      } as any;

      this.callId = callId;
      this.partnerId = callerId;

      useStore.setState({
        callState: "receiving",
        callType: callType || "voice",
        callPartner: callerProfile,
      });

      if (action === "answer") {
        setTimeout(() => {
          this.acceptCall();
        }, 300);
      }
    };

    // Check if there is a pending call from Android cold launch
    if (typeof (window as any).KBNativeBridge?.getPendingCallData === "function") {
      try {
        const pendingCallJson = (window as any).KBNativeBridge.getPendingCallData();
        if (pendingCallJson) {
          const data = JSON.parse(pendingCallJson);
          if (data && data.callId) {
            console.log("[CallService] Processing cold launch call data:", data);
            (window as any).handleIncomingCallAction(
              data.action || "show",
              data.callId,
              data.callerId,
              data.callerName,
              data.callType || "voice",
              data.callerAvatar
            );
          }
        }
      } catch (err) {
        console.warn("[CallService] Error checking pending call data:", err);
      }
    }

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
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    if (type === "video") {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: {
            facingMode: this.currentFacingMode,
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          },
        });
      } catch (err1) {
        console.warn("[WebRTC] Preferred HD video constraints failed, trying basic facingMode:", err1);
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: { facingMode: this.currentFacingMode },
          });
        } catch (err2) {
          console.warn("[WebRTC] FacingMode video failed, trying video: true:", err2);
          try {
            return await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: true,
            });
          } catch (err3) {
            console.warn("[WebRTC] Camera completely unavailable, falling back to voice only:", err3);
            useStore.setState({ callType: "voice" });
            return await this.acquireLocalStream("voice");
          }
        }
      }
    } else {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (err) {
        console.warn("[WebRTC] Enhanced audio constraints failed, trying basic audio:", err);
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
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

    const partnerConv = useStore.getState().conversations.find(
      (c) => !c.is_group && c.members?.some((m) => m.id === partner.id)
    );

    // Send high-priority FCM call push notification to wake up device / screen if sleeping or app closed
    pushNotificationService.sendCallPush({
      callId: this.callId,
      callerId: myUser.id,
      callerName: myUser.user_metadata?.username || myUser.email.split("@")[0],
      callerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${myUser.id}`,
      callType: useStore.getState().callType || type,
      receiverId: partner.id,
      conversationId: partnerConv?.id,
    }).catch((err) => {
      console.warn("[CallService] Error sending call push notification:", err);
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

      // Send push notification to cancel incoming call notification on receiver's phone
      pushNotificationService.sendCallCancelledPush({
        callId: this.callId,
        receiverId: this.partnerId,
        conversationId: this.conversationId || undefined,
      }).catch((err) => {
        console.warn("[CallService] Error sending call cancel push notification:", err);
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
    if (!this.sessionChannel) {
      console.warn("[WebRTC] Cannot send signaling message: sessionChannel is null");
      return;
    }

    const myUser = useStore.getState().user;
    if (!myUser) return;

    this.sessionChannel
      .send({
        type: "broadcast",
        event: "signal",
        payload: {
          senderId: myUser.id,
          ...payload,
        },
      })
      .then((res: any) => {
        if (res !== "ok") {
          console.warn("[WebRTC] Signaling broadcast non-ok status:", res);
        }
      })
      .catch((err: any) => {
        console.error("[WebRTC] Failed to broadcast signal:", err);
      });
  }

  private optimizeSdp(sdp: string): string {
    // Enable FEC (forward error correction) on Opus for crystal-clear voice even under cellular packet loss
    if (sdp.includes("opus/48000")) {
      return sdp.replace(
        /(a=fmtp:\d+ .*)/g,
        (line) => line.includes("useinbandfec=1") ? line : `${line};useinbandfec=1;maxaveragebitrate=64000`
      );
    }
    return sdp;
  }

  private async handleSignalingMessage(payload: { senderId: string; sdp?: any; candidate?: any; end?: boolean }) {
    const myUser = useStore.getState().user;
    if (!myUser || payload.senderId === myUser.id) return;

    if (payload.end) {
      console.log("[WebRTC] Call ended by remote peer");
      audioSynthesizer.playDisconnectChime();
      this.createCallLog("completed");
      this.resetCallState();
      return;
    }

    if (payload.sdp) {
      console.log(`[WebRTC] Received SDP ${payload.sdp.type}`);
      const desc = new RTCSessionDescription(payload.sdp);
      if (desc.type === "offer") {
        if (!this.peerConnection) {
          await this.setupPeerConnection();
        }
        if (this.peerConnection?.signalingState === "have-remote-offer") {
          return;
        }
        if (this.peerConnection?.signalingState === "stable" && this.hasCreatedAnswer) {
          console.log("[WebRTC] Duplicate offer received after answer was created; resending existing answer.");
          if (this.peerConnection.localDescription) {
            this.sendSignalingMessage({ sdp: this.peerConnection.localDescription });
          }
          return;
        }
        await this.peerConnection!.setRemoteDescription(desc);
        const answer = await this.peerConnection!.createAnswer();
        if (answer.sdp) {
          answer.sdp = this.optimizeSdp(answer.sdp);
        }
        await this.peerConnection!.setLocalDescription(answer);
        this.hasCreatedAnswer = true;
        this.sendSignalingMessage({ sdp: answer });
        await this.processPendingCandidates();
      } else if (desc.type === "answer") {
        if (this.peerConnection && this.peerConnection.signalingState === "have-local-offer") {
          await this.peerConnection.setRemoteDescription(desc);
          await this.processPendingCandidates();
        }
      }
    } else if (payload.candidate) {
      if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
        try {
          const cand = new RTCIceCandidate(payload.candidate);
          await this.peerConnection.addIceCandidate(cand);
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
          const cand = new RTCIceCandidate(candidate);
          await this.peerConnection.addIceCandidate(cand);
        } catch (err) {
          console.warn("[WebRTC] Error applying buffered ice candidate:", err);
        }
      }
    }
  }

  private async restartIceConnection() {
    if (!this.peerConnection || this.peerConnection.signalingState !== "stable") return;
    try {
      console.log("[WebRTC] Creating ICE restart offer...");
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      if (offer.sdp) {
        offer.sdp = this.optimizeSdp(offer.sdp);
      }
      await this.peerConnection.setLocalDescription(offer);
      this.sendSignalingMessage({ sdp: offer });
    } catch (err) {
      console.warn("[WebRTC] Failed to restart ICE:", err);
    }
  }

  private disconnectTimer: any = null;

  private async setupPeerConnection() {
    if (this.peerConnection) return;

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateData = event.candidate.toJSON ? event.candidate.toJSON() : {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,
        };
        this.sendSignalingMessage({ candidate: candidateData });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log("[WebRTC] ontrack received:", event.track.kind, event.track.id, event.streams);

      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }

      // Add or update track in this.remoteStream
      const existingTrack = this.remoteStream.getTracks().find((t) => t.id === event.track.id || t.kind === event.track.kind);
      if (existingTrack) {
        this.remoteStream.removeTrack(existingTrack);
      }
      this.remoteStream.addTrack(event.track);

      // Collect all active receiver tracks as well
      const receivers = this.peerConnection?.getReceivers() || [];
      receivers.forEach((r) => {
        if (r.track && r.track.readyState === "live") {
          const has = this.remoteStream?.getTracks().some((t) => t.id === r.track!.id);
          if (!has) {
            this.remoteStream?.addTrack(r.track);
          }
        }
      });

      // When the track un-mutes (network packets start arriving), update store with new stream reference
      event.track.onunmute = () => {
        console.log(`[WebRTC] Remote track unmuted: ${event.track.kind}`);
        if (this.remoteStream) {
          useStore.setState({ remoteStream: new MediaStream(this.remoteStream.getTracks()) });
        }
      };

      // Fresh MediaStream instance ensures Zustand triggers React component re-render
      useStore.setState({ remoteStream: new MediaStream(this.remoteStream.getTracks()) });
    };

    this.peerConnection.onicecandidateerror = (event) => {
      console.warn("[WebRTC] ICE candidate error:", event);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log("[WebRTC] ICE connection state:", iceState);
      if (iceState === "failed") {
        console.warn("[WebRTC] ICE failed — attempting ICE restart");
        this.restartIceConnection();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log("[WebRTC] Connection state changed:", state);

      if (state === "connected") {
        console.log("[WebRTC] Direct peer connection active and established!");
        if (this.disconnectTimer) {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = null;
        }
      } else if (state === "failed") {
        console.warn("[WebRTC] Connection failed, attempting ICE restart...");
        this.restartIceConnection();
        // Do not immediately close the call. Give 35 seconds to recover or let the user hang up
        if (!this.disconnectTimer) {
          this.disconnectTimer = setTimeout(() => {
            const curState = this.peerConnection?.connectionState;
            if (curState === "failed" || curState === "closed") {
              console.warn("[WebRTC] Call disconnected after timeout");
              this.endCall();
            }
          }, 35000);
        }
      } else if (state === "disconnected") {
        console.warn("[WebRTC] Connection temporarily disconnected, waiting before ending...");
        if (!this.disconnectTimer) {
          this.disconnectTimer = setTimeout(() => {
            const curState = this.peerConnection?.connectionState;
            if (curState === "disconnected" || curState === "failed" || curState === "closed") {
              console.warn("[WebRTC] Connection lost, ending call");
              this.endCall();
            }
          }, 25000);
        }
      } else if (state === "closed") {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.endCall();
      }
    };

    // Add local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    const currentCallType = useStore.getState().callType;
    if (currentCallType === "video" && (!this.localStream || !this.localStream.getVideoTracks().length)) {
      try {
        this.peerConnection.addTransceiver("video", { direction: "recvonly" });
      } catch (e) {
        console.warn("[WebRTC] Could not add video recvonly transceiver:", e);
      }
    }
  }

  private async createOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      if (offer.sdp) {
        offer.sdp = this.optimizeSdp(offer.sdp);
      }
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

    if (this.callId && typeof (window as any).KBNativeBridge?.cancelCallNotification === "function") {
      try {
        (window as any).KBNativeBridge.cancelCallNotification(this.callId);
      } catch (ignored) {}
    }

    this.callId = null;
    this.partnerId = null;
    this.conversationId = null;
    this.receiverName = null;
    this.callConnectedTime = null;
    this.hasLoggedCurrentCall = false;
    this.hasCreatedAnswer = false;
    this.currentFacingMode = "user";

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

  public async switchCamera() {
    if (!this.localStream) return;
    const currentVideoTrack = this.localStream.getVideoTracks()[0];
    if (!currentVideoTrack) return;

    this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";

    try {
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: this.currentFacingMode } },
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.currentFacingMode },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // Replace in RTCPeerConnection sender
        if (this.peerConnection) {
          const senders = this.peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }

        // Replace in local stream
        this.localStream.removeTrack(currentVideoTrack);
        currentVideoTrack.stop();
        this.localStream.addTrack(newVideoTrack);

        useStore.setState({ localStream: new MediaStream(this.localStream.getTracks()) });
      }
    } catch (err) {
      console.warn("[WebRTC] Could not switch camera:", err);
      // Revert facingMode tracker on failure
      this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}

export const callService = new CallServiceClass();
export default callService;

