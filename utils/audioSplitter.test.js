import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	detectSilence,
	getAudioDuration,
	calculateSplitPoints,
	cleanupChunks
} from './audioSplitter.js';

// Mock fluent-ffmpeg
vi.mock('fluent-ffmpeg', () => {
	const mockFfmpeg = vi.fn(() => ({
		audioFilters: vi.fn().mockReturnThis(),
		format: vi.fn().mockReturnThis(),
		on: vi.fn(function(event, callback) {
			if (event === 'stderr') {
				// Simulate stderr output with silence detection
				callback('silence_start: 10.5');
				callback('silence_end: 11.0');
				callback('silence_start: 25.3');
				callback('silence_end: 25.8');
			} else if (event === 'end') {
				callback();
			}
			return this;
		}),
		output: vi.fn().mockReturnThis(),
		run: vi.fn(),
		setStartTime: vi.fn().mockReturnThis(),
		setDuration: vi.fn().mockReturnThis(),
		audioCodec: vi.fn().mockReturnThis(),
	}));

	mockFfmpeg.setFfmpegPath = vi.fn();
	mockFfmpeg.setFfprobePath = vi.fn();
	mockFfmpeg.ffprobe = vi.fn((path, callback) => {
		callback(null, {
			format: {
				duration: 60.0 // 60 seconds
			}
		});
	});

	return { default: mockFfmpeg };
});

// Mock @ffmpeg-installer/ffmpeg
vi.mock('@ffmpeg-installer/ffmpeg', () => ({
	default: {
		path: '/usr/bin/ffmpeg'
	}
}));

// Mock @ffprobe-installer/ffprobe
vi.mock('@ffprobe-installer/ffprobe', () => ({
	default: {
		path: '/usr/bin/ffprobe'
	}
}));

// Mock fs with promises support
vi.mock('fs', async () => {
	const actual = await vi.importActual('fs');
	return {
		...actual,
		default: {
			...actual.default,
			stat: vi.fn((path, callback) => {
				// Simulate a 30MB file by default
				callback(null, { size: 30 * 1024 * 1024 });
			}),
			unlink: vi.fn((path, callback) => {
				callback(null);
			}),
			promises: {
				stat: vi.fn(async () => ({ size: 30 * 1024 * 1024 })),
				unlink: vi.fn(async () => {})
			}
		},
		stat: vi.fn((path, callback) => {
			callback(null, { size: 30 * 1024 * 1024 });
		}),
		unlink: vi.fn((path, callback) => {
			callback(null);
		})
	};
});

describe('audioSplitter', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('detectSilence', () => {
		it('should detect silence periods in audio', async () => {
			const silencePeriods = await detectSilence('/path/to/audio.mp3');

			expect(silencePeriods).toHaveLength(2);
			expect(silencePeriods[0]).toEqual({
				start: 10.5,
				end: 11.0,
				duration: 0.5
			});
			expect(silencePeriods[1]).toEqual({
				start: 25.3,
				end: 25.8,
				duration: 0.5
			});
		});

		it('should handle audio with no silence', async () => {
			const ffmpeg = await import('fluent-ffmpeg');
			ffmpeg.default.mockImplementationOnce(() => ({
				audioFilters: vi.fn().mockReturnThis(),
				format: vi.fn().mockReturnThis(),
				on: vi.fn(function(event, callback) {
					if (event === 'end') {
						callback();
					}
					return this;
				}),
				output: vi.fn().mockReturnThis(),
				run: vi.fn(),
			}));

			const silencePeriods = await detectSilence('/path/to/audio.mp3');
			expect(silencePeriods).toHaveLength(0);
		});
	});

	describe('getAudioDuration', () => {
		it('should return audio duration in seconds', async () => {
			const duration = await getAudioDuration('/path/to/audio.mp3');
			expect(duration).toBe(60.0);
		});

		it('should handle ffprobe errors', async () => {
			const ffmpeg = await import('fluent-ffmpeg');
			ffmpeg.default.ffprobe = vi.fn((path, callback) => {
				callback(new Error('File not found'));
			});

			await expect(getAudioDuration('/invalid/path.mp3')).rejects.toThrow('Failed to get audio duration');
		});
	});


	describe('cleanupChunks', () => {
		it('should delete chunk files but not original', async () => {
			const fs = await import('fs');
			const chunks = [
				'/path/to/audio_chunk_1.mp3',
				'/path/to/audio_chunk_2.mp3'
			];
			const originalFile = '/path/to/audio.mp3';

			await cleanupChunks(chunks, originalFile);

			expect(fs.default.unlink).toHaveBeenCalledTimes(2);
			expect(fs.default.unlink).toHaveBeenCalledWith(chunks[0], expect.any(Function));
			expect(fs.default.unlink).toHaveBeenCalledWith(chunks[1], expect.any(Function));
		});

		it('should not delete original file', async () => {
			const fs = await import('fs');
			const chunks = [
				'/path/to/audio.mp3',
				'/path/to/audio_chunk_1.mp3'
			];
			const originalFile = '/path/to/audio.mp3';

			await cleanupChunks(chunks, originalFile);

			expect(fs.default.unlink).toHaveBeenCalledTimes(1);
			expect(fs.default.unlink).toHaveBeenCalledWith(chunks[1], expect.any(Function));
			expect(fs.default.unlink).not.toHaveBeenCalledWith(originalFile, expect.any(Function));
		});

		it('should handle cleanup errors gracefully', async () => {
			// Test that cleanup doesn't throw even if unlink fails
			const fs = await import('fs');
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Replace the mock temporarily
			const originalUnlink = fs.default.unlink;
			fs.default.unlink = vi.fn((path, callback) => {
				callback(new Error('Permission denied'));
			});

			const chunks = ['/path/to/audio_chunk_1.mp3'];
			const originalFile = '/path/to/audio.mp3';

			// Should not throw
			await expect(cleanupChunks(chunks, originalFile)).resolves.not.toThrow();

			// Restore
			fs.default.unlink = originalUnlink;
			consoleErrorSpy.mockRestore();
		});
	});
});