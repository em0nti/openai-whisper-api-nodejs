import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Set ffmpeg and ffprobe paths from the installers
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const unlink = promisify(fs.unlink);

/**
 * Detects silence periods in an audio file using FFmpeg's silencedetect filter
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<Array>} Array of silence periods with start and end times
 */
export async function detectSilence(audioFilePath) {
	return new Promise((resolve, reject) => {
		const silencePeriods = [];
		let stderrOutput = '';

		ffmpeg(audioFilePath)
			.audioFilters('silencedetect=noise=-30dB:d=0.5')
			.format('null')
			.on('stderr', (stderrLine) => {
				stderrOutput += stderrLine + '\n';
			})
			.on('end', () => {
				// Parse silence detection output
				const silenceStartRegex = /silence_start: ([\d.]+)/g;
				const silenceEndRegex = /silence_end: ([\d.]+)/g;

				const starts = [...stderrOutput.matchAll(silenceStartRegex)].map(m => parseFloat(m[1]));
				const ends = [...stderrOutput.matchAll(silenceEndRegex)].map(m => parseFloat(m[1]));

				// Pair up starts and ends
				for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
					silencePeriods.push({
						start: starts[i],
						end: ends[i],
						duration: ends[i] - starts[i]
					});
				}

				resolve(silencePeriods);
			})
			.on('error', (err) => {
				reject(new Error(`Silence detection failed: ${err.message}`));
			})
			.output('-')
			.run();
	});
}

/**
 * Gets the duration of an audio file in seconds
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<number>} Duration in seconds
 */
export async function getAudioDuration(audioFilePath) {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
			if (err) {
				reject(new Error(`Failed to get audio duration: ${err.message}`));
			} else {
				resolve(metadata.format.duration);
			}
		});
	});
}

/**
 * Calculates optimal split points based on desired chunk duration and silence periods
 * @param {Array} silencePeriods - Array of detected silence periods
 * @param {number} duration - Total duration of the audio file
 * @param {number} chunkDuration - Desired duration per chunk in seconds
 * @returns {Array} Array of split points (timestamps in seconds)
 */
export function calculateSplitPoints(silencePeriods, duration, chunkDuration) {
	const splitPoints = [];
	let currentTime = 0;

	while (currentTime < duration) {
		const nextTargetTime = currentTime + chunkDuration;

		if (nextTargetTime >= duration) {
			break; // Last chunk
		}

		// Find the nearest silence period to the target time
		let bestSplitTime = nextTargetTime;
		let minDistance = Infinity;

		for (const silence of silencePeriods) {
			const silenceMidpoint = (silence.start + silence.end) / 2;
			const distance = Math.abs(silenceMidpoint - nextTargetTime);

			// Only consider silence periods within ±30 seconds of target
			if (distance < minDistance && distance < 30) {
				minDistance = distance;
				bestSplitTime = silenceMidpoint;
			}
		}

		splitPoints.push(bestSplitTime);
		currentTime = bestSplitTime;
	}

	return splitPoints;
}

/**
 * Splits an audio file into chunks at specified time points
 * @param {string} audioFilePath - Path to the audio file
 * @param {Array} splitPoints - Array of timestamps (in seconds) where to split
 * @returns {Promise<Array>} Array of paths to the created chunk files
 */
export async function splitAudioFile(audioFilePath, splitPoints) {
	if (splitPoints.length === 0) {
		return [audioFilePath]; // No splitting needed
	}

	const dir = path.dirname(audioFilePath);
	const ext = path.extname(audioFilePath);
	const basename = path.basename(audioFilePath, ext);
	const chunkPaths = [];

	// Create chunks
	const timestamps = [0, ...splitPoints];
	const duration = await getAudioDuration(audioFilePath);

	for (let i = 0; i < timestamps.length; i++) {
		const startTime = timestamps[i];
		const endTime = i < timestamps.length - 1 ? timestamps[i + 1] : duration;
		const chunkPath = path.join(dir, `${basename}_chunk_${i + 1}${ext}`);

		await new Promise((resolve, reject) => {
			ffmpeg(audioFilePath)
				.setStartTime(startTime)
				.setDuration(endTime - startTime)
				.output(chunkPath)
				.audioCodec('copy') // Copy codec to avoid re-encoding (faster)
				.on('end', () => {
					chunkPaths.push(chunkPath);
					resolve();
				})
				.on('error', (err) => {
					reject(new Error(`Failed to create chunk ${i + 1}: ${err.message}`));
				})
				.run();
		});
	}

	return chunkPaths;
}

/**
 * Main function to split audio file based on chunk duration
 * @param {string} audioFilePath - Path to the audio file
 * @param {number} chunkDuration - Optional duration per chunk in seconds
 * @returns {Promise<Object>} Object containing chunk paths and whether splitting occurred
 */
export async function splitAudioIfNeeded(audioFilePath, chunkDuration) {
	// If no chunk duration specified, don't split
	if (!chunkDuration) {
		return {
			chunks: [audioFilePath],
			wasSplit: false,
			originalFile: audioFilePath
		};
	}

	// Get audio duration
	const duration = await getAudioDuration(audioFilePath);

	// Check if splitting is needed (audio longer than chunk duration)
	if (duration <= chunkDuration) {
		console.log(`Audio duration (${duration.toFixed(2)}s) is shorter than chunk duration (${chunkDuration}s). No splitting needed.`);
		return {
			chunks: [audioFilePath],
			wasSplit: false,
			originalFile: audioFilePath
		};
	}

	console.log(`Splitting audio into chunks of ${chunkDuration} seconds...`);
	console.log(`Audio duration: ${duration.toFixed(2)} seconds`);

	// Detect silence periods for natural break points
	console.log('Detecting silence periods...');
	const silencePeriods = await detectSilence(audioFilePath);
	console.log(`Found ${silencePeriods.length} silence periods`);

	// Calculate split points
	const splitPoints = calculateSplitPoints(silencePeriods, duration, chunkDuration);
	console.log(`Splitting into ${splitPoints.length + 1} chunks`);

	// Split the audio file
	const chunks = await splitAudioFile(audioFilePath, splitPoints);
	console.log(`Created ${chunks.length} audio chunks`);

	return {
		chunks,
		wasSplit: true,
		originalFile: audioFilePath
	};
}

/**
 * Cleans up temporary chunk files
 * @param {Array} chunkPaths - Array of paths to chunk files
 * @param {string} originalFile - Path to the original file (will not be deleted)
 */
export async function cleanupChunks(chunkPaths, originalFile) {
	for (const chunkPath of chunkPaths) {
		if (chunkPath !== originalFile) {
			try {
				await unlink(chunkPath);
				console.log(`Cleaned up chunk: ${path.basename(chunkPath)}`);
			} catch (err) {
				console.error(`Failed to delete chunk ${chunkPath}: ${err.message}`);
			}
		}
	}
}