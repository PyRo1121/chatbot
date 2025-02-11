import Sentiment from 'sentiment';
import confetti from 'canvas-confetti';

class AIOverlaySystem {
  constructor() {
    this.sentiment = new Sentiment();
    this.moodHistory = [];
    this.currentMood = 'neutral';
  }

  analyzeChat(message) {
    const result = this.sentiment.analyze(message);
    this.moodHistory.push(result.score);
    this.updateMoodState();
  }

  updateMoodState() {
    const avg = this.moodHistory.reduce((a, b) => a + b, 0) / this.moodHistory.length;
    if (avg > 0) {
      this.currentMood = 'positive';
    } else if (avg < 0) {
      this.currentMood = 'negative';
    } else {
      this.currentMood = 'neutral';
    }
  }

  getCurrentMood() {
    return this.currentMood;
  }

  triggerMoodAnimation() {
    switch (this.currentMood) {
      case 'positive':
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        break;
      case 'negative':
        // Implement negative mood animation
        break;
      default:
        // Neutral state animation
        break;
    }
  }
}

export default AIOverlaySystem;
