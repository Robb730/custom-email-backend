const express = require("express");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ✅ Setup Nodemailer with Brevo (Sendinblue)
const brevoTransport = require("nodemailer-sendinblue-transport");

const transporter = nodemailer.createTransport(
  new brevoTransport({
    apiKey: process.env.BREVO_API_KEY,
  })
);

// ✅ Route to send email verification
app.post("/send-verification", async (req, res) => {
  try {
    const { email, displayName } = req.body;

    // Generate Firebase verification link
    const link = await admin.auth().generateEmailVerificationLink(email, {
      url: "https://simplelogin-7b738.firebaseapp.com/__/auth/action?continueUrl=https://localhost:3000/verified", 
      // ⬆ Replace with your actual hosted frontend domain
    });

    // Custom HTML email template
    const htmlContent = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7f2; padding: 25px; border-radius: 14px; max-width: 550px; margin: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
    <div style="text-align: center; padding-bottom: 10px;">
      <h1 style="color:#4a6b3f; font-size: 28px; margin-bottom: 5px;">Welcome to <span style="color:#7ba86f;">KuboHub</span> 🌿</h1>
      <p style="color:#4f4f4f; font-size: 15px; margin: 0;">Hey <strong>${displayName}</strong>, your journey with comfort begins here!</p>
    </div>

    <div style="margin-top: 20px; color:#333; line-height: 1.6;">
      <p>
        We’re thrilled to have you join our growing community of explorers and hosts.  
        Whether you’re planning your next cozy getaway or sharing your own space, KuboHub is here to make every stay feel like home.
      </p>

      <p>Before we get started, please verify your email address by clicking the button below:</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${link}" style="background:#618c45; color:#fff; text-decoration:none; padding:14px 26px; border-radius:10px; font-weight:600; display:inline-block; font-size:16px;">
        Verify My Email
      </a>
    </div>

    <p style="color:#555; font-size: 14px;">
      Once verified, you’ll be able to log in, explore listings, and start connecting with hosts or guests across KuboHub.
    </p>

    <p style="color:#777; font-size: 13px; margin-top: 25px; text-align: center;">
      If you didn’t create this account, you can safely ignore this message.  
      <br><br>
      <hr style="border:none; border-top:1px solid #ddd; margin: 25px 0;">
      <span style="font-size:12px; color:#888;">© 2025 <strong>KuboHub</strong> | Travel with comfort and peace 🌱</span>
    </p>
  </div>
`;


    // ✅ Send email using Brevo
    await transporter.sendMail({
      from: `"KuboHub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your KuboHub account 🌿",
      html: htmlContent,
    });

    res.status(200).send("Custom verification email sent!");
  } catch (error) {
    console.error("❌ Error sending email:", error);
    res.status(500).send(error.message);
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
