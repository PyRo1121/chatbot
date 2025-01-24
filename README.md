# Twitch Chat Bot

A comprehensive Twitch bot designed for small streamers (3-5 viewers) to enhance stream engagement, automate tasks, and provide growth analytics. Features include chat games, stream insights, automatic token management, and AI-powered interactions.

## Features

### Stream Analytics (!insights)
- **Best Time Analysis**: Determines optimal streaming hours based on viewer engagement
- **Game Performance**: Tracks which games bring in the most viewers
- **Growth Metrics**: Monitors viewer retention, chat engagement, and follower conversion
- **Competitor Analysis**: Studies similar channels for growth opportunities
- **Schedule Optimization**: Suggests best streaming schedules

### Chat Games
1. **Trivia (!trivia)**
   - AI-generated questions about gaming/streaming
   - Customizable categories
   - 30-second time limit
   - Automatic scoring

2. **Word Chain (!wordchain)**
   - Players create chains of words
   - Each word must start with the last letter of previous
   - Tracks unique words
   - 5-minute rounds or 30-word limit

3. **Mini Games (!minigame)**
   - Word Scramble: Unscramble streaming-related words
   - Riddles: AI-generated streaming/gaming riddles
   - 60-second time limit
   - No points system needed

### Chat Interaction
- **AI-Powered Responses**: Witty and contextual chat interactions
- **Custom Commands**: Moderators can create custom commands
- **Event Responses**: Special messages for follows, subs, raids
- **Question Detection**: Automatically identifies and answers questions

### Automatic Token Management
- Self-healing token refresh system
- No manual token updates needed
- Automatic .env file updates
- Error recovery and retry mechanism

## Setup

### Prerequisites
- Node.js 18 or higher
- pnpm (recommended) or npm
- Twitch Developer Account
- OpenAI API Key (for AI features)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd chatbot
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a .env file:
```env
# Twitch Bot Credentials
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_BOT_CLIENT_ID=your_client_id
TWITCH_BOT_CLIENT_SECRET=your_client_secret
TWITCH_BOT_ACCESS_TOKEN=your_access_token
TWITCH_BOT_REFRESH_TOKEN=your_refresh_token
TWITCH_OAUTH_TOKEN=oauth:your_token

# Channel to Monitor
TWITCH_CHANNEL=your_channel_name

# OpenAI (for AI features)
OPENAI_API_KEY=your_openai_key
```

### Getting Twitch Credentials

1. Create a Twitch Application:
   - Go to [Twitch Developer Console](https://dev.twitch.tv/console)
   - Create a New Application
   - Set OAuth Redirect URL to `http://localhost:3000`
   - Note the Client ID and Client Secret

2. Get Initial Tokens:
```bash
# Run the auth server
node src/auth/auth-server.js

# In another terminal, get the auth URL
node src/auth/get-auth-url.js

# Open the URL in browser and authorize
# The tokens will be displayed in the terminal
```

3. Update your .env file with the tokens

### Running the Bot

1. Start the bot:
```bash
pnpm start
```

2. The bot will automatically:
   - Connect to your Twitch channel
   - Start monitoring chat
   - Begin collecting analytics
   - Handle token refreshes

## Commands

### Broadcaster Commands
- `!insights` - Get stream analytics and growth recommendations
- `!stats` - View current stream statistics
- `!besttime` - See optimal streaming times
- `!history` - View stream history and performance

### Moderator Commands
- `!trivia [category]` - Start a trivia game
- `!wordchain` - Start a word chain game
- `!minigame [scramble|riddle]` - Start a mini game
- `!addcom [command] [response]` - Create custom command
- `!delcom [command]` - Remove custom command

### User Commands
- `!songrequest [song]` - Request a song
- `!queue` - View song queue
- `!commands` - List available commands

## Architecture

```
src/
├── auth/           # Authentication handling
├── bot/            # Core bot functionality
│   ├── commands/   # Command implementations
│   ├── analytics.js    # Viewer tracking
│   ├── channelPoints.js # Channel point rewards
│   └── chatInteraction.js # Chat response system
├── events/         # Event handling
├── spotify/        # Music integration
├── overlays/       # Stream overlay system
├── utils/          # Utility functions
└── templates/      # Message templates
```

## Development

### Adding New Commands

1. Create a new file in `src/bot/commands/`:
```javascript
export function handleNewCommand(username, args, userLevel) {
  // Command implementation
  return {
    success: true,
    message: 'Command response'
  };
}
```

2. Add to `src/bot/commands/index.js`:
```javascript
export { handleNewCommand } from './newCommand.js';
```

3. Add case in `src/bot/bot.js`:
```javascript
case '!newcommand':
  response = await handleNewCommand(tags.username, args, tags.mod ? 'mod' : 'user');
  break;
```

### Adding Channel Point Rewards

1. Add new reward in `src/bot/channelPoints.js`:
```javascript
'New Reward': {
  enabled: true,
  cost: 1000,
  userCooldown: 300,
  handler: 'newRewardHandler'
}
```

2. Implement handler function:
```javascript
async handleNewReward(input, username) {
  // Reward implementation
  return {
    success: true,
    message: 'Reward response'
  };
}
```

## Error Handling

The bot includes comprehensive error handling:

1. **Token Management**
   - Automatic refresh on expiration
   - Retry failed operations
   - Environment variable updates

2. **API Rate Limiting**
   - Cooldown system
   - Queue management
   - Retry mechanisms

3. **Connection Issues**
   - Automatic reconnection
   - State recovery
   - Error logging

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - See LICENSE file for details

## Configuration Details

### Environment Variables
```env
# Required
TWITCH_BOT_USERNAME     # Your bot's Twitch username
TWITCH_BOT_CLIENT_ID    # From Twitch Developer Console
TWITCH_BOT_CLIENT_SECRET # From Twitch Developer Console
TWITCH_CHANNEL         # Your channel name (without #)
OPENAI_API_KEY         # From OpenAI dashboard

# Auto-managed (don't set manually)
TWITCH_BOT_ACCESS_TOKEN  # Managed by token system
TWITCH_BOT_REFRESH_TOKEN # Managed by token system
TWITCH_OAUTH_TOKEN      # Managed by token system
```

### Chat Game Settings
You can customize game settings in `src/bot/commands/games.js`:
```javascript
// Trivia settings
TRIVIA_TIME_LIMIT = 30000;  // 30 seconds
TRIVIA_CATEGORIES = ['Gaming', 'Movies', ...];

// Word Chain settings
WORD_CHAIN_MIN_LENGTH = 3;  // Minimum word length
WORD_CHAIN_MAX_TIME = 300000;  // 5 minutes
WORD_CHAIN_MAX_WORDS = 30;  // Maximum chain length
```

### Analytics Settings
Customize analytics in `src/bot/analytics.js`:
```javascript
UPDATE_INTERVAL = 5 * 60 * 1000;  // Data update frequency
RETENTION_THRESHOLD = 0.1;  // Viewer retention goal
SCHEDULE_CONSISTENCY_GOAL = 0.7;  // Schedule consistency target
```

## Common Issues & Solutions

### Token Refresh Issues
If you encounter token problems:
1. Check your Twitch Developer Console credentials
2. Ensure your bot account has proper permissions
3. The bot will automatically attempt to refresh invalid tokens
4. Check logs for specific error messages

### Connection Problems
If the bot disconnects:
1. It will automatically attempt to reconnect
2. Check your internet connection
3. Verify Twitch API status
4. Check rate limits in logs

### Game Issues
If games aren't working:
1. Verify moderator permissions
2. Check OpenAI API key for AI-generated content
3. Ensure proper command syntax
4. Check cooldown periods

## Performance Optimization

### Memory Usage
- The bot uses caching for analytics
- Old data is automatically cleaned up
- Stream history is limited to 30 days
- Inactive user data is pruned

### API Rate Limits
- Built-in cooldown system
- Request queuing
- Batch processing for analytics
- Cache system for frequent requests

## Security Considerations

1. Token Security
   - Never share your .env file
   - Tokens are automatically managed
   - Access tokens are regularly rotated
   - Refresh tokens are securely stored

2. API Keys
   - Keep OpenAI key secure
   - Use appropriate rate limits
   - Monitor API usage
   - Rotate keys periodically

3. Bot Permissions
   - Use minimal required scopes
   - Regular security audits
   - Monitor bot activity
   - Log suspicious behavior

## Support

For issues and feature requests:
1. Check the Common Issues section above
2. Search existing GitHub issues
3. Create a new issue with:
   - Detailed description
   - Steps to reproduce
   - Relevant logs
   - Environment details

## Acknowledgments

- [Twitch API](https://dev.twitch.tv/docs)
- [OpenAI GPT-3.5](https://openai.com/gpt-3)
- [TMI.js](https://github.com/tmijs/tmi.js)
- [Twurple](https://twurple.js.org)
- All contributors and users

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.
