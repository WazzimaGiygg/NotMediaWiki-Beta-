import { GoogleGenAI } from '@google/genai';

/**
 * Shared server-side Gemini SDK client configured with required telemetry header.
 * Never import or instantiate @google/genai in client/browser bundles.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}
