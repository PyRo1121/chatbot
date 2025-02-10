import { TextEncoder, TextDecoder } from 'util';
import dotenv from 'dotenv';
import { global } from '@jest/globals';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Setup TextEncoder/Decoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Setup global mocks if needed
// jest.mock('some-module', () => ({ ... }));

// Add any additional setup code here
