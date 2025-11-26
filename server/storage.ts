import { type User, type InsertUser, type Room, type InsertRoom, type Message, type Participant, messages as messagesTable } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import pg from "pg";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createRoom(room: InsertRoom, code?: string): Promise<Room>;
  getRoom(id: string): Promise<Room | undefined>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getAllRooms(): Promise<Room[]>;
  updateRoomParticipantCount(roomId: string, count: number): Promise<void>;
  
  addMessage(message: Omit<Message, "id">): Promise<Message>;
  getMessagesByRoom(roomId: string): Promise<Message[]>;
  
  addParticipant(participant: Omit<Participant, "id">): Promise<Participant>;
  removeParticipant(roomId: string, username: string): Promise<void>;
  getParticipantsByRoom(roomId: string): Promise<Participant[]>;
  updateParticipant(roomId: string, username: string, updates: Partial<Participant>): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private rooms: Map<string, Room>;
  private messages: Map<string, Message>;
  private participants: Map<string, Participant>;
  private db: any = null;
  private pool: pg.Pool | null = null;

  constructor() {
    this.users = new Map();
    this.rooms = new Map();
    this.messages = new Map();
    this.participants = new Map();
    this.initializeDB();
  }

  private async initializeDB() {
    try {
      if (process.env.DATABASE_URL) {
        this.pool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          max: 3,
          idleTimeoutMillis: 30000,
        });
        
        this.pool.on('error', (error) => {
          console.warn("Database pool error:", error);
        });
        
        this.db = drizzle(this.pool);
      }
    } catch (error) {
      console.warn("Database not available, using in-memory storage:", error);
      this.db = null;
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createRoom(insertRoom: InsertRoom, code?: string): Promise<Room> {
    const roomCode = code || Math.random().toString(36).substring(2, 8).toUpperCase();
    
    if (this.rooms.has(roomCode)) {
      return this.rooms.get(roomCode)!;
    }
    
    const id = randomUUID();
    const room: Room = {
      id,
      code: roomCode,
      name: insertRoom.name,
      createdAt: Date.now(),
      participantCount: 0,
      theme: "dark",
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return Array.from(this.rooms.values()).find((room) => room.id === id);
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return this.rooms.get(code);
  }

  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }

  async updateRoomParticipantCount(roomCode: string, count: number): Promise<void> {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.participantCount = count;
      this.rooms.set(roomCode, room);
    }
  }

  async addMessage(message: Omit<Message, "id">): Promise<Message> {
    const id = randomUUID();
    const fullMessage: Message = { ...message, id };
    
    // Try to save to database
    if (this.db) {
      try {
        await this.db.insert(messagesTable).values({
          id,
          roomId: message.roomId,
          userId: message.userId,
          username: message.username,
          content: message.content,
          timestamp: message.timestamp,
          type: message.type,
        });
      } catch (error) {
        console.warn("Failed to save message to database:", error);
      }
    }
    
    // Also keep in memory for fast access
    this.messages.set(id, fullMessage);
    return fullMessage;
  }

  async getMessagesByRoom(roomId: string): Promise<Message[]> {
    let messages: Message[] = [];
    
    // Try to fetch from database first
    if (this.db) {
      try {
        const dbMessages = await this.db
          .select()
          .from(messagesTable)
          .where(eq(messagesTable.roomId, roomId));
        
        messages = dbMessages.map((msg: any) => ({
          id: msg.id,
          roomId: msg.roomId,
          userId: msg.userId,
          username: msg.username,
          content: msg.content,
          timestamp: msg.timestamp,
          type: msg.type,
        }));
      } catch (error) {
        console.warn("Failed to fetch messages from database:", error);
        // Fall back to memory
        messages = Array.from(this.messages.values())
          .filter((msg) => msg.roomId === roomId);
      }
    } else {
      // Use memory storage if no database
      messages = Array.from(this.messages.values())
        .filter((msg) => msg.roomId === roomId);
    }
    
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  async addParticipant(participant: Omit<Participant, "id">): Promise<Participant> {
    const existing = Array.from(this.participants.values()).find(
      (p) => p.roomId === participant.roomId && p.username === participant.username
    );
    
    if (existing) {
      Object.assign(existing, participant);
      this.participants.set(existing.id, existing);
      return existing;
    }
    
    const id = randomUUID();
    const fullParticipant: Participant = { ...participant, id };
    this.participants.set(id, fullParticipant);
    return fullParticipant;
  }

  async removeParticipant(roomId: string, username: string): Promise<void> {
    const participant = Array.from(this.participants.values()).find(
      (p) => p.roomId === roomId && p.username === username
    );
    if (participant) {
      this.participants.delete(participant.id);
    }
  }

  async getParticipantsByRoom(roomId: string): Promise<Participant[]> {
    return Array.from(this.participants.values()).filter(
      (p) => p.roomId === roomId
    );
  }

  async updateParticipant(
    roomId: string,
    username: string,
    updates: Partial<Participant>
  ): Promise<void> {
    const participant = Array.from(this.participants.values()).find(
      (p) => p.roomId === roomId && p.username === username
    );
    if (participant) {
      Object.assign(participant, updates);
      this.participants.set(participant.id, participant);
    }
  }
}

export const storage = new MemStorage();
