#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ProgressBar from 'progress';

dotenv.config();

ffmpeg.setFfmpegPath(ffmpegPath);

// Create a new Command instance
const program = new Command();

program
	.command('transcribe <audio-file-path> [output-path]')
	.description('Transcribe an audio file')
	.option('--lang <language>', 'Set the language of the audio content', 'uk')
	.option('--format <format>', 'Define the output format of the transcription', 'text')
	.action(async (audioFilePath, outputPath, options) => {
		const convertedFilePath = 'converted.wav';
		const outputFilePath = outputPath || 'transcription.txt';

		// Function to convert audio to the correct format
		async function convertAudio(inputPath, outputPath) {
			return new Promise((resolve, reject) => {
				ffmpeg(inputPath)
					.outputOptions([
						'-ar 16000', // Set audio sampling rate to 16 kHz
						'-ac 1', // Set number of audio channels to 1 (mono)
						'-f wav', // Output format
					])
					.save(outputPath)
					.on('end', () => {
						console.log('Audio conversion complete.');
						resolve();
					})
					.on('error', err => {
						console.error('Error converting audio:', err);
						reject(err);
					});
			});
		}

		// Function to get the duration of an audio file
		function getAudioDuration(filePath) {
			return new Promise((resolve, reject) => {
				ffmpeg.ffprobe(filePath, (err, metadata) => {
					if (err) {
						return reject(err);
					}
					const duration = metadata.format.duration;
					resolve(duration);
				});
			});
		}

		// Function to split audio into chunks if necessary
		async function splitAudio(inputPath) {
			const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB in bytes

			// Get the file size
			const stats = fs.statSync(inputPath);
			const fileSize = stats.size;

			if (fileSize <= MAX_FILE_SIZE) {
				// No need to split
				return [inputPath];
			} else {
				// Need to split the audio
				const duration = await getAudioDuration(inputPath);

				// Calculate number of chunks needed
				const numChunks = Math.ceil(fileSize / MAX_FILE_SIZE);

				// Calculate chunk duration
				const chunkDuration = duration / numChunks;

				// Generate chunk file paths
				const chunkFilePaths = [];

				for (let i = 0; i < numChunks; i++) {
					const startTime = i * chunkDuration;
					const outputPath = `chunk_${i}.wav`;
					chunkFilePaths.push(outputPath);

					await new Promise((resolve, reject) => {
						ffmpeg(inputPath)
							.seekInput(startTime)
							.duration(chunkDuration + 1) // Add 1 second to ensure overlap
							.output(outputPath)
							.on('end', resolve)
							.on('error', reject)
							.run();
					});
				}

				return chunkFilePaths;
			}
		}

		// Function to transcribe audio using OpenAI Whisper API via OpenAI SDK
		async function transcribeAudio(filePath, language) {
			try {
				const response = await openai.createTranscription(
					fs.createReadStream(filePath),
					'whisper-1',
					null, // Prompt (optional)
					'verbose_json', // Response format
					0, // Temperature
					language // Language code
				);
				return response.data;
			} catch (error) {
				console.error('Error during transcription:', error.response?.data || error.message);
				throw error;
			}
		}

		// Function to detect speaker changes based on pauses in the transcript
		function identifySpeakers(transcript) {
			const segments = transcript.segments;
			let speaker = 1;
			let lastEndTime = 0;
			const output = [];

			segments.forEach(segment => {
				const pauseDuration = segment.start - lastEndTime;
				if (pauseDuration > 1.0) {
					// Assume speaker changes if pause is greater than 1 second
					speaker = speaker === 1 ? 2 : 1;
				}
				output.push({
					speaker: `Speaker ${speaker}`,
					start: segment.start,
					end: segment.end,
					text: segment.text.trim(),
				});
				lastEndTime = segment.end;
			});

			return output;
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
					const identifiedSpeakers = identifySpeakers(transcription);
					fullTranscription = fullTranscription.concat(identifiedSpeakers);
					progressBar.tick();

					// Delete the chunk file to save space
					fs.unlinkSync(chunk);
				}

				// Delete the converted file
				fs.unlinkSync(convertedFilePath);

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
