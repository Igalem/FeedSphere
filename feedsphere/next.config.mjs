/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from trying to bundle the native ONNX runtime
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
};

export default nextConfig;
