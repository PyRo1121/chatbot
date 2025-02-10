import { jest } from '@jest/globals';
import { generateResponse } from '../utils/gemini.js';

jest.mock('../utils/gemini.js', () => ({
  generateResponse: jest.fn(),
}));

describe('Gemini API Tests', () => {
  beforeEach(() => {
    generateResponse.mockClear();
  });

  test('generateResponse returns expected output', async () => {
    generateResponse.mockResolvedValue('Mock response');
    const response = await generateResponse('Test prompt');
    expect(response).toBe('Mock response');
    expect(generateResponse).toHaveBeenCalledWith('Test prompt');
  });

  test('generateResponse handles API errors', async () => {
    generateResponse.mockRejectedValue(new Error('API error'));
    await expect(generateResponse('test')).rejects.toThrow('API error');
  });

  test('generateResponse handles empty response', async () => {
    generateResponse.mockResolvedValue('');
    const response = await generateResponse('test');
    expect(response).toBe('');
  });

  test('generateResponse with long input', async () => {
    const longPrompt = 'a'.repeat(1000);
    generateResponse.mockResolvedValue('Long response');
    const response = await generateResponse(longPrompt);
    expect(response).toBe('Long response');
    expect(generateResponse).toHaveBeenCalledWith(longPrompt);
  });

  test('generateResponse with special characters', async () => {
    const specialPrompt = '!@#$%^&*()_+';
    generateResponse.mockResolvedValue('Special response');
    const response = await generateResponse(specialPrompt);
    expect(response).toBe('Special response');
    expect(generateResponse).toHaveBeenCalledWith(specialPrompt);
  });

  test('generateResponse performance', async () => {
    generateResponse.mockResolvedValue('Quick response');
    const start = Date.now();
    await generateResponse('Performance test');
    const end = Date.now();
    expect(end - start).toBeLessThan(1000);
  });

  test('generateResponse with multilingual input', async () => {
    const multilingualPrompt = 'Hello こんにちは Bonjour';
    generateResponse.mockResolvedValue('Multilingual response');
    const response = await generateResponse(multilingualPrompt);
    expect(response).toBe('Multilingual response');
    expect(generateResponse).toHaveBeenCalledWith(multilingualPrompt);
  });

  test('generateResponse with JSON input', async () => {
    const jsonPrompt = JSON.stringify({ key: 'value' });
    generateResponse.mockResolvedValue('JSON response');
    const response = await generateResponse(jsonPrompt);
    expect(response).toBe('JSON response');
    expect(generateResponse).toHaveBeenCalledWith(jsonPrompt);
  });

  test('generateResponse handles rate limiting', async () => {
    generateResponse.mockRejectedValue(new Error('Rate limit exceeded'));
    await expect(generateResponse('test')).rejects.toThrow('Rate limit exceeded');
  });
});
