# Twitch Bot

A modular Twitch bot designed to enhance stream engagement and automate streamer tasks.

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
│   ├── bot.js
│   └── twitchClient.js
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

├── logs/          # Log files
└── tests/         # Test files and utilities
```

## Features

- Twitch chat integration
- Spotify music control
- Stream overlays
- Custom alerts
- OpenAI integration
- Automated responses
- Event handling
- Logging system

## Setup

[Setup instructions would go here]

## Usage

[Usage instructions would go here]

## Development

[Development instructions would go here]

## Testing

[Testing instructions would go here]

## License

[License information would go here]
