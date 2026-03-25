import type { FastifyPluginAsync } from 'fastify';
import { manifest } from './manifest.js';

export const stremioPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/manifest.json', async (_request, reply) => {
    reply.header('Cache-Control', 'max-age=86400');
    return manifest;
  });
};
