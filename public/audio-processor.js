/**
 * AudioWorklet processor for capturing mic audio.
 * Replaces deprecated ScriptProcessorNode.
 */
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input && input.length > 0) {
      this.port.postMessage({ samples: new Float32Array(input) });
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
