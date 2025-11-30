const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const url = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({ url });

client.on('error', (err) => {
  console.error('Redis error', err);
});

(async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
      console.log('Redis connected');
    }
  } catch (err) {
    console.error('Redis connect failed', err);
  }
})();

module.exports = client;
