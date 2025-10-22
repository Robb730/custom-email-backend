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
      url: "https://simplelogin-7b738.firebaseapp.com/__/auth/action?continueUrl=https://your-frontend-domain.com/verified", 
      // ⬆ Replace with your actual hosted frontend domain
    });

    // Custom HTML email template
    const htmlContent = `
      <div style="font-family: Arial; background: #f7f7f7; padding: 20px; border-radius: 10px; max-width: 500px;">
        <h2 style="color:#3b5323;">Welcome to <span style="color:#618c45;">KuboHub</span>, ${displayName}!</h2>
        <p style="color:#333;">We're excited to have you join our community of travelers.</p>
        <p style="color:#333;">Click the button below to verify your email address:</p>
        <a href="${link}" style="background:#4a6b3f; color:white; text-decoration:none; padding:12px 20px; border-radius:8px; display:inline-block;">
          Verify My Email
        </a>
        <p>${link}</p>
        <p style="color:#555; margin-top:20px;">If you didn’t create this account, you can safely ignore this message.</p>
        <hr/>
        <p style="font-size:12px; color:#777;">© 2025 KuboHub | Travel with comfort 🌿</p>
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
