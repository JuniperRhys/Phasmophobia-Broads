# Phasmophobia Broads - Gaming Chat & Voice Platform

## Overview

Phasmophobia Broads is a real-time gaming communication platform designed for private voice and text chat among friends. The application features a horror-gaming aesthetic inspired by Phasmophobia with Discord-like functionality, providing rooms for voice communication, text chat, screen sharing, and video chat capabilities.

The platform is built as a full-stack web application with real-time WebSocket communication for instant messaging, presence updates, and collaboration features. Users can create or join rooms using unique room codes, customize room themes, edit/delete messages, add emoji reactions, and enjoy advanced microphone controls with push-to-talk and voice activity detection.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recently Added Features (Latest Session)

**Interactive Features:**
- ✅ **Custom Room Names** - Click room name in header to rename rooms (persisted across sessions)
- ✅ **User Mentions** - Built-in @username detection for tagging friends
- ✅ **Message Editing & Deletion** - Edit/delete buttons on your own messages, with "(edited)" indicator
- ✅ **Room Theme Customization** - 5 theme options (dark, purple, green, red, blue) in header dropdown
- ✅ **Webcam/Video Toggle** - Toggle camera on/off with status updates to other participants
- ✅ **Emoji Reactions** - Click smiley icon on messages to add emoji reactions (10+ emojis available)
- ✅ **Sound Effects** - Audio feedback for messages, user joins, and user leaves
- ✅ **User Profiles** - Emoji avatars and bio editing with sessionStorage persistence
- ✅ **Screen Sharing** - Share your screen with one-click toggle
- ✅ **Advanced Microphone Controls** - Device selection, push-to-talk mode, voice activity detection

## System Architecture

### Frontend Architecture

**Framework & Tooling:**
- React 18+ with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR (Hot Module Replacement)
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query (React Query) for server state management and data fetching

**UI Component System:**
- shadcn/ui component library based on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- "New York" style variant with dark mode as the default theme
- Custom color scheme: dark backgrounds with purple/green accents (horror-gaming aesthetic)
- Typography: Inter font family for body text, Fira Code for monospace (room codes)

**State Management:**
- React Query for server state with configured defaults (no refetch on window focus, infinite stale time)
- Local React state with hooks for component-level state
- WebSocket client singleton for real-time communication state
- sessionStorage for user profile persistence (avatar emoji, bio)

**Key Design Decisions:**
- Component-based architecture with reusable UI primitives
- Path aliases configured for clean imports (@/, @shared/, @assets/)
- CSS variables for theming flexibility
- Form validation using react-hook-form with Zod resolvers
- Real-time message updates with WebSocket broadcasting

### Backend Architecture

**Server Framework:**
- Express.js as the HTTP server framework
- Node.js HTTP server for WebSocket upgrade handling
- Separate development and production entry points (index-dev.ts, index-prod.ts)

**Real-time Communication:**
- WebSocket server (ws library) mounted at `/ws` path
- Custom message protocol with typed messages (WSMessage interface)
- Client tracking with room-based message routing and broadcasting
- Automatic reconnection logic on the client side (3-second retry interval)
- Message handlers for: chat, reactions, edits, deletes, room updates, theme changes, video toggling

**Data Storage:**
- In-memory storage implementation (MemStorage class) for development
- Interface-based storage abstraction (IStorage) allowing future database integration
- Storage handles users, rooms, messages, and participants with full CRUD operations
- Random UUID generation for entity IDs
- Connection pool-based database initialization with error handling

**Session Management:**
- Browser sessionStorage for username and room persistence
- WebSocket connection state tracked per client
- Participant status tracked (online/in-call/away, muted, deafened, screen sharing, video on)
- Per-user media stream management (microphone, screen, camera)

**Key Design Decisions:**
- Storage abstraction layer allows swapping to database without changing business logic
- WebSocket handler manages room joins, message broadcasting, typing indicators, participant updates, message edits/deletes, theme changes, and video toggles
- Logging middleware for API requests with timing and response tracking
- Environment-based configuration (NODE_ENV for dev/production modes)
- Efficient room-based message routing to minimize broadcast overhead

### Data Schema

**Core Entities:**
- **Users:** id, username, password (authentication prepared but not fully implemented)
- **Rooms:** id, name, code (unique 6-character uppercase identifier), theme (dark/purple/green/red/blue), createdAt, participantCount
- **Messages:** id, roomId, userId, username, content, timestamp, type (user/system), attachment, reactions, mentions, isEdited, editedAt, canEdit
- **Participants:** id, roomId, username, status (online/in-call/away), isMuted, isDeafened, isScreenSharing, isPushToTalk, isVoiceActive, isVideoOn, joinedAt, isModerator

**Schema Validation:**
- Zod schemas for runtime validation
- Drizzle-zod integration for type-safe schema definitions
- Insert schemas derived from base schemas

**WebSocket Message Types:**
- join_room, leave_room, chat_message, typing_start/stop, user_joined/left
- presence_update, room_list, add_reaction, message_reaction
- edit_message, delete_message, message_updated, message_deleted
- update_room_name, room_name_updated, update_room_theme, room_theme_updated
- toggle_video

### External Dependencies

**Database (Configured but Not Active):**
- Drizzle ORM configured for PostgreSQL with Neon serverless driver
- Connection pool (pg.Pool) with max 3 connections for stability
- Migration setup prepared (drizzle.config.ts, migrations directory)
- Schema definitions in shared/schema.ts ready for database activation
- connect-pg-simple for session store (when database is active)

**UI Dependencies:**
- Radix UI primitives for accessible component behaviors (accordion, dialog, dropdown, toast, etc.)
- embla-carousel-react for carousel components
- lucide-react for icon system
- react-icons/si for company logos
- class-variance-authority (CVA) for component variant management
- clsx and tailwind-merge for className composition

**Audio & Media:**
- Web Audio API for voice activity detection
- MediaStream API for microphone, camera, and screen capture
- HTML5 Audio API for sound effects (base64-encoded sounds)

**Development Tools:**
- Replit-specific Vite plugins (runtime error overlay, cartographer, dev banner)
- tsx for TypeScript execution in development
- esbuild for production server bundling
- TypeScript with strict mode and ESNext module resolution

**Key Architectural Patterns:**
- Monorepo structure with shared types between client and server
- Type-safe API communication with shared schemas
- WebSocket message typing for compile-time safety
- Modular component structure following shadcn/ui patterns
- Separation of concerns: routing, state management, UI components, and business logic
- Media stream management with proper cleanup on disconnect
- Room-based broadcasting pattern for efficient message delivery
