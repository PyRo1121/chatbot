import { handleRoast } from './roast.js';
import { handlePing } from './ping.js';
import {
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  processSongQueue,
  songQueue,
} from './queue.js';

export {
  handleRoast,
  handlePing,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  processSongQueue,
  songQueue,
};

export const commandList =
  '!ping, !songrequest, !queue, !queueclear, !queueremove, !roast, !trivia, !wordchain, !minigame [scramble|riddle], !insights (broadcaster only)';
