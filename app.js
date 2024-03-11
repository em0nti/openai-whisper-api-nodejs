#!/usr/bin/env node

import { Command } from 'commander';
import 'dotenv/config';
import openai from './api/config-openai-official.js';
import path from 'path';
import fs from 'fs';

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

// Parse the command-line arguments
program.parse(process.argv);

// Write the text to a file
const writeTextToFile = (text, destinationPath) => {
	fs.writeFile(destinationPath, text, err => {
		if (err) {
			console.error('An error occurred:', err);
		} else {
			console.log('Text written to file successfully.');
		}
	});
};

async function whisperTranscribe(audioFilePath, outputPath, lang, format) {
	const prompt = '';
	try {
		console.log('Start transcribing...');
		const transcription = await openai.audio.transcriptions.create({
			file: fs.createReadStream(audioFilePath),
			model: 'whisper-1',
			language: lang,
			prompt: prompt,
			response_format: format,
		});

		writeTextToFile(transcription, outputPath);
	} catch (error) {
		console.log(error.message);
		process.exit(1);
	}
}
