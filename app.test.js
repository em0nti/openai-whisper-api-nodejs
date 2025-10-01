import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeTextToFile, whisperTranscribe } from './app.js';
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
});