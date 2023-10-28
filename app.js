import 'dotenv/config';
import openai from './api/config-openai-official.js';
import path from 'path';
import fs from 'fs';

const sourceDirPath = path.resolve('../source');
const outputDirPath = path.resolve('../texts');
const filename = 'part_20min_3_interview-007';
const audioFilePath = path.join(sourceDirPath, `${filename}.mp3`);
const textFilePath = path.join(outputDirPath, `${filename}.txt`);

// Write the text to a file
const writeTextToFile = text => {
	fs.writeFile(textFilePath, text, err => {
		if (err) {
			console.error('An error occurred:', err);
		} else {
			console.log('Text written to file successfully.');
		}
	});
};

async function main() {
	// const file = fs.createReadStream('audio.mp3');
	// const transcript = await transcribe(file);

	// console.log(transcript);
	console.log('app.js is running');

	try {
		const transcription = await openai.audio.transcriptions.create({
			file: fs.createReadStream(audioFilePath),
			model: 'whisper-1',
			language: 'uk',
			prompt: '',
			response_format: 'text',
		});

		writeTextToFile(transcription);
	} catch (error) {
		console.log(error.message);
		process.exit(1);
	}
}

main();
