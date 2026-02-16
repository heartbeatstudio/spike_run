import { kv } from '@vercel/kv';

const LEADERBOARD_KEY = 'spike-runner:leaderboard';
const MAX_ENTRIES = 100;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      // Get top scores
      const limit = parseInt(req.query.limit) || 10;
      const scores = await kv.zrange(LEADERBOARD_KEY, 0, limit - 1, {
        withScores: true
      });

      // Format: [member, score, member, score, ...]
      const leaderboard = [];
      for (let i = 0; i < scores.length; i += 2) {
        const entry = JSON.parse(scores[i]);
        leaderboard.push({
          ...entry,
          deaths: scores[i + 1],
          rank: Math.floor(i / 2) + 1
        });
      }

      return res.status(200).json({ leaderboard });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { deaths, playerName } = req.body;

      // Validation
      if (typeof deaths !== 'number' || deaths < 0 || deaths > 10000) {
        return res.status(400).json({ error: 'Invalid deaths count' });
      }

      if (!playerName || typeof playerName !== 'string' || playerName.length > 20) {
        return res.status(400).json({ error: 'Invalid player name' });
      }

      // Basic anti-cheat: Flag suspiciously low scores
      if (deaths < 5) {
        console.log('Suspicious score detected:', { deaths, playerName, ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress });
      }

      const timestamp = Date.now();
      const scoreData = JSON.stringify({
        playerName: playerName.trim().substring(0, 20),
        timestamp,
        date: new Date().toISOString()
      });

      // Add to sorted set (lower deaths = better rank)
      await kv.zadd(LEADERBOARD_KEY, { score: deaths, member: scoreData });

      // Trim to top MAX_ENTRIES
      const count = await kv.zcard(LEADERBOARD_KEY);
      if (count > MAX_ENTRIES) {
        await kv.zremrangebyrank(LEADERBOARD_KEY, MAX_ENTRIES, -1);
      }

      // Get player's rank
      const rank = await kv.zrank(LEADERBOARD_KEY, scoreData);

      return res.status(200).json({
        success: true,
        rank: rank !== null ? rank + 1 : null,
        deaths
      });
    } catch (error) {
      console.error('Error submitting score:', error);
      return res.status(500).json({ error: 'Failed to submit score' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
