#!/usr/bin/env node

import { Command } from 'commander';
import 'dotenv/config';
import openai from './api/config-openai-official.js';
import path from 'path';
import fs from 'fs';
import { splitAudioIfNeeded, cleanupChunks } from './utils/audioSplitter.js';

const program = new Command();
const transcribe = program.command('transcribe');
transcribe.description('CLI tool for transcribing multi-speaker audio files').version('1.0.0');

// Define the command syntax, including the required audio file path argument
// and the optional --lang, --format, --model, --chunk-duration, and --prompt flags
transcribe
	.argument('<audio-file-path>', 'Path to the audio file to be transcribed')
	.argument('[output-path]', 'Optional path to the destination where the text file will be saved')
	.option('--lang <language>', 'Set the language of the audio content', 'uk')
	.option('--format <format>', 'Define the output format of the transcription', 'text')
	.option('--model <model>', 'Set the transcription model (gpt-4o-transcribe, gpt-4o-mini-transcribe, whisper-1)', 'gpt-4o-transcribe')
	.option('--chunk-duration <seconds>', 'Split audio into chunks of specified duration in seconds (optional)', parseFloat)
	.option('--prompt <text>', 'Initial prompt to guide transcription style/terminology', '')
	.action((audioFilePath, outputPath, options) => {
		const absoluteAudioFilePath = path.resolve(audioFilePath);
		const audioFileExtName = path.extname(audioFilePath);
		const audioFileName = path.basename(audioFilePath, audioFileExtName);
		let textFilePath = '';
		const textFileExt = options.format === 'text' ? 'txt' : options.format;

		if (!outputPath) {
			textFilePath = path.join(path.dirname(path.resolve(audioFilePath)), `${audioFileName}.${textFileExt}`);
		} else {
			textFilePath = path.join(path.resolve(outputPath), `${audioFileName}.${textFileExt}`);
		}
		// This is where you will handle the transcription logic
		console.log(`Transcribing file: ${audioFilePath}`);
		console.log(`Language: ${options.lang}`);
		console.log(`Format: ${options.format}`);
		console.log(`Model: ${options.model}`);
		if (options.chunkDuration) {
			console.log(`Chunk duration: ${options.chunkDuration} seconds`);
		}
		if (options.prompt) {
			console.log(`Initial prompt: ${options.prompt}`);
		}

		whisperTranscribe(absoluteAudioFilePath, textFilePath, options.lang, options.format, options.model, options.chunkDuration, options.prompt);
	});

// Parse the command-line arguments only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	program.parse(process.argv);
}

// Write the text to a file
export const writeTextToFile = (text, destinationPath) => {
	fs.writeFile(destinationPath, text, err => {
		if (err) {
			console.error('An error occurred when write ext to file:', err);
		} else {
			console.log('Text written to file successfully.');
		}
	});
};

/**
 * Extracts a prompt from the end of a transcript, starting from a sentence boundary
 * @param {string} transcript - The transcript to extract from
 * @param {number} maxWords - Maximum number of words to include (default: 200)
 * @returns {string} Extracted prompt starting from a sentence boundary
 */
export function extractPromptFromTranscript(transcript, maxWords = 200) {
	if (!transcript || typeof transcript !== 'string') {
		return '';
	}

	// Split into words
	const words = transcript.trim().split(/\s+/);

	// If transcript is shorter than maxWords, return as is
	if (words.length <= maxWords) {
		return transcript.trim();
	}

	// Take the last maxWords words
	const lastWords = words.slice(-maxWords).join(' ');

	// Find the first sentence boundary (. ! ?) to start from a complete sentence
	const sentenceBoundaries = ['. ', '! ', '? '];
	let firstBoundaryIndex = -1;

	for (const boundary of sentenceBoundaries) {
		const index = lastWords.indexOf(boundary);
		if (index !== -1 && (firstBoundaryIndex === -1 || index < firstBoundaryIndex)) {
			firstBoundaryIndex = index;
		}
	}

	// If found a sentence boundary, start from after it
	if (firstBoundaryIndex !== -1) {
		return lastWords.substring(firstBoundaryIndex + 2).trim();
	}

	// If no sentence boundary found, return the last words as is
	return lastWords.trim();
}

/**
 * Transcribes a single audio chunk
 * @param {string} audioFilePath - Path to the audio file
 * @param {string} lang - Language code
 * @param {string} format - Response format
 * @param {string} model - Model to use for transcription
 * @param {string} promptText - Optional prompt for context (default: '')
 */
async function transcribeChunk(audioFilePath, lang, format, model, promptText = '') {
	const transcription = await openai.audio.transcriptions.create({
		file: fs.createReadStream(audioFilePath),
		model: model,
		language: lang,
		prompt: promptText,
		response_format: format,
	});
	return transcription;
}

/**
 * Main transcription function with optional duration-based audio chunking
 * @param {string} audioFilePath - Path to the audio file
 * @param {string} outputPath - Path to save the transcription
 * @param {string} lang - Language code
 * @param {string} format - Response format
 * @param {string} model - Model to use for transcription
 * @param {number} chunkDuration - Optional chunk duration in seconds
 * @param {string} initialPrompt - Optional initial prompt for first chunk (default: '')
 */
export async function whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration, initialPrompt = '') {
	try {
		console.log('Start transcribing...');

		// Split audio if chunk duration is specified
		const { chunks, wasSplit, originalFile } = await splitAudioIfNeeded(audioFilePath, chunkDuration);

		let finalTranscription = '';
		let promptForNextChunk = initialPrompt;

		if (wasSplit) {
			console.log(`Processing ${chunks.length} chunks...`);

			// Transcribe each chunk
			for (let i = 0; i < chunks.length; i++) {
				console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);

				// Use prompt from previous chunk for context
				const chunkTranscription = await transcribeChunk(chunks[i], lang, format, model, promptForNextChunk);

				// For text format, concatenate with spacing
				if (format === 'text') {
					finalTranscription += (i > 0 ? ' ' : '') + chunkTranscription;

					// Extract prompt from this chunk for the next one
					promptForNextChunk = extractPromptFromTranscript(chunkTranscription, 200);
				} else {
					// For other formats (json, srt, etc.), need special handling
					// For now, we'll store them separately or merge them
					finalTranscription += chunkTranscription + '\n';

					// For non-text formats, try to extract text for prompt (if available)
					// Otherwise, use empty prompt
					promptForNextChunk = '';
				}
			}

			// Clean up temporary chunk files
			await cleanupChunks(chunks, originalFile);
		} else {
			// Single file transcription (original behavior)
			finalTranscription = await transcribeChunk(audioFilePath, lang, format, model, initialPrompt);
		}

		writeTextToFile(finalTranscription, outputPath);
		console.log('Transcription complete!');
	} catch (error) {
		console.log(error.message);
		process.exit(1);
	}
}
