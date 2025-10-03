import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeTextToFile, whisperTranscribe, extractPromptFromTranscript } from './app.js';
import fs from 'fs';
import openai from './api/config-openai-official.js';

// Mock the audioSplitter module
vi.mock('./utils/audioSplitter.js', () => ({
	splitAudioIfNeeded: vi.fn(async (path) => ({
		chunks: [path],
		wasSplit: false,
		originalFile: path
	})),
	cleanupChunks: vi.fn(async () => {})
}));

// Mock the fs module
vi.mock('fs', () => ({
	default: {
		writeFile: vi.fn((path, content, callback) => callback(null)),
		createReadStream: vi.fn(() => 'mock-stream'),
	},
}));

// Mock the openai module
vi.mock('./api/config-openai-official.js', () => ({
	default: {
		audio: {
			transcriptions: {
				create: vi.fn(),
			},
		},
	},
}));

describe('writeTextToFile', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should write text to file successfully', () => {
		const text = 'Sample transcription text';
		const destinationPath = '/path/to/output.txt';

		writeTextToFile(text, destinationPath);

		expect(fs.writeFile).toHaveBeenCalledWith(
			destinationPath,
			text,
			expect.any(Function)
		);
		expect(console.log).toHaveBeenCalledWith('Text written to file successfully.');
	});

	it('should handle write errors', () => {
		const mockError = new Error('Write failed');
		fs.writeFile.mockImplementationOnce((path, content, callback) => {
			callback(mockError);
		});

		const text = 'Sample text';
		const destinationPath = '/path/to/output.txt';

		writeTextToFile(text, destinationPath);

		expect(console.error).toHaveBeenCalledWith(
			'An error occurred when write ext to file:',
			mockError
		);
	});
});

describe('whisperTranscribe', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(process, 'exit').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should successfully transcribe audio file', async () => {
		const mockTranscription = 'This is the transcribed text';
		openai.audio.transcriptions.create.mockResolvedValueOnce(mockTranscription);

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'en';
		const format = 'text';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = undefined;

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration);

		expect(console.log).toHaveBeenCalledWith('Start transcribing...');
		expect(openai.audio.transcriptions.create).toHaveBeenCalledWith({
			file: 'mock-stream',
			model: 'gpt-4o-transcribe',
			language: lang,
			prompt: '',
			response_format: format,
		});
		expect(fs.writeFile).toHaveBeenCalledWith(
			outputPath,
			mockTranscription,
			expect.any(Function)
		);
	});

	it('should handle transcription errors', async () => {
		const mockError = new Error('API Error');
		openai.audio.transcriptions.create.mockRejectedValueOnce(mockError);

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'en';
		const format = 'text';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = undefined;

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration);

		expect(console.log).toHaveBeenCalledWith('API Error');
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should create stream from audio file path', async () => {
		const mockTranscription = 'Transcription result';
		openai.audio.transcriptions.create.mockResolvedValueOnce(mockTranscription);

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'uk';
		const format = 'json';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = undefined;

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration);

		expect(fs.createReadStream).toHaveBeenCalledWith(audioFilePath);
	});

	it('should use correct model and parameters', async () => {
		const mockTranscription = 'Test transcription';
		openai.audio.transcriptions.create.mockResolvedValueOnce(mockTranscription);

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'uk';
		const format = 'srt';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = undefined;

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration);

		expect(openai.audio.transcriptions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				model: 'gpt-4o-transcribe',
				language: lang,
				response_format: format,
				prompt: '',
			})
		);
	});

	it('should split audio when chunk duration is specified', async () => {
		const { splitAudioIfNeeded } = await import('./utils/audioSplitter.js');
		const mockTranscription1 = 'First chunk text';
		const mockTranscription2 = 'Second chunk text';

		openai.audio.transcriptions.create
			.mockResolvedValueOnce(mockTranscription1)
			.mockResolvedValueOnce(mockTranscription2);

		// Mock splitAudioIfNeeded to return multiple chunks
		splitAudioIfNeeded.mockResolvedValueOnce({
			chunks: ['/path/to/chunk1.mp3', '/path/to/chunk2.mp3'],
			wasSplit: true,
			originalFile: '/path/to/audio.mp3'
		});

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'en';
		const format = 'text';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = 600; // 10 minutes

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration);

		expect(splitAudioIfNeeded).toHaveBeenCalledWith(audioFilePath, chunkDuration);
		expect(openai.audio.transcriptions.create).toHaveBeenCalledTimes(2);
	});

	it('should use custom initial prompt when provided', async () => {
		const mockTranscription = 'Test transcription';
		openai.audio.transcriptions.create.mockResolvedValueOnce(mockTranscription);

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'en';
		const format = 'text';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = undefined;
		const customPrompt = 'Use technical terminology for AI and machine learning';

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration, customPrompt);

		expect(openai.audio.transcriptions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: customPrompt,
			})
		);
	});

	it('should use previous chunk transcription as prompt for next chunk', async () => {
		const { splitAudioIfNeeded } = await import('./utils/audioSplitter.js');

		// Mock split audio with 2 chunks
		splitAudioIfNeeded.mockResolvedValueOnce({
			chunks: ['/path/to/chunk1.mp3', '/path/to/chunk2.mp3'],
			wasSplit: true,
			originalFile: '/path/to/audio.mp3'
		});

		const firstChunkTranscription = 'This is the first chunk. It contains some context about the topic.';
		const secondChunkTranscription = 'This is the second chunk.';

		openai.audio.transcriptions.create
			.mockResolvedValueOnce(firstChunkTranscription)
			.mockResolvedValueOnce(secondChunkTranscription);

		const audioFilePath = '/path/to/audio.mp3';
		const outputPath = '/path/to/output.txt';
		const lang = 'en';
		const format = 'text';
		const model = 'gpt-4o-transcribe';
		const chunkDuration = 600;

		await whisperTranscribe(audioFilePath, outputPath, lang, format, model, chunkDuration);

		// First chunk should use empty prompt (or initial prompt if provided)
		expect(openai.audio.transcriptions.create).toHaveBeenNthCalledWith(1,
			expect.objectContaining({
				prompt: '',
			})
		);

		// Second chunk should use extracted prompt from first chunk
		expect(openai.audio.transcriptions.create).toHaveBeenNthCalledWith(2,
			expect.objectContaining({
				prompt: expect.stringContaining('first chunk'),
			})
		);
	});
});

describe('extractPromptFromTranscript', () => {
	it('should return empty string for null or undefined input', () => {
		expect(extractPromptFromTranscript(null)).toBe('');
		expect(extractPromptFromTranscript(undefined)).toBe('');
		expect(extractPromptFromTranscript('')).toBe('');
	});

	it('should return full transcript if shorter than maxWords', () => {
		const shortTranscript = 'This is a short transcript with only a few words.';
		expect(extractPromptFromTranscript(shortTranscript, 200)).toBe(shortTranscript);
	});

	it('should extract last 200 words and start from sentence boundary', () => {
		// Create a transcript with more than 200 words
		const words = [];
		for (let i = 0; i < 250; i++) {
			words.push(`word${i}`);
			if (i === 49 || i === 149 || i === 199) {
				words[words.length - 1] += '.';
			}
		}
		const longTranscript = words.join(' ');

		const result = extractPromptFromTranscript(longTranscript, 200);

		// Should not start with 'word50' (the first word in last 200)
		expect(result).not.toMatch(/^word50/);
		// Should start after the first sentence boundary found
		expect(result).toMatch(/^word\d+/);
		// Should be shorter than the full 200 words due to sentence boundary trimming
		expect(result.split(/\s+/).length).toBeLessThan(200);
	});

	it('should handle transcripts without sentence boundaries', () => {
		const words = Array(250).fill(0).map((_, i) => `word${i}`);
		const transcriptNoPunctuation = words.join(' ');

		const result = extractPromptFromTranscript(transcriptNoPunctuation, 200);

		// Should return last 200 words even without sentence boundaries
		expect(result.split(/\s+/).length).toBe(200);
	});

	it('should start from first sentence boundary (period)', () => {
		const transcript = 'First sentence here. Second sentence begins now. Third sentence follows. And more text continues.';
		const result = extractPromptFromTranscript(transcript, 10);

		// Should start after the first period found in the last 10 words
		expect(result).toMatch(/^(Second|Third|And)/);
	});

	it('should handle exclamation and question marks as boundaries', () => {
		// Test with exclamation mark as the first boundary
		const transcript1 = 'Some initial text that we do not want here First sentence here! Second sentence begins now.';
		const result1 = extractPromptFromTranscript(transcript1, 8);
		expect(result1).toMatch(/^Second/);

		// Test with question mark as the first boundary
		const transcript2 = 'Some initial text that we do not want here First sentence here? Second sentence begins now.';
		const result2 = extractPromptFromTranscript(transcript2, 8);
		expect(result2).toMatch(/^Second/);
	});
});