# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TranscribeTalk CLI (`ttalk`) - A Node.js command-line tool for transcribing audio files using OpenAI's Whisper API. The tool is designed for interviews with 2 or more speakers.

## Key Commands

### Development
```bash
# Run in development mode with hot reload
npm run start:dev

# Run in production mode
npm start
```

### Linting
```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Using the CLI Tool
```bash
# Basic transcription (outputs to same directory as audio file)
node app.js transcribe <audio-file-path>

# With custom output path
node app.js transcribe <audio-file-path> [output-path]

# With language option (default: 'uk')
node app.js transcribe <audio-file-path> --lang en

# With format option (default: 'text')
# Supported formats: text, json, srt, verbose_json, vtt
node app.js transcribe <audio-file-path> --format srt
```

## Architecture

### Module System
- Uses ES modules (`"type": "module"` in package.json)
- All imports must use `.js` extensions

### Core Structure
- **app.js**: Main entry point and CLI interface using `commander`
  - Defines the `transcribe` command with arguments and options
  - Handles file path resolution and output path logic
  - Contains `whisperTranscribe()` function that calls OpenAI API
  - Contains `writeTextToFile()` helper for file output

- **api/config-openai-official.js**: OpenAI client configuration
  - Exports configured OpenAI client instance
  - Reads API key from environment variable `OPENAI_API_KEY`

### Configuration
- Environment variables are loaded via `dotenv/config`
- Required environment variable: `OPENAI_API_KEY`
- See `.env.example` for template

### Whisper API Integration
The transcription is handled by the `whisperTranscribe()` function in app.js:54, which:
- Accepts audio file path, output path, language, and format parameters
- Uses OpenAI's `whisper-1` model
- Supports a `prompt` parameter (currently empty string at app.js:55) for guiding transcription
- Writes output to file using the specified format

### Output Format
- Default format is 'text' which saves as `.txt`
- Other formats (json, srt, verbose_json, vtt) save with their respective extensions
- Output files are named after the input audio file with the appropriate extension