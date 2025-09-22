import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req) {
  try {
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    const key_secret = process.env.NEXT_PUBLIC_RAZORPAY_KEY_SECRET;

    const generated_signature = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, message: "Signature mismatch" },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Payment verified and saved",
    });
  } catch (err) {
    console.error("Error verifying Razorpay payment:", err);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
