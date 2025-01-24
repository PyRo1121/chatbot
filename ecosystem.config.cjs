module.exports = {
  apps: [
    {
      name: 'twitch-bot',
      script: 'index.js',
      watch: ['src'],
      ignore_watch: ['node_modules', 'src/logs', '*.json'],
      watch_options: {
        followSymlinks: false,
      },
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      error_file: 'src/logs/pm2/error.log',
      out_file: 'src/logs/pm2/output.log',
      log_file: 'src/logs/pm2/combined.log',
      time: true,
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 10,
      node_args: '--experimental-modules --es-module-specifier-resolution=node',
      windowsHide: true,
      no_new_window: true,
      detached: true,
      kill_timeout: 5000,
      daemon_mode: true,
      force: true,
      silent: true,
      exec_mode: 'fork',
      cwd: 'C:/Users/olen/Documents/Stream/round 2/chatbot',
      interpreter: 'node',
    },
  ],
};
