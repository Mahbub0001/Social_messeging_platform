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

  private iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
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

    // Capture local media early to ensure permissions and availability
    const constraints = {
      audio: true,
      video: type === "video" ? { width: 640, height: 480, facingMode: "user" } : false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      useStore.setState({ localStream: this.localStream });
    } catch (err) {
      console.warn("Failed to acquire local video media, trying audio only:", err);
      if (type === "video") {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          useStore.setState({ localStream: this.localStream });
          alert("Webcam not found or camera access denied. Continuing with voice call only.");
          useStore.setState({ callType: "voice" });
        } catch (audioErr) {
          console.error("Failed to acquire even audio media stream:", audioErr);
          this.endCall();
          alert("Could not start call: Microphone access denied.");
          return;
        }
      } else {
        console.error("Failed to acquire audio media stream:", err);
        this.endCall();
        alert("Could not start call: Microphone access denied.");
        return;
      }
    }

    // Listen on the session signaling channel
    this.joinSessionChannel(this.callId);

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
            callType: type,
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

    const callType = useStore.getState().callType;
    const constraints = {
      audio: true,
      video: callType === "video" ? { width: 640, height: 480, facingMode: "user" } : false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      useStore.setState({ localStream: this.localStream });
    } catch (err) {
      console.warn("Failed to acquire stream on accept, trying audio only:", err);
      if (callType === "video") {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          useStore.setState({ localStream: this.localStream });
          alert("Webcam not found or camera access denied. Connecting as voice call.");
          useStore.setState({ callType: "voice" });
        } catch (audioErr) {
          console.error("Failed to acquire audio on accept:", audioErr);
          this.rejectCall();
          alert("Could not answer call: Microphone access denied.");
          return;
        }
      } else {
        console.error("Failed to acquire audio on accept:", err);
        this.rejectCall();
        alert("Could not answer call: Microphone access denied.");
        return;
      }
    }

    // Broadcast acceptance
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

    // Listen on session signaling channel
    this.joinSessionChannel(this.callId);

    // Setup peer connection
    this.setupPeerConnection();

    // Transition local state
    useStore.setState({ callState: "active" });
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

  private joinSessionChannel(callId: string) {
    if (this.sessionChannel) {
      supabase.removeChannel(this.sessionChannel);
    }

    this.sessionChannel = supabase.channel(`call-session:${callId}`);
    this.sessionChannel
      .on("broadcast", { event: "signal" }, (payload: any) => this.handleSignalingMessage(payload.payload))
      .subscribe();
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
        await this.peerConnection.setRemoteDescription(desc);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.sendSignalingMessage({ sdp: answer });
      } else if (desc.type === "answer") {
        await this.peerConnection.setRemoteDescription(desc);
      }
    } else if (payload.candidate) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error("Error adding ice candidate:", err);
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
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        useStore.setState({ remoteStream: this.remoteStream });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === "disconnected" || state === "failed" || state === "closed") {
        this.endCall();
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

