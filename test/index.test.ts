import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('AI Store Worker Webhook', () => {
  it('handles stripe webhook checkout.session.completed', async () => {
    const payload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer_details: {
            email: 'test@example.com'
          }
        }
      }
    };
    
    const request = new Request('http://example.com/webhook/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'simulated-signature',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ received: true });
  });
});
