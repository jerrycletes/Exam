function calculateReadingTime(text) {
  if (!text) return 0;
  // split by whitespace for words
  const words = text.trim().split(/\s+/).length;
  const wpm = 200; // words per minute
  return Math.max(1, Math.ceil(words / wpm)); // at least 1 minute
}

module.exports = calculateReadingTime;
