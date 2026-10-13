export function encodeVoiceWav(chunks: Float32Array[], inputRate: number): ArrayBuffer {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    source = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    source.set(chunk, offset);
    offset += chunk.length;
  }
  const rate = 16000,
    ratio = inputRate / rate,
    count = Math.floor(total / ratio),
    buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const text = (start: number, value: string): void => {
    for (let i = 0; i < value.length; i++) view.setUint8(start + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * ratio),
      end = Math.min(total, Math.max(start + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = start; j < end; j++) sum += source[j];
    const sample = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return buffer;
}
