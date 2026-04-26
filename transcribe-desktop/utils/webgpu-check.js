export async function checkWebGPUSupport() {
  if (!navigator.gpu) {
    return { 
      supported: false, 
      reason: 'WebGPU not available in this browser/Electron version' 
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, reason: 'No compatible GPU adapter found' };
    }

    const device = await adapter.requestDevice();
    const features = Array.from(device.features);
    
    return {
      supported: true,
      adapterName: adapter.name,
      features: features,
      limits: {
        maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
        maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage
      }
    };
  } catch (error) {
    return { supported: false, reason: error.message };
  }
}
