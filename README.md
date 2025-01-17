# 🔥🐷 Fire Pig Twitch Bot

An AI-powered Twitch bot that brings personality and advanced features to your stream. With a cute fire pig theme, this bot combines chat interaction, sentiment analysis, and intelligent clip creation.

## Currently Implemented Features

### 🤖 AI-Powered Interactions
- Dynamic responses with unique fire pig personality
- Sentiment analysis of chat messages using OpenAI
- Content moderation using OpenAI
- Mood-based responses with fire pig themed messages

### 🎬 Smart Clipping
- AI-powered clip detection using GPT-4 Vision
- Analyzes chat activity and emote usage
- Stream content analysis for memorable moments
- Automatic clip creation with context storage
- 5-minute cooldown between clips

### 💬 Chat Overlay System
- WebSocket-based overlay system
- Real-time chat display
- Customizable templates for messages
- Support for alerts and titles

## Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or pnpm
- Twitch Developer Account
- OpenAI API Key
- FFmpeg (for audio capture)

### Getting API Keys

#### Twitch Setup
1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Create a new application
3. Get your Client ID and Client Secret
4. Generate OAuth token using the included script:
```bash
node getTwitchToken.js
```

#### OpenAI Setup
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Ensure you have access to GPT-4 Vision API

### Installation
1. Clone the repository
```bash
git clone [repository-url]
cd twitch-chat-bot
```

2. Install dependencies
```bash
npm install
# or
pnpm install
```

3. Create a .env file with the following variables:
```env
# Twitch Configuration
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_oauth_token
TWITCH_CHANNEL=your_channel_name
TWITCH_BOT_CLIENT_ID=your_bot_client_id
TWITCH_BOT_CLIENT_SECRET=your_bot_client_secret
TWITCH_CHANNEL_ID=your_channel_id

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
```

4. Run the bot
```bash
npm start
# or
pnpm start
```

## Features in Detail

### Sentiment Analysis
- Real-time analysis of chat messages
- Tracks chat mood over time
- Adapts bot responses based on current mood
- Maintains sentiment history for context

### Auto-Clipping System
- Monitors chat activity and emote usage
- Captures stream screenshots for visual analysis
- Uses FFmpeg for audio capture
- Combines chat, visual, and audio analysis for clip decisions
- Stores comprehensive context with each clip

### Chat Overlay
- WebSocket server running on port 3000
- Supports multiple overlay clients
- Template-based message rendering
- Real-time updates to connected clients

### Content Moderation
- Automatic content filtering using OpenAI
- Checks for inappropriate content
- Monitors multiple categories of content
- Fallback safety measures

## Technical Details

### Overlay System
The overlay system runs a WebSocket server on port 3000 and uses template files from the templates directory:
- chat.txt - Template for chat messages
- alert.txt - Template for alerts
- title.txt - Template for titles

### Auto-Clip Analysis
The system performs multiple levels of analysis:
1. Chat activity monitoring
2. Emote usage tracking
3. Visual content analysis with GPT-4 Vision
4. Audio transcription with Whisper API

### Sentiment Tracking
- Maintains a rolling window of recent sentiments
- Calculates mood based on positive/negative ratios
- Thresholds: 
  - Positive: >70% positive messages
  - Negative: >30% negative messages

## Contributing

Feel free to submit issues and enhancement requests!

## License

[MIT License]
