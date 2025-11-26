import { wsClient } from './websocket';

export class WebRTCManager {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStream: ((username: string, stream: MediaStream) => void) | null = null;
  private username: string = '';
  private roomId: string = '';

  async initialize(username: string, roomId: string, existingStream?: MediaStream) {
    this.username = username;
    this.roomId = roomId;

    if (existingStream) {
      this.localStream = existingStream;
      console.log('WebRTC: Using provided stream for', username);
    } else {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('WebRTC: Local stream acquired for', username);
      } catch (error) {
        console.warn('WebRTC: Microphone access denied:', error);
      }
    }
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    console.log('WebRTC: Local stream set');
  }

  setOnRemoteStream(callback: (username: string, stream: MediaStream) => void) {
    this.onRemoteStream = callback;
  }

  async createPeerConnection(remoteUsername: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(remoteUsername)) {
      return this.peerConnections.get(remoteUsername)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun1.l.google.com:19302'] },
      ],
    });

    if (this.localStream) {
      const trackCount = this.localStream.getTracks().length;
      console.log('WebRTC: Adding', trackCount, 'local tracks to peer connection with', remoteUsername);
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    } else {
      console.warn('WebRTC: No local stream available when creating peer connection with', remoteUsername);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send({
          type: 'rtc_ice_candidate',
          payload: {
            roomId: this.roomId,
            username: this.username,
            candidate: event.candidate,
            targetUser: remoteUsername,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      if (this.onRemoteStream) {
        this.onRemoteStream(remoteUsername, event.streams[0]);
      }
    };

    this.peerConnections.set(remoteUsername, pc);
    return pc;
  }

  async handleOffer(remoteUsername: string, offer: RTCSessionDescriptionInit) {
    try {
      const pc = await this.createPeerConnection(remoteUsername);
      if (pc.signalingState !== 'stable') {
        console.log('WebRTC: Ignoring offer, signalingState is', pc.signalingState);
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsClient.send({
        type: 'rtc_answer',
        payload: {
          roomId: this.roomId,
          username: this.username,
          answer: pc.localDescription,
          targetUser: remoteUsername,
        },
      });
    } catch (error) {
      console.error('WebRTC: Error handling offer:', error);
    }
  }

  async handleAnswer(remoteUsername: string, answer: RTCSessionDescriptionInit) {
    try {
      const pc = this.peerConnections.get(remoteUsername);
      if (!pc) {
        console.warn('WebRTC: No peer connection found for', remoteUsername);
        return;
      }
      if (pc.signalingState !== 'have-local-offer') {
        console.log('WebRTC: Ignoring answer, signalingState is', pc.signalingState, 'expected have-local-offer');
        return;
      }
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('WebRTC: Error handling answer:', error);
    }
  }

  async handleIceCandidate(remoteUsername: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(remoteUsername);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('Error adding ice candidate:', error);
      }
    }
  }

  async initiateCall(remoteUsername: string) {
    console.log('WebRTC: Initiating call to', remoteUsername, 'from', this.username);
    const pc = await this.createPeerConnection(remoteUsername);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log('WebRTC: Sending offer to', remoteUsername);
    wsClient.send({
      type: 'rtc_offer',
      payload: {
        roomId: this.roomId,
        username: this.username,
        offer: pc.localDescription,
        targetUser: remoteUsername,
      },
    });
  }

  closePeerConnection(remoteUsername: string) {
    const pc = this.peerConnections.get(remoteUsername);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteUsername);
    }
  }

  closeAll() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async addTrack(remoteUsername: string, track: MediaStreamTrack, stream: MediaStream) {
    const pc = this.peerConnections.get(remoteUsername);
    if (pc) {
      try {
        const sender = await pc.addTrack(track, stream);
        console.log('WebRTC: Added track to peer connection with', remoteUsername);
      } catch (error) {
        console.error('Error adding track:', error);
      }
    }
  }

  removeTrack(remoteUsername: string, track: MediaStreamTrack) {
    const pc = this.peerConnections.get(remoteUsername);
    if (pc) {
      try {
        const senders = pc.getSenders();
        const sender = senders.find(s => s.track === track);
        if (sender) {
          pc.removeTrack(sender);
          console.log('WebRTC: Removed track from peer connection with', remoteUsername);
        }
      } catch (error) {
        console.error('Error removing track:', error);
      }
    }
  }
}

export const webrtcManager = new WebRTCManager();
