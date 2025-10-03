import fs from 'fs';
import openai from './config-openai-official.js';

// Function to transcribe audio using OpenAI Whisper API via OpenAI SDK
export async function transcribeAudio(filePath, language, format) {
	const prompt =
		'Червоний Хрест, Товариство Червоного Хреста України,ТЧХУ, обласна організація, НацКом, НацКомом, Національний комітет, міжрегіональні офіси, МРО, місцеві, беніфіціари, ризики, безпека, Тернопіль, Тернопільська обласна організація. офіси!?-';
	try {
		const response = await openai.audio.transcriptions.create({
			file: fs.createReadStream(filePath),
			model: 'whisper-1',
			prompt: prompt, // Prompt (optional)
			response_format: format, // Response format
			temperature: 0,
			language: language,
		});
		return response;
	} catch (error) {
		console.error('Error during transcription:', error.response?.data || error.message);
		throw error;
	}
}
