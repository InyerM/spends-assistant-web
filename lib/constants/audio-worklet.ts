export const AUDIO_CAPTURE_WORKLET = `
class AnottoVoiceCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples = new Float32Array(4096); this.offset = 0; }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input) for (let i = 0; i < input.length; i++) {
      this.samples[this.offset++] = input[i];
      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples, [this.samples.buffer]);
        this.samples = new Float32Array(4096); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('anotto-voice-capture', AnottoVoiceCapture);
`;
