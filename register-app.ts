import axios from 'axios';

async function registerApp() {
  const apiUrl = process.env.API_URL || 'http://localhost:8787/apps';
  const appData = {
    title: 'AI Store Worker',
    description: 'Cloudflare Worker for AI Store with Stripe integration.',
    repoUrl: 'https://github.com/your-repo/ai-store-worker',
  };

  try {
    const response = await axios.post(apiUrl, appData);
    console.log('App registered successfully:', response.data);
  } catch (error: any) {
    console.error('Failed to register app:', error.response?.data || error.message);
    process.exit(1);
  }
}

registerApp();
