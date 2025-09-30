import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import path from 'path';

describe('CLI Command Tests', () => {
	let program;
	let mockWhisperTranscribe;

	beforeEach(() => {
		vi.clearAllMocks();
		mockWhisperTranscribe = vi.fn();

		// Create a new Command instance for each test
		program = new Command();
		const transcribe = program.command('transcribe');
		transcribe
			.description('CLI tool for transcribing multi-speaker audio files')
			.version('1.0.0')
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

				mockWhisperTranscribe(absoluteAudioFilePath, textFilePath, options.lang, options.format);
			});
	});

	it('should parse audio file path argument', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3']);

		expect(mockWhisperTranscribe).toHaveBeenCalled();
		const callArgs = mockWhisperTranscribe.mock.calls[0];
		expect(callArgs[0]).toContain('test-audio.mp3');
	});

	it('should use default language option (uk)', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		expect(callArgs[2]).toBe('uk');
	});

	it('should use default format option (text)', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		expect(callArgs[3]).toBe('text');
	});

	it('should parse custom language option', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--lang', 'en']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		expect(callArgs[2]).toBe('en');
	});

	it('should parse custom format option', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--format', 'json']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		expect(callArgs[3]).toBe('json');
	});

	it('should generate output path in same directory as audio file when no output path provided', async () => {
		const audioPath = '/path/to/audio/test-audio.mp3';
		await program.parseAsync(['node', 'app.js', 'transcribe', audioPath]);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toContain('test-audio.txt');
		expect(path.dirname(outputPath)).toBe(path.dirname(path.resolve(audioPath)));
	});

	it('should use custom output path when provided', async () => {
		const audioPath = 'test-audio.mp3';
		const customOutputPath = '/custom/output/dir';

		await program.parseAsync(['node', 'app.js', 'transcribe', audioPath, customOutputPath]);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toContain('/custom/output/dir/test-audio.txt');
	});

	it('should use correct file extension for text format', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--format', 'text']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toMatch(/\.txt$/);
	});

	it('should use correct file extension for json format', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--format', 'json']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toMatch(/\.json$/);
	});

	it('should use correct file extension for srt format', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--format', 'srt']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toMatch(/\.srt$/);
	});

	it('should use correct file extension for vtt format', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--format', 'vtt']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toMatch(/\.vtt$/);
	});

	it('should use correct file extension for verbose_json format', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'test-audio.mp3', '--format', 'verbose_json']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toMatch(/\.verbose_json$/);
	});

	it('should resolve relative audio file paths to absolute paths', async () => {
		const relativePath = './audio/test-audio.mp3';
		await program.parseAsync(['node', 'app.js', 'transcribe', relativePath]);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const audioPath = callArgs[0];

		expect(path.isAbsolute(audioPath)).toBe(true);
	});

	it('should preserve audio filename without extension in output', async () => {
		await program.parseAsync(['node', 'app.js', 'transcribe', 'my-interview.mp3']);

		const callArgs = mockWhisperTranscribe.mock.calls[0];
		const outputPath = callArgs[1];

		expect(outputPath).toContain('my-interview');
		expect(outputPath).not.toContain('my-interview.mp3');
	});
});