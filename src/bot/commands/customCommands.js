<<<<<<< HEAD
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../../utils/logger.js';

class CustomCommands {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/custom_commands.json');
    this.commands = this.loadCommands();
  }

  loadCommands() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with empty commands object
      this.saveCommands({});
      return {};
    } catch (error) {
      logger.error('Error loading custom commands:', error);
      return {};
    }
  }

  saveCommands(commands = this.commands) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(commands, null, 2));
    } catch (error) {
      logger.error('Error saving custom commands:', error);
    }
  }

  addCommand(commandName, response, userLevel = 'everyone') {
    const name = commandName.startsWith('!') ? commandName : `!${commandName}`;

    this.commands[name] = {
      response,
      userLevel, // everyone, mod, vip, broadcaster
      createdAt: new Date().toISOString(),
      uses: 0,
    };

    this.saveCommands();
    return true;
  }

  removeCommand(commandName) {
    const name = commandName.startsWith('!') ? commandName : `!${commandName}`;

    if (this.commands[name]) {
      delete this.commands[name];
      this.saveCommands();
      return true;
    }
    return false;
  }

  getCommand(commandName) {
    const name = commandName.startsWith('!') ? commandName : `!${commandName}`;
    return this.commands[name];
  }

  listCommands() {
    return Object.keys(this.commands);
  }

  handleCommand(commandName, userLevel = 'everyone') {
    const command = this.getCommand(commandName);

    if (!command) {
      return null;
    }

    // Check user level permissions
    if (command.userLevel !== 'everyone') {
      if (command.userLevel === 'mod' && userLevel !== 'mod' && userLevel !== 'broadcaster') {
        return { success: false, message: 'This command is for moderators only!' };
      }
      if (command.userLevel === 'broadcaster' && userLevel !== 'broadcaster') {
        return { success: false, message: 'This command is for the broadcaster only!' };
      }
    }

    // Update usage count
    command.uses++;
    this.saveCommands();

    return {
      success: true,
      message: command.response,
    };
  }
}

const customCommands = new CustomCommands();
export default customCommands;

export function handleAddCommand(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can add commands!',
    };
  }

  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: !addcom [command] [response]',
    };
  }

  const [commandName, ...responseWords] = args;
  const response = responseWords.join(' ');

  if (customCommands.addCommand(commandName, response, 'everyone')) {
    return {
      success: true,
      message: `Command ${commandName} has been added!`,
    };
  }

  return {
    success: false,
    message: 'Failed to add command.',
  };
}

export function handleRemoveCommand(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can remove commands!',
    };
  }

  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: !delcom [command]',
    };
  }

  const [commandName] = args;

  if (customCommands.removeCommand(commandName)) {
    return {
      success: true,
      message: `Command ${commandName} has been removed!`,
    };
  }

  return {
    success: false,
    message: 'Command not found.',
  };
}

export function handleListCommands() {
  const commands = customCommands.listCommands();
  if (commands.length === 0) {
    return {
      success: true,
      message: 'No custom commands have been added yet.',
    };
  }

  return {
    success: true,
    message: `Available commands: ${commands.join(', ')}`,
  };
}

export { customCommands };
=======
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../../utils/logger.js';

class CustomCommands {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/custom_commands.json');
    this.commands = this.loadCommands();
  }

  loadCommands() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with empty commands object
      this.saveCommands({});
      return {};
    } catch (error) {
      logger.error('Error loading custom commands:', error);
      return {};
    }
  }

  saveCommands(commands = this.commands) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(commands, null, 2));
    } catch (error) {
      logger.error('Error saving custom commands:', error);
    }
  }

  addCommand(commandName, response, userLevel = 'everyone') {
    const name = commandName.startsWith('!') ? commandName : `!${commandName}`;

    this.commands[name] = {
      response,
      userLevel, // everyone, mod, vip, broadcaster
      createdAt: new Date().toISOString(),
      uses: 0,
    };

    this.saveCommands();
    return true;
  }

  removeCommand(commandName) {
    const name = commandName.startsWith('!') ? commandName : `!${commandName}`;

    if (this.commands[name]) {
      delete this.commands[name];
      this.saveCommands();
      return true;
    }
    return false;
  }

  getCommand(commandName) {
    const name = commandName.startsWith('!') ? commandName : `!${commandName}`;
    return this.commands[name];
  }

  listCommands() {
    return Object.keys(this.commands);
  }

  handleCommand(commandName, userLevel = 'everyone') {
    const command = this.getCommand(commandName);

    if (!command) {
      return null;
    }

    // Check user level permissions
    if (command.userLevel !== 'everyone') {
      if (command.userLevel === 'mod' && userLevel !== 'mod' && userLevel !== 'broadcaster') {
        return { success: false, message: 'This command is for moderators only!' };
      }
      if (command.userLevel === 'broadcaster' && userLevel !== 'broadcaster') {
        return { success: false, message: 'This command is for the broadcaster only!' };
      }
    }

    // Update usage count
    command.uses++;
    this.saveCommands();

    return {
      success: true,
      message: command.response,
    };
  }
}

const customCommands = new CustomCommands();
export default customCommands;

export function handleAddCommand(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can add commands!',
    };
  }

  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: !addcom [command] [response]',
    };
  }

  const [commandName, ...responseWords] = args;
  const response = responseWords.join(' ');

  if (customCommands.addCommand(commandName, response, 'everyone')) {
    return {
      success: true,
      message: `Command ${commandName} has been added!`,
    };
  }

  return {
    success: false,
    message: 'Failed to add command.',
  };
}

export function handleRemoveCommand(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can remove commands!',
    };
  }

  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: !delcom [command]',
    };
  }

  const [commandName] = args;

  if (customCommands.removeCommand(commandName)) {
    return {
      success: true,
      message: `Command ${commandName} has been removed!`,
    };
  }

  return {
    success: false,
    message: 'Command not found.',
  };
}

export function handleListCommands() {
  const commands = customCommands.listCommands();
  if (commands.length === 0) {
    return {
      success: true,
      message: 'No custom commands have been added yet.',
    };
  }

  return {
    success: true,
    message: `Available commands: ${commands.join(', ')}`,
  };
}

export { customCommands };
>>>>>>> origin/master
