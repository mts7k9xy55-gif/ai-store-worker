import { execSync } from 'child_process';

async function findGaps() {
  try {
    // 1. Query D1 for top 404 paths using wrangler
    // This assumes wrangler is configured in the environment
    const output = execSync('npx wrangler d1 execute ai-store-db --remote --command "SELECT path, COUNT(*) as hits FROM analytics_logs WHERE status_code = 404 GROUP BY path ORDER BY hits DESC LIMIT 1" --json').toString();
    const results = JSON.parse(output);

    if (results && results[0] && results[0].results && results[0].results.length > 0) {
      const gap = results[0].results[0];
      const spec = {
        title: `Auto-generated ${gap.path} API`,
        description: `This API was automatically generated based on high traffic to the ${gap.path} endpoint.`,
        path: gap.path,
        prompt: `Create a Cloudflare Worker that implements the ${gap.path} functionality. It should follow the store's coding standards, include Vitest tests, and a README.md. Ensure it returns JSON responses and handles common errors.`
      };
      
      // Output JSON for the GitHub Action to pick up
      console.log(JSON.stringify(spec));
    } else {
      // No significant gaps found
      process.exit(0);
    }
  } catch (error) {
    console.error('Failed to find gaps:', error);
    process.exit(1);
  }
}

findGaps();
