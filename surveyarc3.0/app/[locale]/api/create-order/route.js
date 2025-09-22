import Razorpay from 'razorpay';

export async function POST(req) {
  const { amount, planId } = await req.json();

  const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    key_secret: process.env.NEXT_PUBLIC_RAZORPAY_KEY_SECRET,
  });

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt: `${planId}-${Date.now()}`,
  });

  return Response.json({ orderId: order.id, amount });
}
