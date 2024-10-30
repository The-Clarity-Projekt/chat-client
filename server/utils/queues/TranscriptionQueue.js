const EventEmitter = require('events');

class TranscriptionQueue {
  static instance = null;
  
  constructor() {
    if (TranscriptionQueue.instance) {
      return TranscriptionQueue.instance;
    }
    
    this.queue = [];
    this.processing = false;
    this.emitter = new EventEmitter();
    this.concurrentLimit = 1; // Only process one transcription at a time
    this.activeTranscriptions = 0;
    
    TranscriptionQueue.instance = this;
  }

  static getInstance() {
    if (!TranscriptionQueue.instance) {
      TranscriptionQueue.instance = new TranscriptionQueue();
    }
    return TranscriptionQueue.instance;
  }

  async addToQueue(audioPath, transcriptionFn) {
    return new Promise((resolve, reject) => {
      const task = {
        audioPath,
        transcriptionFn,
        resolve,
        reject
      };

      this.queue.push(task);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.activeTranscriptions >= this.concurrentLimit) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeTranscriptions < this.concurrentLimit) {
      const task = this.queue.shift();
      this.activeTranscriptions++;

      try {
        const result = await task.transcriptionFn(task.audioPath);
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      } finally {
        this.activeTranscriptions--;
      }
    }

    this.processing = false;

    // If there are more items and we're under the limit, continue processing
    if (this.queue.length > 0 && this.activeTranscriptions < this.concurrentLimit) {
      this.processQueue();
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  getActiveTranscriptions() {
    return this.activeTranscriptions;
  }
}

module.exports = { TranscriptionQueue }; 