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
// and the optional --lang and --format flags
transcribe
	.argument('<audio-file-path>', 'Path to the audio file to be transcribed')
	.argument('[output-path]', 'Optional path to the destination where the text file will be saved')
	.option('--lang <language>', 'Set the language of the audio content', 'uk')
	.option('--format <format>', 'Define the output format of the transcription', 'text')
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

		whisperTranscribe(absoluteAudioFilePath, textFilePath, options.lang, options.format);
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
 * Transcribes a single audio chunk
 */
async function transcribeChunk(audioFilePath, lang, format) {
	const prompt = '';
	const transcription = await openai.audio.transcriptions.create({
		file: fs.createReadStream(audioFilePath),
		model: 'gpt-4o-transcribe',
		language: lang,
		prompt: prompt,
		response_format: format,
	});
	return transcription;
}

/**
 * Main transcription function with automatic audio splitting for large files
 */
export async function whisperTranscribe(audioFilePath, outputPath, lang, format) {
	try {
		console.log('Start transcribing...');

		// Split audio if needed (files larger than 25MB)
		const { chunks, wasSplit, originalFile } = await splitAudioIfNeeded(audioFilePath);

		let finalTranscription = '';

		if (wasSplit) {
			console.log(`Processing ${chunks.length} chunks...`);

			// Transcribe each chunk
			for (let i = 0; i < chunks.length; i++) {
				console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
				const chunkTranscription = await transcribeChunk(chunks[i], lang, format);

				// For text format, concatenate with spacing
				if (format === 'text') {
					finalTranscription += (i > 0 ? ' ' : '') + chunkTranscription;
				} else {
					// For other formats (json, srt, etc.), need special handling
					// For now, we'll store them separately or merge them
					finalTranscription += chunkTranscription + '\n';
				}
			}

			// Clean up temporary chunk files
			await cleanupChunks(chunks, originalFile);
		} else {
			// Single file transcription (original behavior)
			finalTranscription = await transcribeChunk(audioFilePath, lang, format);
		}

		writeTextToFile(finalTranscription, outputPath);
		console.log('Transcription complete!');
	} catch (error) {
		console.log(error.message);
		process.exit(1);
	}
}
