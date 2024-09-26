#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import { transcribeAudio } from './api/transcribe.js';
import { convertAudio, splitAudio } from './helpers/audio-processing.js';

// Create a new Command instance
const program = new Command();

program
	.command('transcribe <audio-file-path> [output-path]')
	.description('Transcribe an audio file')
	.option('--lang <language>', 'Set the language of the audio content', 'uk')
	.option('--format <format>', 'Define the output format of the transcription', 'text')
	.action(async (audioFilePath, outputPath, options) => {
		const convertedFilePath = './temp/converted.mp3';
		const outputFilePath = outputPath || './temp/transcription.txt';

		// Main transcription process
		async function main() {
			try {
				// Step 1: Convert audio to correct format
				await convertAudio(audioFilePath, convertedFilePath);

				// Step 2: Split audio into chunks if necessary
				const audioChunks = await splitAudio(convertedFilePath);

				// Step 3: Transcribe each chunk and collect results
				const progressBar = new ProgressBar('Transcribing [:bar] :percent :etas', {
					total: audioChunks.length,
				});

				let fullTranscription = [];
				for (const chunk of audioChunks) {
					const transcription = await transcribeAudio(chunk, options.lang, options.format);
					fullTranscription = fullTranscription.concat(transcription);
					progressBar.tick();

					// Delete the chunk file to save space
					fs.unlinkSync(chunk);
				}

				// Delete the converted file
				if (fs.existsSync(convertedFilePath)) {
					fs.unlinkSync(convertedFilePath);
				}

				// Step 4: Output the transcription

				const content = fullTranscription
					.map(entry => {
						return `${entry}`;
					})
					.join('\n');
				fs.writeFileSync(outputFilePath, content, 'utf8');

				console.log(`Transcription complete. Output saved to ${outputFilePath}`);
			} catch (error) {
				console.error('An error occurred:', error);
			}
		}

		await main();
	});

// Parse the command-line arguments
program.parse(process.argv);
