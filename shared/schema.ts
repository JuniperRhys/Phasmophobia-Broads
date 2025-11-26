import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, bigint, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Chat messages table for persistent storage
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: text("room_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  type: text("type").notNull().default("user"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type InsertMessageDB = z.infer<typeof insertMessageSchema>;
export type MessageDB = typeof messages.$inferSelect;

// Room schema for chat rooms
export interface Room {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  participantCount: number;
  theme: "dark" | "purple" | "green" | "red" | "blue";
}

export const insertRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(50, "Room name too long"),
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;

// File attachment schema
export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

// Message schema for chat messages (runtime)
export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  type: "user" | "system";
  attachment?: FileAttachment;
  reactions?: Record<string, string[]>;
  mentions?: string[];
  isEdited?: boolean;
  editedAt?: number;
  canEdit?: boolean;
}

// User profile interface
export interface UserProfileData {
  username: string;
  avatarEmoji: string;
  bio: string;
}

// Schema for message creation from client
export const messageInputSchema = z.object({
  roomId: z.string(),
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message too long"),
});

export type InsertMessage = z.infer<typeof messageInputSchema>;

// User profile schema
export interface UserProfile {
  username: string;
  avatar?: string;
  bio?: string;
  createdAt: number;
}

// Participant schema for room participants
export interface Participant {
  id: string;
  roomId: string;
  username: string;
  status: "online" | "in-call" | "away";
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  isPushToTalk: boolean;
  isVoiceActive: boolean;
  joinedAt: number;
  isModerator?: boolean;
  isVideoOn?: boolean;
  videoStream?: string;
}

// WebSocket message types with proper typing
export type WSMessage =
  | { type: "join_room"; payload: { roomId: string; username: string }; timestamp: number }
  | { type: "leave_room"; payload: { roomId: string; username: string }; timestamp: number }
  | { type: "chat_message"; payload: { roomId: string; content: string } | Message; timestamp: number }
  | { type: "typing_start"; payload: { roomId: string; username?: string }; timestamp: number }
  | { type: "typing_stop"; payload: { roomId: string; username?: string }; timestamp: number }
  | { type: "user_joined"; payload: { username: string; participant: Participant }; timestamp: number }
  | { type: "user_left"; payload: { username: string }; timestamp: number }
  | { type: "presence_update"; payload: { roomId: string; username?: string; updates: Partial<Participant> }; timestamp: number }
  | { type: "room_list"; payload: { messages: Message[]; participants: Participant[]; roomName: string; theme: string }; timestamp: number }
  | { type: "add_reaction"; payload: { roomId: string; messageId: string; emoji: string; username: string }; timestamp: number }
  | { type: "message_reaction"; payload: { messageId: string; emoji: string; username: string }; timestamp: number }
  | { type: "edit_message"; payload: { roomId: string; messageId: string; content: string }; timestamp: number }
  | { type: "delete_message"; payload: { roomId: string; messageId: string }; timestamp: number }
  | { type: "message_updated"; payload: Message; timestamp: number }
  | { type: "message_deleted"; payload: { messageId: string }; timestamp: number }
  | { type: "update_room_name"; payload: { roomId: string; name: string }; timestamp: number }
  | { type: "room_name_updated"; payload: { roomId: string; name: string }; timestamp: number }
  | { type: "update_room_theme"; payload: { roomId: string; theme: string }; timestamp: number }
  | { type: "room_theme_updated"; payload: { roomId: string; theme: string }; timestamp: number }
  | { type: "toggle_video"; payload: { roomId: string; isOn: boolean }; timestamp: number }
  | { type: "rtc_offer"; payload: { roomId: string; username: string; offer: any; targetUser: string }; timestamp: number }
  | { type: "rtc_answer"; payload: { roomId: string; username: string; answer: any; targetUser: string }; timestamp: number }
  | { type: "rtc_ice_candidate"; payload: { roomId: string; username: string; candidate: any; targetUser: string }; timestamp: number };
