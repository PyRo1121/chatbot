# Twitch Bot

A comprehensive Twitch bot designed to enhance stream engagement, automate tasks, and provide detailed analytics.

## Project Structure

```
src/
├── auth/           # Authentication-related files
│   ├── auth-server.js
│   ├── get-auth-url.js
│   ├── get-refresh-token.js
│   ├── getRefreshToken.js
│   ├── getTwitchToken.js
│   └── spotifyAuth.js
├── bot/            # Core bot functionality
│   ├── analytics.js      # Viewer and engagement tracking
│   ├── bot.js           # Main bot logic
│   ├── channelPoints.js # Channel points management
│   ├── chatInteraction.js # Chat response system
│   ├── twitchClient.js  # Twitch API client
│   └── commands/        # Bot commands
│       ├── customCommands.js
│       ├── ping.js
│       ├── queue.js
│       └── roast.js
├── events/         # Event handling
│   ├── eventHandlers.js
│   └── responseHandler.js
├── spotify/        # Spotify integration
│   ├── spotify.js
│   └── song_queue.json
├── overlays/       # Stream overlay functionality
│   ├── aiOverlays.js
│   ├── overlay.html
│   └── overlays.js
├── utils/          # Utility functions
│   ├── logger.js
│   └── openai.js
├── templates/      # Message templates
│   ├── alert.txt
│   ├── chat.txt
│   └── title.txt
└── config.js       # Core configuration
```

## Features

### Chat Commands

#### Music Control
- `!songrequest [song]` - Request a song to be played
- `!queue` - View current song queue
- `!queueclear` - Clear the song queue (Mod only)
- `!queueremove [position]` - Remove a song from the queue (Mod only)

#### Custom Commands
- `!addcom [command] [response]` - Add a custom command (Mod only)
- `!delcom [command]` - Delete a custom command (Mod only)
- `!commands` - List all available commands

#### Stream Analytics
- `!stats` - View current stream statistics
- `!topchatter` - See top 3 most active chatters
- `!besttime` - View best streaming times based on viewer count

#### Entertainment
- `!roast @username` - Generate a witty roast for a user
- `!ping` - Check if bot is responsive

### Channel Points Rewards

1. **Highlight Message** (500 points)
   - Highlight your message in chat
   - Special visual treatment

2. **Create Stream Marker** (1000 points)
   - Create a timestamp marker in your stream
   - Add custom description

3. **Create Clip** (1500 points)
   - Automatically create a clip
   - Get direct link to edit/share

4. **Custom AI Response** (2000 points)
   - Get a personalized AI response
   - Fun and engaging interactions

### Analytics System

- Real-time viewer tracking
- Chat engagement metrics
- Stream performance statistics
- Viewer retention analysis
- Command usage statistics
- Best streaming times calculation

### Chat Interaction

- Smart response system
- Question detection and answering
- Witty responses with cooldown
- Context-aware interactions
- User engagement tracking

### Moderation Tools

- Command permission levels
- User activity monitoring
- Chat analytics
- Custom command management

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Configure environment variables:
```env
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token
TWITCH_CHANNEL=your_channel
TWITCH_BOT_CLIENT_ID=your_client_id
TWITCH_BOT_CLIENT_SECRET=your_client_secret
OPENAI_API_KEY=your_openai_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

4. Run the bot:
```bash
npm start
```

## Development

### Adding New Commands

1. Create a new file in `src/bot/commands/`
2. Export command handler function
3. Import and add to command list in `src/bot/commands/index.js`

### Adding Channel Point Rewards

1. Add new reward in `src/bot/channelPoints.js`
2. Implement handler function
3. Add to redemption handlers

## Testing

Run the test suite:
```bash
npm test
```

Run specific tests:
```bash
npm test -- --grep "command name"
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - See LICENSE file for details
