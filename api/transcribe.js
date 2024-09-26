import fs from 'fs';
import openai from './config-openai-official.js';

// Function to transcribe audio using OpenAI Whisper API via OpenAI SDK
export async function transcribeAudio(filePath, language, format) {
	const prompt = 'Товариство Червоного Хреста України,ТЧХУ,БРАВО, САФ, БОКА.!?-';
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
