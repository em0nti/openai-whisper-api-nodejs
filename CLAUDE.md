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

# With model option (default: 'gpt-4o-transcribe')
# Supported models: gpt-4o-transcribe, gpt-4o-mini-transcribe, whisper-1
node app.js transcribe <audio-file-path> --model whisper-1

# With chunk duration (optional) - splits audio into chunks of specified duration
# Duration is in seconds. If not specified, audio is not split.
node app.js transcribe <audio-file-path> --chunk-duration 600  # 10 minutes per chunk
node app.js transcribe <audio-file-path> --chunk-duration 1200 # 20 minutes per chunk
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
The transcription is handled by the `whisperTranscribe()` function in app.js:81, which:
- Accepts audio file path, output path, language, format, model, and optional chunk duration parameters
- Uses OpenAI's `gpt-4o-transcribe` model by default (configurable via --model option)
- Optionally splits audio files into chunks of specified duration (see Audio Chunking below)
- Supports a `prompt` parameter (currently empty string) for guiding transcription
- Writes output to file using the specified format

### Audio Chunking (Optional)
Users can optionally split long audio files into smaller chunks using the `--chunk-duration` option:
- **utils/audioSplitter.js**: Utility module for handling audio chunking
- Uses FFmpeg's `silencedetect` filter to find natural break points between sentences
- Splits audio at silence periods nearest to the specified chunk duration
- If no silence is found within ±30 seconds of target, splits at the exact duration point
- Processes each chunk separately and concatenates results
- Automatically cleans up temporary chunk files after transcription
- Key functions:
  - `detectSilence()`: Finds silence periods in audio using FFmpeg
  - `getAudioDuration()`: Gets the total duration of the audio file
  - `calculateSplitPoints()`: Determines optimal split points based on chunk duration and silence
  - `splitAudioFile()`: Creates audio chunks at specified time points
  - `splitAudioIfNeeded()`: Main function that orchestrates the splitting process (only if chunk duration specified)
  - `cleanupChunks()`: Removes temporary chunk files

**Note**: Audio splitting is entirely optional and only occurs when the `--chunk-duration` option is provided. Without this option, the entire audio file is transcribed as a single unit.

### Output Format
- Default format is 'text' which saves as `.txt`
- Other formats (json, srt, verbose_json, vtt) save with their respective extensions
- Output files are named after the input audio file with the appropriate extension
- For split files, chunk transcriptions are automatically concatenated