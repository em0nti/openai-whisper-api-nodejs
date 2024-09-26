import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { OPENAI_API_WHISPER_INPUT_FILE_SIZE_RESTRICTION, AUDIO_OUTPUT_OPTIONS } from './constants.js';

ffmpeg.setFfmpegPath(ffmpegPath);

// Function to convert audio to the correct format
export async function convertAudio(inputPath, outputPath) {
	return new Promise((resolve, reject) => {
		ffmpeg(inputPath)
			.outputOptions([
				`-ar ${AUDIO_OUTPUT_OPTIONS.RATE}`, // Set audio sampling rate to 64 kHz
				`-ac ${AUDIO_OUTPUT_OPTIONS.CHANNELS}`, // Set number of audio channels to 1 (mono)
				`-f ${AUDIO_OUTPUT_OPTIONS.FORMAT}`, // Output format
				`-b:a ${AUDIO_OUTPUT_OPTIONS.BITRATE}`,
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
export function getAudioDuration(filePath) {
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
export async function splitAudio(inputPath) {
	const MAX_FILE_SIZE = OPENAI_API_WHISPER_INPUT_FILE_SIZE_RESTRICTION * 1024 * 1024; // 25 MB in bytes

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
			const outputPath = `./temp/chunk_${i}.${AUDIO_OUTPUT_OPTIONS.FORMAT}`;
			chunkFilePaths.push(outputPath);

			await new Promise((resolve, reject) => {
				ffmpeg(inputPath)
					.seekInput(startTime)
					.duration(chunkDuration + 1) // Add 1 second to ensure overlap
					.outputOptions([
						`-b:a ${AUDIO_OUTPUT_OPTIONS.BITRATE}`,
						`-f ${AUDIO_OUTPUT_OPTIONS.FORMAT}`, // Output format
					])
					.output(outputPath)
					.on('end', resolve)
					.on('error', reject)
					.run();
			});
		}

		return chunkFilePaths;
	}
}
