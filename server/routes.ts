import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { WSMessage, Message } from "@shared/schema";

interface WSClient {
  ws: WebSocket;
  roomId: string | null;
  username: string | null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const clients = new Map<WebSocket, WSClient>();
  const usernameToWs = new Map<string, WebSocket>(); // Track username -> WebSocket mapping

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection');
    
    clients.set(ws, {
      ws,
      roomId: null,
      username: null,
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        const client = clients.get(ws);
        
        if (!client) return;

        switch (message.type) {
          case 'join_room': {
            const { roomId, username } = message.payload;
            client.roomId = roomId;
            client.username = username;
            usernameToWs.set(username, ws); // Track this username's WebSocket

            let room = await storage.getRoomByCode(roomId);
            if (!room) {
              room = await storage.createRoom({ name: `Room ${roomId}` }, roomId);
            }

            const participant = await storage.addParticipant({
              roomId: room.code,
              username,
              status: 'online',
              isMuted: false,
              isDeafened: false,
              isScreenSharing: false,
              joinedAt: Date.now(),
            });

            const participants = await storage.getParticipantsByRoom(room.code);
            await storage.updateRoomParticipantCount(room.code, participants.length);

            const messages = await storage.getMessagesByRoom(room.code);
            
            ws.send(JSON.stringify({
              type: 'room_list',
              payload: { messages, participants, roomName: room.name },
              timestamp: Date.now(),
            }));

            broadcastToRoom(roomId, {
              type: 'user_joined',
              payload: { username, participant },
              timestamp: Date.now(),
            }, ws);
            break;
          }

          case 'leave_room': {
            const { roomId, username } = message.payload;
            
            if (roomId) {
              const room = await storage.getRoomByCode(roomId);
              if (room) {
                await storage.removeParticipant(room.code, username);
                
                const participants = await storage.getParticipantsByRoom(room.code);
                await storage.updateRoomParticipantCount(room.code, participants.length);

                broadcastToRoom(roomId, {
                  type: 'user_left',
                  payload: { username },
                  timestamp: Date.now(),
                }, ws);
              }
            }

            client.roomId = null;
            client.username = null;
            break;
          }

          case 'chat_message': {
            const payload = message.payload;
            const username = client.username;

            const roomId = 'roomId' in payload ? payload.roomId : client.roomId;
            const content = 'content' in payload ? payload.content : '';

            if (!roomId || !username || !content) return;

            const room = await storage.getRoomByCode(roomId);
            if (!room) return;

            const savedMessage = await storage.addMessage({
              roomId: room.code,
              userId: username,
              username,
              content,
              timestamp: Date.now(),
              type: 'user',
            });

            broadcastToRoom(roomId, {
              type: 'chat_message',
              payload: savedMessage,
              timestamp: Date.now(),
            });
            break;
          }

          case 'typing_start': {
            const roomId = message.payload.roomId || client.roomId;
            const username = client.username;

            if (!roomId || !username) return;

            broadcastToRoom(roomId, {
              type: 'typing_start',
              payload: { roomId, username },
              timestamp: Date.now(),
            }, ws);
            break;
          }

          case 'typing_stop': {
            const roomId = message.payload.roomId || client.roomId;
            const username = client.username;

            if (!roomId || !username) return;

            broadcastToRoom(roomId, {
              type: 'typing_stop',
              payload: { roomId, username },
              timestamp: Date.now(),
            }, ws);
            break;
          }

          case 'presence_update': {
            const roomId = message.payload.roomId || client.roomId;
            const username = client.username;
            const updates = message.payload.updates;

            if (!roomId || !username) return;

            const room = await storage.getRoomByCode(roomId);
            if (!room) return;

            await storage.updateParticipant(room.code, username, updates);

            broadcastToRoom(roomId, {
              type: 'presence_update',
              payload: { roomId, username, updates },
              timestamp: Date.now(),
            });
            break;
          }

          case 'add_reaction': {
            const { roomId, messageId, emoji, username } = message.payload;

            if (!roomId || !messageId || !emoji || !username) return;

            broadcastToRoom(roomId, {
              type: 'message_reaction',
              payload: { messageId, emoji, username },
              timestamp: Date.now(),
            });
            break;
          }

          case 'edit_message': {
            const { roomId, messageId, content } = message.payload;
            const username = client.username;

            if (!roomId || !messageId || !content || !username) return;

            broadcastToRoom(roomId, {
              type: 'message_updated',
              payload: {
                id: messageId,
                roomId,
                userId: username,
                username,
                content,
                timestamp: Date.now(),
                type: 'user',
                isEdited: true,
                editedAt: Date.now(),
              },
              timestamp: Date.now(),
            });
            break;
          }

          case 'delete_message': {
            const { roomId, messageId } = message.payload;

            if (!roomId || !messageId) return;

            broadcastToRoom(roomId, {
              type: 'message_deleted',
              payload: { messageId },
              timestamp: Date.now(),
            });
            break;
          }

          case 'update_room_name': {
            const { roomId, name } = message.payload;

            if (!roomId || !name) return;

            const room = await storage.getRoomByCode(roomId);
            if (room) {
              room.name = name;
            }

            broadcastToRoom(roomId, {
              type: 'room_name_updated',
              payload: { roomId, name },
              timestamp: Date.now(),
            });
            break;
          }

          case 'update_room_theme': {
            const { roomId, theme } = message.payload;

            if (!roomId || !theme) return;

            const room = await storage.getRoomByCode(roomId);
            if (room) {
              room.theme = theme as any;
            }

            broadcastToRoom(roomId, {
              type: 'room_theme_updated',
              payload: { roomId, theme },
              timestamp: Date.now(),
            });
            break;
          }

          case 'toggle_video': {
            const { roomId, isOn } = message.payload;
            const username = client.username;

            if (!roomId || !username) return;

            const room = await storage.getRoomByCode(roomId);
            if (!room) return;

            await storage.updateParticipant(room.code, username, { isVideoOn: isOn });

            broadcastToRoom(roomId, {
              type: 'presence_update',
              payload: { roomId, username, updates: { isVideoOn: isOn } },
              timestamp: Date.now(),
            });
            break;
          }

          case 'rtc_offer': {
            const { roomId, username, offer, targetUser } = message.payload;
            if (!roomId || !username || !targetUser) return;
            
            const targetWs = usernameToWs.get(targetUser);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'rtc_offer',
                payload: { roomId, username, offer, targetUser },
                timestamp: Date.now(),
              }));
            }
            break;
          }

          case 'rtc_answer': {
            const { roomId, username, answer, targetUser } = message.payload;
            if (!roomId || !username || !targetUser) return;
            
            const targetWs = usernameToWs.get(targetUser);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'rtc_answer',
                payload: { roomId, username, answer, targetUser },
                timestamp: Date.now(),
              }));
            }
            break;
          }

          case 'rtc_ice_candidate': {
            const { roomId, username, candidate, targetUser } = message.payload;
            if (!roomId || !username || !targetUser) return;
            
            const targetWs = usernameToWs.get(targetUser);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({
                type: 'rtc_ice_candidate',
                payload: { roomId, username, candidate, targetUser },
                timestamp: Date.now(),
              }));
            }
            break;
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', async () => {
      const client = clients.get(ws);
      
      if (client && client.roomId && client.username) {
        usernameToWs.delete(client.username); // Remove username mapping
        const room = await storage.getRoomByCode(client.roomId);
        if (room) {
          await storage.removeParticipant(room.code, client.username);
          
          const participants = await storage.getParticipantsByRoom(room.code);
          await storage.updateRoomParticipantCount(room.code, participants.length);

          broadcastToRoom(client.roomId, {
            type: 'user_left',
            payload: { username: client.username },
            timestamp: Date.now(),
          }, ws);
        }
      }
      
      clients.delete(ws);
      console.log('WebSocket connection closed');
    });

    ws.on('error', async (error) => {
      console.error('WebSocket error:', error);
      
      const client = clients.get(ws);
      if (client && client.roomId && client.username) {
        usernameToWs.delete(client.username); // Remove username mapping
        const room = await storage.getRoomByCode(client.roomId);
        if (room) {
          await storage.removeParticipant(room.code, client.username);
          
          const participants = await storage.getParticipantsByRoom(room.code);
          await storage.updateRoomParticipantCount(room.code, participants.length);

          broadcastToRoom(client.roomId, {
            type: 'user_left',
            payload: { username: client.username },
            timestamp: Date.now(),
          }, ws);
        }
      }
      
      clients.delete(ws);
    });
  });

  function broadcastToRoom(roomId: string, message: WSMessage, excludeWs?: WebSocket) {
    const messageStr = JSON.stringify(message);
    
    for (const [clientWs, client] of clients.entries()) {
      if (client.roomId === roomId && clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(messageStr);
      }
    }
  }

  return httpServer;
}
