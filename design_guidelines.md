# Design Guidelines: Phasmophobia Broads

## Design Approach

**Primary Direction**: Horror-gaming aesthetic inspired by Phasmophobia with Discord-like functionality
- Dark, atmospheric interface with purple/green accent scheme
- Gaming comfort priority: high contrast, clear readability
- Real-time communication focus with immediate visual feedback

## Core Design Elements

### Typography
- **Primary Font**: Inter or Outfit (Google Fonts) - clean, gaming-friendly sans-serif
- **Hierarchy**:
  - Headers: 2xl to 4xl, semi-bold (600)
  - Body/Chat: base to lg, regular (400)
  - Labels/Meta: sm to xs, medium (500)
  - Monospace for room codes: Fira Code

### Layout System
- **Spacing Units**: Tailwind units of 2, 4, 6, and 8 for consistent rhythm
- **Container Strategy**: 
  - Full-width application shell
  - Sidebar: fixed 64-72 width
  - Main content: flexible with max-w-7xl inner containers
  - Chat panels: max-w-2xl for optimal readability

### Component Library

**Navigation & Structure**
- Left sidebar (dark background): voice channels, text channels, room switcher
- Top bar: current room name, active user count, settings icon
- Right panel (collapsible): user list with presence indicators

**Chat Interface**
- Message bubbles with sender avatar (circular, 8-10 units)
- Timestamp and username above each message group
- Input area: sticky bottom with send button, emoji picker, attachment icon
- Typing indicators with subtle animation
- System messages (joins/leaves) with muted treatment

**Voice & Streaming**
- Voice participant cards: avatar, username, audio level indicator (green pulse)
- Mute/unmute toggle with clear on/off states
- Screen share viewer: large central area with participant thumbnails below
- "Go Live" button prominent when screen sharing available

**Rooms & Presence**
- Room cards: name, participant count, locked/unlocked indicator
- Create room modal: simple form with room name and optional password
- User status badges: online (green dot), in-call (purple pulse), away (gray)
- Active speaker highlighting with subtle border glow

**Forms & Controls**
- Input fields: subtle border, focused state with accent glow
- Buttons: solid fills for primary actions, outlined for secondary
- Toggle switches for settings (mute, deafen, video on/off)

### Visual Treatment
- **Backgrounds**: Very dark grays (gray-900/950 range) with subtle texture
- **Accents**: Purple for active states, green for voice indicators
- **Borders**: Minimal, subtle dividers between sections
- **Shadows**: Soft elevation for modals and floating elements
- **Icons**: Heroicons via CDN for consistent UI icons

### Animations
- Voice level indicators: subtle pulse
- User join/leave: brief fade in/out
- Message send: quick slide-up
- Keep minimal for performance during streaming

### Images
- **Gaming Atmosphere**: Dark, moody background texture in main chat area (subtle, low opacity)
- **User Avatars**: Circular placeholders with gaming-themed default icons
- No large hero image - this is a functional application interface

### Accessibility
- High contrast text on dark backgrounds
- Clear focus states for keyboard navigation  
- Screen reader labels for all interactive elements
- Visual + audio indicators for voice activity

## Key Principles
1. **Clarity over decoration**: Every element serves communication function
2. **Gaming comfort**: Dark theme reduces eye strain during long sessions
3. **Instant feedback**: Real-time indicators for all user actions
4. **Horror aesthetic**: Atmospheric but not obstructive to functionality
5. **Mobile-responsive**: Stack panels vertically on smaller screens