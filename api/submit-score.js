// api/submit-score.js
// Vercel Serverless Function — POST a new score
// Stores in @vercel/kv Redis sorted set

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { teamName, score, players, date } = req.body;

    // Validate inputs
    if (!teamName || typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score data' });
    }

    // Sanitize team name (max 50 chars, no HTML)
    const safeName = String(teamName).slice(0, 50).replace(/<[^>]*>/g, '').trim();
    const safePlayers = Array.isArray(players)
      ? players.slice(0, 6).map(p => String(p).slice(0, 20).replace(/<[^>]*>/g, '').trim())
      : [];

    // Create the entry object stored as the sorted set member
    const entry = {
      teamName: safeName,
      players: safePlayers,
      score: Math.round(score),
      date: date || new Date().toLocaleDateString('en-US'),
      timestamp: Date.now()
    };

    // Use a unique key per submission: teamName + timestamp
    // This allows same team to appear multiple times if they improve
    const memberKey = JSON.stringify(entry);

    // Add to sorted set with score as rank
    await kv.zadd('gg:leaderboard', {
      score: Math.round(score),
      member: memberKey
    });

    // Keep only top 100 scores to avoid unbounded growth
    // Remove all members below rank 99 (0-indexed)
    const count = await kv.zcard('gg:leaderboard');
    if (count > 100) {
      await kv.zremrangebyrank('gg:leaderboard', 0, count - 101);
    }

    return res.status(200).json({ success: true, score: Math.round(score) });
  } catch (error) {
    console.error('Score submission error:', error);
    // Don't crash the game — return success silently
    return res.status(200).json({ success: false, error: 'Storage unavailable' });
  }
}
