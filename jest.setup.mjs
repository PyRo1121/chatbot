import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';

// Setup TextEncoder/Decoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
