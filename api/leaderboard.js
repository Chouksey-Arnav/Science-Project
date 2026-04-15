// api/leaderboard.js
// Vercel Serverless Function — GET top 10 scores
// Uses @vercel/kv (Redis sorted set)

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers so the game can call this from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get top 10 scores (descending) from sorted set
    // Each member is stored as a JSON string with team data
    const raw = await kv.zrange('gg:leaderboard', 0, 9, {
      rev: true,       // highest scores first
      withScores: true // include the numeric score
    });

    // raw comes back as alternating [member, score, member, score, ...]
    const scores = [];
    for (let i = 0; i < raw.length; i += 2) {
      try {
        const entry = typeof raw[i] === 'string' ? JSON.parse(raw[i]) : raw[i];
        scores.push({
          ...entry,
          score: Number(raw[i + 1])
        });
      } catch {
        // Skip malformed entries
      }
    }

    return res.status(200).json(scores);
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    // Return empty array gracefully — game handles this case
    return res.status(200).json([]);
  }
}
