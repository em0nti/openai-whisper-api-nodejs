import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const openai = new OpenAI({
	apiKey: process.env['OPENAI_API_KEY'], // defaults to process.env["OPENAI_API_KEY"]
});

export default openai;
