// Function to detect speaker changes based on pauses in the transcript
function identifySpeakers(transcript) {
	const segments = transcript.segments;
	let speaker = 1;
	let lastEndTime = 0;
	const output = [];

	segments.forEach(segment => {
		const pauseDuration = segment.start - lastEndTime;
		if (pauseDuration > 1.0) {
			// Assume speaker changes if pause is greater than 1 second
			speaker = speaker === 1 ? 2 : 1;
		}
		output.push({
			speaker: `Speaker ${speaker}`,
			start: segment.start,
			end: segment.end,
			text: segment.text.trim(),
		});
		lastEndTime = segment.end;
	});

	return output;
}
