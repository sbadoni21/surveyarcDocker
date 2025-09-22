import pricingPlan from '@/models/pricingModel';

export async function GET() {
  try {
    const plans = pricingPlan.getAll();
    return new Response(JSON.stringify(plans), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch plans' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
