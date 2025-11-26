import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Ghost, Send, Mic, MicOff, Headphones, VolumeX, 
  Monitor, Users, Copy, Check, LogOut, Hash, Settings, Paperclip, X, Smile, User, Zap
} from "lucide-react";
import { wsClient } from "@/lib/websocket";
import { soundEffects } from "@/lib/sounds";
import { webrtcManager } from "@/lib/webrtc";
import type { Message, Participant, WSMessage, UserProfileData } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const AVATAR_EMOJIS = ["👻", "🔮", "🕷️", "💀", "🎃", "👹", "🌙", "⚡", "🔥", "🕯️"];

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [username, setUsername] = useState("");
  const [roomName, setRoomName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionStatus | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileData>({ 
    username: "", 
    avatarEmoji: "👻", 
    bio: "" 
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [roomTheme, setRoomTheme] = useState<"dark" | "purple" | "green" | "red" | "blue">("dark");
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showGhostEquipment, setShowGhostEquipment] = useState(false);
  const [emfLevel, setEmfLevel] = useState(0);
  const [spiritBoxActive, setSpiritBoxActive] = useState(false);
  const [thermalTemp, setThermalTemp] = useState(72);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [selectedVideoUser, setSelectedVideoUser] = useState<string | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    // Load profile from session storage
    const savedProfile = sessionStorage.getItem("userProfile");
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    } else {
      const randomEmoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
      setUserProfile(prev => ({ ...prev, avatarEmoji: randomEmoji }));
    }
  }, []);

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Get audio devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === "audioinput");
        setAudioDevices(audioInputs);

        if (audioInputs.length > 0 && !selectedMicId) {
          setSelectedMicId(audioInputs[0].deviceId);
        }

        // Check permission status
        try {
          const permission = await navigator.permissions.query({ name: "microphone" as PermissionName });
          setMicPermissionStatus(permission);
        } catch (e) {
          // Permissions API might not support microphone on all browsers
          console.warn("Permissions API not available");
        }

        toast({
          title: "Microphone access initialized",
          description: `Found ${audioInputs.length} audio device(s)`,
        });
      } catch (error) {
        console.error("Error during audio initialization:", error);
      }
    };

    initializeAudio();
  }, []);

  useEffect(() => {
    const storedUsername = sessionStorage.getItem("username");
    const storedRoomName = sessionStorage.getItem("roomName");
    
    if (!storedUsername) {
      setLocation("/");
      return;
    }

    setUsername(storedUsername);
    setRoomName(storedRoomName || `Room ${code}`);

    // Acquire microphone stream and initialize WebRTC
    const setupWebRTC = async () => {
      try {
        // Get the microphone stream for voice chat
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setMicActive(true);
        console.log('Microphone stream acquired');

        // Initialize WebRTC with the stream
        await webrtcManager.initialize(storedUsername, code || "", stream);
        console.log('WebRTC initialized for user:', storedUsername);
        webrtcManager.setOnRemoteStream((user, stream) => {
          console.log('Received remote stream from:', user);
          setRemoteStreams(prev => new Map(prev).set(user, stream));
          toast({ description: `Now hearing from ${user}` });
        });
      } catch (error) {
        console.error('Failed to setup WebRTC:', error);
        toast({
          title: "Microphone error",
          description: "Failed to access microphone for voice chat",
          variant: "destructive",
        });
      }
    };

    setupWebRTC();
    wsClient.connect();

    const unsubscribeMessage = wsClient.onMessage(handleWSMessage);
    const unsubscribeConnection = wsClient.onConnectionChange(setIsConnected);

    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
      if (code) {
        wsClient.send({
          type: "leave_room",
          payload: { roomId: code, username: storedUsername },
        });
      }
      // Close all peer connections
      webrtcManager.closeAll();
      // Stop any active media streams
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [code, setLocation]);

  useEffect(() => {
    if (isConnected && code && username) {
      wsClient.send({
        type: "join_room",
        payload: { roomId: code, username },
      });
    }
  }, [isConnected, code, username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleWSMessage = (message: WSMessage) => {
    switch (message.type) {
      case "room_list":
        setMessages(message.payload.messages);
        setParticipants(message.payload.participants);
        if (message.payload.roomName) {
          setRoomName(message.payload.roomName);
        }
        // Initiate calls to all existing participants for voice
        setTimeout(() => {
          message.payload.participants.forEach((p: Participant) => {
            if (p.username !== username) {
              webrtcManager.initiateCall(p.username);
            }
          });
        }, 500);
        break;
      case "chat_message":
        setMessages((prev) => [...prev, message.payload as Message]);
        soundEffects.messageReceived();
        break;
      case "user_joined":
        soundEffects.userJoined();
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            roomId: code || "",
            userId: "system",
            username: "System",
            content: `${message.payload.username} joined the room`,
            timestamp: message.timestamp,
            type: "system",
          },
        ]);
        setParticipants((prev) => [...prev, message.payload.participant]);
        // Initiate call to new participant
        setTimeout(() => {
          webrtcManager.initiateCall(message.payload.username);
        }, 300);
        break;
      case "user_left":
        soundEffects.userLeft();
        // Close peer connection
        webrtcManager.closePeerConnection(message.payload.username);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(message.payload.username);
          return next;
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `system-${Date.now()}`,
            roomId: code || "",
            userId: "system",
            username: "System",
            content: `${message.payload.username} left the room`,
            timestamp: message.timestamp,
            type: "system",
          },
        ]);
        setParticipants((prev) =>
          prev.filter((p) => p.username !== message.payload.username)
        );
        break;
      case "typing_start":
        if (message.payload.username) {
          setTypingUsers((prev) => new Set(prev).add(message.payload.username!));
        }
        break;
      case "typing_stop":
        if (message.payload.username) {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(message.payload.username!);
            return newSet;
          });
        }
        break;
      case "presence_update":
        if (message.payload.username) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.username === message.payload.username
                ? { ...p, ...message.payload.updates }
                : p
            )
          );
        }
        break;
      case "message_reaction":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.payload.messageId
              ? {
                  ...m,
                  reactions: {
                    ...m.reactions,
                    [message.payload.emoji]: [
                      ...(m.reactions?.[message.payload.emoji] || []),
                      message.payload.username,
                    ].filter((v, i, a) => a.indexOf(v) === i),
                  },
                }
              : m
          )
        );
        break;
      case "message_updated":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.payload.id ? { ...message.payload as Message } : m
          )
        );
        break;
      case "message_deleted":
        setMessages((prev) =>
          prev.filter((m) => m.id !== message.payload.messageId)
        );
        break;
      case "room_name_updated":
        setRoomName(message.payload.name);
        break;
      case "room_theme_updated":
        setRoomTheme(message.payload.theme as any);
        break;
      case "rtc_offer":
        webrtcManager.handleOffer(message.payload.username, message.payload.offer).catch((err) => console.error('Error handling RTC offer:', err));
        break;
      case "rtc_answer":
        webrtcManager.handleAnswer(message.payload.username, message.payload.answer).catch((err) => console.error('Error handling RTC answer:', err));
        break;
      case "rtc_ice_candidate":
        webrtcManager.handleIceCandidate(message.payload.username, message.payload.candidate).catch((err) => console.error('Error handling RTC ICE candidate:', err));
        break;
    }
  };

  const handleSendMessage = () => {
    if ((!messageInput.trim() && !selectedFile) || !isConnected) return;

    wsClient.send({
      type: "chat_message",
      payload: {
        roomId: code,
        content: messageInput.trim() || (selectedFile ? `Shared: ${selectedFile.name}` : ""),
        attachment: selectedFile && filePreview ? {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          dataUrl: filePreview,
        } : undefined,
      },
    });

    setMessageInput("");
    setSelectedFile(null);
    setFilePreview("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      wsClient.send({
        type: "typing_stop",
        payload: { roomId: code },
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedFile(file);
      setFilePreview(result);
      toast({
        title: "File selected",
        description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleScreenShare = async () => {
    if (!isConnected) return;

    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => {
            track.stop();
            // Remove screen track from all peer connections
            participants.forEach((p) => {
              if (p.username !== username) {
                webrtcManager.removeTrack(p.username, track);
              }
            });
          });
          screenStreamRef.current = null;
        }
        setIsScreenSharing(false);
        wsClient.send({
          type: "presence_update",
          payload: {
            roomId: code,
            updates: { isScreenSharing: false },
          },
        });
        toast({ description: "Screen sharing stopped" });
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" },
          audio: false,
        });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        
        // Add screen track to all peer connections
        stream.getVideoTracks().forEach(track => {
          participants.forEach((p) => {
            if (p.username !== username) {
              webrtcManager.addTrack(p.username, track, stream);
            }
          });
        });
        
        wsClient.send({
          type: "presence_update",
          payload: {
            roomId: code,
            updates: { isScreenSharing: true },
          },
        });
        toast({ description: "Screen sharing started" });
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          stream.getTracks().forEach(track => {
            participants.forEach((p) => {
              if (p.username !== username) {
                webrtcManager.removeTrack(p.username, track);
              }
            });
          });
          wsClient.send({
            type: "presence_update",
            payload: {
              roomId: code,
              updates: { isScreenSharing: false },
            },
          });
        };
      }
    } catch (error) {
      if ((error as Error).name === "NotAllowedError") {
        toast({
          title: "Permission denied",
          description: "Screen sharing permission was denied",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to start screen sharing",
          variant: "destructive",
        });
      }
    }
  };

  const handleToggleVideo = async () => {
    if (!isConnected) return;

    try {
      if (isVideoOn) {
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(track => track.stop());
          videoStreamRef.current = null;
        }
        setIsVideoOn(false);
        wsClient.send({
          type: "toggle_video",
          payload: { roomId: code, isOn: false },
        });
        toast({ description: "Camera turned off" });
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        videoStreamRef.current = stream;
        setIsVideoOn(true);
        wsClient.send({
          type: "toggle_video",
          payload: { roomId: code, isOn: true },
        });
        toast({ description: "Camera turned on" });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to access camera",
        variant: "destructive",
      });
    }
  };

  const extractMentions = (text: string): string[] => {
    const regex = /@(\w+)/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return [...new Set(matches)];
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingMessageContent(content);
  };

  const handleSaveEdit = (messageId: string) => {
    if (!editingMessageContent.trim()) return;
    wsClient.send({
      type: "edit_message",
      payload: {
        roomId: code || "",
        messageId,
        content: editingMessageContent,
      },
    });
    setEditingMessageId(null);
    setEditingMessageContent("");
  };

  const handleDeleteMessage = (messageId: string) => {
    wsClient.send({
      type: "delete_message",
      payload: {
        roomId: code || "",
        messageId,
      },
    });
  };

  const activateEMFReader = () => {
    const level = Math.random() * 100;
    setEmfLevel(level);
    soundEffects.emfPulse();
    
    const messages = [
      "📊 EMF spike detected! Ghost presence nearby!",
      "📊 High electromagnetic activity... Something's here...",
      "📊 Paranormal energy signature confirmed!",
      "📊 The device is going crazy! RUN!",
    ];
    toast({ description: messages[Math.floor(Math.random() * messages.length)] });
    setTimeout(() => setEmfLevel(0), 2000);
  };

  const activateSpiritBox = () => {
    setSpiritBoxActive(true);
    soundEffects.spiritBoxStatic();
    
    const ghostMessages = [
      "📻 *static crackle* ... HELP US ...",
      "📻 *eerie whispers* ... WHO'S THERE ...",
      "📻 *disturbing noise* ... GET OUT ...",
      "📻 *ghostly voice* ... DON'T STAY ...",
      "📻 *haunting moan* ... BEWARE ...",
    ];
    toast({ description: ghostMessages[Math.floor(Math.random() * ghostMessages.length)] });
    setTimeout(() => setSpiritBoxActive(false), 3000);
  };

  const checkThermal = () => {
    const temp = Math.random() * 40 + 50;
    setThermalTemp(temp);
    
    if (temp < 60) {
      soundEffects.thermalCold();
      toast({ description: `🌡️ EXTREME COLD! ${Math.round(temp)}°F - Supernatural chill detected!` });
    } else if (temp > 85) {
      soundEffects.thermalHot();
      toast({ description: `🌡️ BURNING HOT! ${Math.round(temp)}°F - Poltergeist energy signature!` });
    } else {
      soundEffects.notification();
      toast({ description: `🌡️ Temperature: ${Math.round(temp)}°F - Ghost activity nearby...` });
    }
  };

  const handleInputChange = (value: string) => {
    setMessageInput(value);

    if (value.trim() && isConnected) {
      wsClient.send({
        type: "typing_start",
        payload: { roomId: code },
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        wsClient.send({
          type: "typing_stop",
          payload: { roomId: code },
        });
      }, 2000);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    wsClient.send({
      type: "presence_update",
      payload: { roomId: code, updates: { isMuted: newMuted } },
    });
  };

  const toggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    if (newDeafened) setIsMuted(true);
    wsClient.send({
      type: "presence_update",
      payload: { 
        roomId: code, 
        updates: { isDeafened: newDeafened, isMuted: newDeafened ? true : isMuted } 
      },
    });
  };

  const handleMicDeviceChange = (deviceId: string) => {
    setSelectedMicId(deviceId);
    const device = audioDevices.find((d) => d.deviceId === deviceId);
    if (device) {
      toast({
        title: "Microphone changed",
        description: `Now using: ${device.label || "Unknown device"}`,
      });
    }
  };

  const startVoiceActivityDetection = async () => {
    if (!mediaStreamRef.current) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVoice = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const voiceDetected = average > 30; // Threshold for voice detection

        if (voiceDetected !== isVoiceActive) {
          setIsVoiceActive(voiceDetected);
          if (voiceDetected && isPushToTalk) {
            wsClient.send({
              type: "presence_update",
              payload: { roomId: code, updates: { isVoiceActive: voiceDetected } },
            });
          }
        }

        requestAnimationFrame(checkVoice);
      };

      checkVoice();
    } catch (error) {
      console.warn("Voice activity detection not available:", error);
    }
  };

  useEffect(() => {
    if (micActive && !audioContextRef.current) {
      startVoiceActivityDetection();
    }
  }, [micActive]);

  const copyRoomCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast({
      title: "Room code copied!",
      description: "Share it with your friends to join",
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const leaveRoom = () => {
    webrtcManager.closeAll();
    wsClient.send({
      type: "leave_room",
      payload: { roomId: code, username },
    });
    sessionStorage.clear();
    setLocation("/");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const themeColors = {
    dark: { primary: '275 85% 55%', secondary: '270 6% 18%', accent: '270 8% 16%' },
    purple: { primary: '280 85% 55%', secondary: '270 6% 18%', accent: '270 8% 16%' },
    green: { primary: '140 85% 45%', secondary: '140 20% 20%', accent: '140 30% 25%' },
    red: { primary: '0 85% 45%', secondary: '0 20% 20%', accent: '0 30% 25%' },
    blue: { primary: '200 85% 45%', secondary: '200 20% 20%', accent: '200 30% 25%' },
  };

  const currentTheme = themeColors[roomTheme];
  const themeStyle = {
    '--primary': currentTheme.primary,
    '--primary-foreground': roomTheme === 'dark' || roomTheme === 'purple' ? '275 10% 98%' : roomTheme === 'green' ? '140 10% 98%' : '0 10% 98%' || '200 10% 98%',
    '--secondary': currentTheme.secondary,
    '--accent': currentTheme.accent,
  } as React.CSSProperties;

  return (
    <div className="h-screen flex flex-col bg-background" style={themeStyle}>
      <header className="border-b px-4 py-3 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Ghost className="w-6 h-6 text-primary flex-shrink-0" />
          <div className="flex-1">
            {isEditingRoomName ? (
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onBlur={() => {
                  setIsEditingRoomName(false);
                  wsClient.send({
                    type: "update_room_name",
                    payload: { roomId: code || "", name: roomName },
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingRoomName(false);
                    wsClient.send({
                      type: "update_room_name",
                      payload: { roomId: code || "", name: roomName },
                    });
                  }
                }}
                data-testid="input-room-name"
                className="max-w-xs"
              />
            ) : (
              <h1 
                className="font-semibold text-lg cursor-pointer hover:text-primary" 
                onClick={() => setIsEditingRoomName(true)}
                data-testid="text-room-name"
              >
                {roomName}
              </h1>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="w-3 h-3" />
              <code className="font-mono font-medium" data-testid="text-room-code">{code}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={copyRoomCode}
                data-testid="button-copy-code"
              >
                {copiedCode ? (
                  <Check className="w-3 h-3 text-voice-active" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGhostEquipment(!showGhostEquipment)}
            data-testid="button-ghost-equipment"
            title="Ghost Detection Equipment"
            className="text-orange-500"
          >
            <Zap className="w-4 h-4" />
          </Button>
          <Select value={roomTheme} onValueChange={(value: any) => {
            setRoomTheme(value);
            wsClient.send({
              type: "update_room_theme",
              payload: { roomId: code || "", theme: value },
            });
          }}>
            <SelectTrigger className="w-24" data-testid="select-theme">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="purple">Purple</SelectItem>
              <SelectItem value="green">Green</SelectItem>
              <SelectItem value="red">Red</SelectItem>
              <SelectItem value="blue">Blue</SelectItem>
            </SelectContent>
          </Select>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className="gap-1 hidden sm:flex"
            data-testid="badge-connection-status"
          >
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-voice-active animate-pulse-glow" : "bg-voice-inactive"}`}
            />
            {isConnected ? "Connected" : "Connecting..."}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={leaveRoom}
            data-testid="button-leave-room"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Audio elements for remote streams */}
        {Array.from(remoteStreams.entries()).map(([username, stream]) => (
          <audio
            key={`audio-${username}`}
            autoPlay
            playsInline
            srcObject={stream}
            data-testid={`audio-${username}`}
          />
        ))}
      </header>

      {showGhostEquipment && (
        <div className="border-b bg-card/50 p-4 ghost-equipment-panel">
          <div className="max-w-4xl mx-auto">
            <div className="text-sm font-semibold mb-3 text-orange-500">🔍 Ghost Detection Equipment</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3 cursor-pointer hover:bg-primary/10 transition" onClick={activateEMFReader} data-testid="equipment-emf">
                <div className="text-center">
                  <div className="text-xl mb-1">📊</div>
                  <div className="text-xs font-medium">EMF Reader</div>
                  {emfLevel > 0 && (
                    <div className="mt-2 emf-bars">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`h-1 w-1 ${i * 20 < emfLevel ? 'bg-red-500' : 'bg-gray-700'} rounded-full`} />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
              <Card className="p-3 cursor-pointer hover:bg-primary/10 transition" onClick={activateSpiritBox} data-testid="equipment-spirit">
                <div className="text-center">
                  <div className="text-xl mb-1">📻</div>
                  <div className="text-xs font-medium">Spirit Box</div>
                  {spiritBoxActive && (
                    <div className="mt-2 spirit-box-scan">
                      <div className="text-xs text-green-400">Scanning...</div>
                    </div>
                  )}
                </div>
              </Card>
              <Card className="p-3 cursor-pointer hover:bg-primary/10 transition" onClick={checkThermal} data-testid="equipment-thermal">
                <div className="text-center">
                  <div className="text-xl mb-1">🌡️</div>
                  <div className="text-xs font-medium">Thermal</div>
                  <div className="mt-2 text-xs text-cyan-400">{Math.round(thermalTemp)}°F</div>
                </div>
              </Card>
              <Card className="p-3 cursor-pointer hover:bg-primary/10 transition" onClick={() => {
                soundEffects.parabolicMic();
                const micMessages = [
                  "🎙️ *whisper detected* ... Something's whispering...",
                  "🎙️ *distant screams* ... Help us... please...",
                  "🎙️ *eerie voice* ... Leave this place...",
                  "🎙️ *ghostly moan* ... Don't come back...",
                ];
                toast({ description: micMessages[Math.floor(Math.random() * micMessages.length)] });
              }} data-testid="equipment-mic">
                <div className="text-center">
                  <div className="text-xl mb-1">🎙️</div>
                  <div className="text-xs font-medium">Parabolic Mic</div>
                  <div className="mt-2 text-xs text-purple-400">Listening...</div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          {/* Video/Screen Sharing Controls */}
          {Array.from(remoteStreams.keys()).length > 0 && (
            <div className="border-b bg-card/50 p-2">
              <div className="max-w-4xl mx-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">Video Streams</p>
                <div className="flex gap-2 flex-wrap">
                  {Array.from(remoteStreams.keys()).map((user) => (
                    <Button
                      key={user}
                      size="sm"
                      variant={selectedVideoUser === user ? "default" : "outline"}
                      onClick={() => setSelectedVideoUser(user)}
                      data-testid={`button-view-${user}`}
                    >
                      {participants.find(p => p.username === user)?.isScreenSharing ? "📺 " : "📹 "}
                      {user}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Video Display */}
          {selectedVideoUser && remoteStreams.has(selectedVideoUser) && (
            <div className="border-b bg-black" style={{ height: "300px" }}>
              <div className="relative w-full h-full">
                <video
                  autoPlay
                  playsInline
                  muted={false}
                  ref={(video) => {
                    if (video && selectedVideoUser) {
                      const stream = remoteStreams.get(selectedVideoUser);
                      if (stream && video.srcObject !== stream) {
                        video.srcObject = stream;
                      }
                    }
                  }}
                  className="w-full h-full object-contain"
                  data-testid={`video-${selectedVideoUser}`}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedVideoUser(null)}
                  className="absolute top-2 right-2"
                  data-testid="button-close-video"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                  <MessageSquareIcon className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Be the first to say something!
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.type === "system" ? "text-center" : ""}
                    data-testid={`message-${message.id}`}
                  >
                    {message.type === "system" ? (
                      <p className="text-sm text-muted-foreground italic">
                        {message.content}
                      </p>
                    ) : (
                      <div className="flex gap-3">
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {getInitials(message.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-medium text-sm" data-testid={`text-username-${message.id}`}>
                              {message.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                          {editingMessageId === message.id ? (
                            <div className="flex gap-2">
                              <Input
                                value={editingMessageContent}
                                onChange={(e) => setEditingMessageContent(e.target.value)}
                                className="flex-1"
                                data-testid={`input-edit-${message.id}`}
                              />
                              <Button size="sm" onClick={() => handleSaveEdit(message.id)} data-testid={`button-save-edit-${message.id}`}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)} data-testid={`button-cancel-edit-${message.id}`}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <p className="text-sm break-words flex-1" data-testid={`text-content-${message.id}`}>
                                {message.content}
                              </p>
                              {username === message.username && (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditMessage(message.id, message.content)} data-testid={`button-edit-${message.id}`} title="Edit">✏️</Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteMessage(message.id)} data-testid={`button-delete-${message.id}`} title="Delete">🗑️</Button>
                                </div>
                              )}
                            </div>
                          )}
                          {message.isEdited && <span className="text-xs text-muted-foreground">(edited)</span>}
                          {message.attachment && (
                            <div className="mt-2 p-2 bg-primary/10 rounded border border-primary/20">
                              {message.attachment.type.startsWith("image/") ? (
                                <div className="max-w-xs">
                                  <img 
                                    src={message.attachment.dataUrl} 
                                    alt={message.attachment.name}
                                    className="rounded max-h-64 w-auto"
                                    data-testid={`image-${message.id}`}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {message.attachment.name}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Paperclip className="w-4 h-4 text-primary" />
                                  <a
                                    href={message.attachment.dataUrl}
                                    download={message.attachment.name}
                                    className="text-sm text-primary hover:underline truncate"
                                    data-testid={`file-${message.id}`}
                                  >
                                    {message.attachment.name}
                                  </a>
                                  <span className="text-xs text-muted-foreground">
                                    {(message.attachment.size / 1024).toFixed(2)} KB
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {message.reactions && Object.entries(message.reactions).map(([emoji, users]) => (
                            <button
                              key={emoji}
                              className="px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-xs flex items-center gap-1"
                              title={users.join(", ")}
                              data-testid={`reaction-${message.id}-${emoji}`}
                            >
                              <span>{emoji}</span>
                              <span className="text-xs text-muted-foreground">{users.length}</span>
                            </button>
                          ))}
                          <Popover open={showEmojiPicker === message.id} onOpenChange={(open) => setShowEmojiPicker(open ? message.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                className="px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 text-xs"
                                title="Add reaction"
                              >
                                <Smile className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-32 p-2">
                              <div className="grid grid-cols-5 gap-1">
                                {["👍", "❤️", "😂", "🔥", "👻", "✨", "🎉", "😢", "😡", "🤔"].map((emoji) => (
                                  <button
                                    key={emoji}
                                    className="text-lg hover:scale-125 transition"
                                    onClick={() => {
                                      if (isConnected) {
                                        wsClient.send({
                                          type: "add_reaction",
                                          payload: {
                                            roomId: code || "",
                                            messageId: message.id,
                                            emoji: emoji,
                                            username: username,
                                          },
                                        });
                                        setShowEmojiPicker(null);
                                      }
                                    }}
                                    title={emoji}
                                    data-testid={`button-emoji-${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {typingUsers.size > 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground" data-testid="text-typing-indicator">
              {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
            </div>
          )}

          <div className="border-t p-4">
            <div className="max-w-4xl mx-auto">
              {selectedFile && (
                <div className="mb-3 p-2 bg-primary/10 rounded border border-primary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Paperclip className="w-4 h-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!isConnected}
                  data-testid="input-message"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isConnected}
                  data-testid="button-attach-file"
                  title="Attach file or image"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                  data-testid="input-file"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!isConnected || (!messageInput.trim() && !selectedFile)}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-64 border-l flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-medium text-sm">
                Participants ({participants.length})
              </h2>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {participants.map((participant) => (
                <Card
                  key={participant.id}
                  className="p-3"
                  data-testid={`participant-${participant.username}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getInitials(participant.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {participant.username}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {participant.isModerator && (
                          <Badge variant="default" className="text-xs h-5">MOD</Badge>
                        )}
                        {participant.isMuted && (
                          <div title="Muted">
                            <MicOff className="w-3 h-3 text-destructive" />
                          </div>
                        )}
                        {participant.isDeafened && (
                          <div title="Deafened">
                            <VolumeX className="w-3 h-3 text-destructive" />
                          </div>
                        )}
                        {participant.isVoiceActive && (
                          <div className="w-2 h-2 rounded-full bg-voice-active animate-pulse-glow" title="Speaking" />
                        )}
                        {participant.isScreenSharing && (
                          <div title="Screen sharing">
                            <Monitor className="w-3 h-3 text-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        participant.status === "online"
                          ? "bg-voice-active"
                          : participant.status === "in-call"
                          ? "bg-primary animate-pulse-glow"
                          : "bg-voice-inactive"
                      }`}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t space-y-2">
            <Card className="p-3 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl">{userProfile.avatarEmoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-current-user">
                    {username}
                  </p>
                  <p className="text-xs text-muted-foreground">{userProfile.bio || "No bio"}</p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      data-testid="button-edit-profile"
                    >
                      <User className="w-3 h-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-56">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Edit Profile</h4>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Avatar</label>
                        <div className="grid grid-cols-5 gap-2">
                          {AVATAR_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              className={`text-2xl p-1 rounded ${
                                userProfile.avatarEmoji === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-primary/10"
                              }`}
                              onClick={() => {
                                setUserProfile(prev => ({ ...prev, avatarEmoji: emoji }));
                                sessionStorage.setItem("userProfile", JSON.stringify({ ...userProfile, avatarEmoji: emoji }));
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Bio</label>
                        <Input
                          placeholder="Add a bio..."
                          value={userProfile.bio}
                          onChange={(e) => {
                            setUserProfile(prev => ({ ...prev, bio: e.target.value }));
                            sessionStorage.setItem("userProfile", JSON.stringify({ ...userProfile, bio: e.target.value }));
                          }}
                          maxLength={50}
                          data-testid="input-bio"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Separator className="my-2" />
              <div className="flex gap-1 mb-2 flex-wrap">
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="sm"
                  className="flex-1 min-w-[60px]"
                  onClick={toggleMute}
                  data-testid="button-toggle-mute"
                  title="Toggle microphone"
                >
                  {isMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant={isDeafened ? "destructive" : "secondary"}
                  size="sm"
                  className="flex-1 min-w-[60px]"
                  onClick={toggleDeafen}
                  data-testid="button-toggle-deafen"
                  title="Toggle deafen (auto-mutes)"
                >
                  {isDeafened ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Headphones className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant={isPushToTalk ? "default" : "secondary"}
                  size="sm"
                  className="flex-1 min-w-[60px]"
                  onClick={() => setIsPushToTalk(!isPushToTalk)}
                  data-testid="button-push-to-talk"
                  title="Push to talk - only transmit when held"
                >
                  <Mic className="w-4 h-4" />
                </Button>
                <Button
                  variant={isScreenSharing ? "destructive" : "secondary"}
                  size="sm"
                  className="flex-1 min-w-[60px]"
                  onClick={handleScreenShare}
                  data-testid="button-screen-share"
                  title="Share your screen"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
                <Button
                  variant={isVideoOn ? "default" : "secondary"}
                  size="sm"
                  className="flex-1 min-w-[60px]"
                  onClick={handleToggleVideo}
                  data-testid="button-toggle-video"
                  title="Toggle camera"
                >
                  📹
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 min-w-[60px]"
                      data-testid="button-mic-settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-56">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Microphone Settings</h4>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Status</p>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              micActive ? "bg-voice-active" : "bg-voice-inactive"
                            }`}
                          />
                          <span className="text-sm">
                            {micActive ? "Microphone Active" : "Microphone Inactive"}
                          </span>
                        </div>
                      </div>

                      {audioDevices.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Device ({audioDevices.length})
                          </p>
                          <Select value={selectedMicId} onValueChange={handleMicDeviceChange}>
                            <SelectTrigger className="w-full" data-testid="select-mic-device">
                              <SelectValue placeholder="Select microphone" />
                            </SelectTrigger>
                            <SelectContent>
                              {audioDevices.map((device) => (
                                <SelectItem
                                  key={device.deviceId}
                                  value={device.deviceId}
                                  data-testid={`option-mic-${device.deviceId}`}
                                >
                                  {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Permission</p>
                        <p className="text-sm">
                          {micPermissionStatus?.state === "granted"
                            ? "✓ Granted"
                            : micPermissionStatus?.state === "denied"
                            ? "✗ Denied"
                            : "? Not requested"}
                        </p>
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          Ensure your microphone is connected and working properly so everyone can hear you clearly.
                        </p>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {!micActive && (
                <div className="bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
                  <p className="text-xs text-destructive">Microphone not available</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  );
}
