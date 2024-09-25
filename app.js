#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import ProgressBar from 'progress';
import openai from './api/config-openai-official.js';
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

		// Function to transcribe audio using OpenAI Whisper API via OpenAI SDK
		async function transcribeAudio(filePath, language) {
			try {
				const response = await openai.audio.transcriptions.create({
					file: fs.createReadStream(filePath),
					model: 'whisper-1',
					prompt: '', // Prompt (optional)
					response_format: 'verbose_json', // Response format
					temperature: 0,
					language: language,
				});
				return response;
			} catch (error) {
				console.error('Error during transcription:', error.response?.data || error.message);
				throw error;
			}
		}

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
					const transcription = await transcribeAudio(chunk, options.lang);
					fullTranscription = fullTranscription.concat(transcription);
					progressBar.tick();

					// Delete the chunk file to save space
					fs.unlinkSync(chunk);
				}

				// Delete the converted file
				//fs.unlinkSync(convertedFilePath);

				// Step 4: Output the transcription
				if (options.format === 'json') {
					fs.writeFileSync(outputFilePath, JSON.stringify(fullTranscription, null, 2), 'utf8');
				} else if (options.format === 'srt') {
					const srtContent = fullTranscription
						.map((entry, index) => {
							const startTime = new Date(entry.start * 1000)
								.toISOString()
								.substr(11, 12)
								.replace('.', ',');
							const endTime = new Date(entry.end * 1000).toISOString().substr(11, 12).replace('.', ',');
							return `${index + 1}\n${startTime} --> ${endTime}\n${entry.speaker}: ${entry.text}\n`;
						})
						.join('\n');
					fs.writeFileSync(outputFilePath, srtContent, 'utf8');
				} else {
					// Default to plain text format
					const textContent = fullTranscription
						.map(entry => {
							return `${entry.speaker}: ${entry.text}`;
						})
						.join('\n');
					fs.writeFileSync(outputFilePath, textContent, 'utf8');
				}

				console.log(`Transcription complete. Output saved to ${outputFilePath}`);
			} catch (error) {
				console.error('An error occurred:', error);
			}
		}

		await main();
	});

// Parse the command-line arguments
program.parse(process.argv);
