#!usr/bin/env node

import { Command } from 'commander';
import 'dotenv/config';
import openai from './api/config-openai-official.js';
import path from 'path';
import fs from 'fs';

const program = new Command();
const transcribeCommand = program.command('transcribe');
transcribeCommand.description('CLI tool for transcribing multi-speaker audio files').version('1.0.0');

// Define the command syntax, including the required audio file path argument
// and the optional --lang and --format flags
transcribeCommand
	.argument('<audio-file-path>', 'Path to the audio file to be transcribed')
	.option('--lang <language>', 'Set the language of the audio content', 'en')
	.option('--format <format>', 'Define the output format of the transcription', 'txt')
	.action((audioFilePath, options) => {
		const source = path.resolve(audioFilePath)
		// This is where you will handle the transcription logic
		console.log(`Transcribing file: ${audioFilePath}`);
		console.log(`Language: ${options.lang}`);
		console.log(`Format: ${options.format}`);
		

		// Here, you would add the code to validate the audio file path and call the transcription function
	});

// Parse the command-line arguments
program.parse(process.argv);

// const sourceDirPath = path.resolve('../source');
// const outputDirPath = path.resolve('../texts');
// const filename = 'audio1986539416';
// const audioFilePath = path.join(sourceDirPath, `${filename}.m4a`);
// const textFilePath = path.join(outputDirPath, `${filename}.txt`);

// // Write the text to a file
// const writeTextToFile = text => {
// 	fs.writeFile(textFilePath, text, err => {
// 		if (err) {
// 			console.error('An error occurred:', err);
// 		} else {
// 			console.log('Text written to file successfully.');
// 		}
// 	});
// };

// async function transcribe(audioFilePath,lang,format) {

// 	try {
// 		const transcription = await openai.audio.transcriptions.create({
// 			file: fs.createReadStream(audioFilePath),
// 			model: 'whisper-1',
// 			language: lang,
// 			prompt: '',
// 			response_format: format,
// 		});

// 		writeTextToFile(transcription);
// 	} catch (error) {
// 		console.log(error.message);
// 		process.exit(1);
// 	}
// }
