import { HYBRID_LINEAR_DOWNSAMPLE_SPLIT } from "../constants";

/**
 * Downsample FFT data for the linear scale by hybrid pooling (average for low bins, max for high bins)
 * @param fftData
 * @param bins
 */
export function downsampleLinear(fftData: Float32Array, bins: number): Float32Array {
  const binCount = fftData.length;
  if (bins >= binCount) return fftData;
  const groupSize = Math.floor(binCount / bins);
  const result = new Float32Array(bins);
  const split = Math.floor(bins * HYBRID_LINEAR_DOWNSAMPLE_SPLIT);
  for (let i = 0; i < bins; i++) {
    if (i < split) {
      // Average for low bins
      let sum = 0;
      for (let j = 0; j < groupSize; j++) {
        sum += fftData[i * groupSize + j];
      }
      result[i] = sum / groupSize;
    } else {
      // Max for high bins
      let max = Number.NEGATIVE_INFINITY;
      for (let j = 0; j < groupSize; j++) {
        max = Math.max(max, fftData[i * groupSize + j]);
      }
      result[i] = max;
    }
  }
  return result;
}

/**
 * Downsample FFT data for log scale by hybrid pooling (average for low bins, max for high bins)
 * @param fftData
 * @param bins
 * @param nyquistFreq - The Nyquist frequency (sampleRate / 2)
 */
export function downsampleLog(fftData: Float32Array, bins: number, nyquistFreq: number = 384000): Float32Array {
  const binCount = fftData.length;
  if (bins >= binCount) return fftData;
  const result = new Float32Array(bins);
  const minFreq = 10;
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(nyquistFreq);

  for (let i = 0; i < bins; i++) {
    const logStart = logMin + (logMax - logMin) * (i / bins);
    const logEnd = logMin + (logMax - logMin) * ((i + 1) / bins);
    const freqStart = Math.pow(10, logStart);
    const freqEnd = Math.pow(10, logEnd);
    let startF = Math.floor((freqStart / nyquistFreq) * binCount);
    let endF = Math.floor((freqEnd / nyquistFreq) * binCount);
    startF = Math.max(0, Math.min(binCount - 1, startF));
    endF = Math.max(startF + 1, Math.min(binCount, endF));
    let sum = 0;
    let max = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (let j = startF; j < endF && j < binCount; j++) {
      sum += fftData[j];
      max = Math.max(max, fftData[j]);
      count++;
    }
    if (count === 0) {
      result[i] = fftData[0];
    } else {
      result[i] = i < bins * HYBRID_LINEAR_DOWNSAMPLE_SPLIT ? sum / count : max;
    }
  }
  return result;
}

/**
 * Downsample FFT data for Mel scale by averaging bins within a kernel
 * @param fftData
 * @param bins
 */
export function downsampleMel(fftData: Float32Array, bins: number): Float32Array {
  const binCount = fftData.length;
  if (bins >= binCount) return fftData;
  const kernelSize = Math.floor(binCount / bins);
  const result = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    let sum = 0;
    let count = 0;
    // Center the kernel on the target bin
    const center = Math.floor(((i + 0.5) * binCount) / bins);
    const start = Math.max(0, center - Math.floor(kernelSize / 2));
    const end = Math.min(binCount, center + Math.ceil(kernelSize / 2));
    for (let j = start; j < end; j++) {
      sum += fftData[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : 0;
  }
  return result;
}
