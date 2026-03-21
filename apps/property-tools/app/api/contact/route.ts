import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { ok: false, error: "Missing name or email" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"PropertyTools AI Contact" <fan.yes@gmail.com>`,
      to: "fan.yes@gmail.com",
      subject: "New PropertyTools AI lead",
      text: `Name: ${name}
Email: ${email}

Message:
${message || "(no message provided)"}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending contact email", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

