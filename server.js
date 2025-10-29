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
      url: "https://kubohub.netlify.app/verified", 
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
// --- PayPal Integration ---
const paypal = require("paypal-rest-sdk");

paypal.configure({
  mode: "sandbox", // Change to "live" when ready
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// --- Route for cashout (payout) ---
app.post("/api/payout", async (req, res) => {
  try {
    const { hostId, amount } = req.body;

    // 🔍 Fetch host details from Firestore
    const hostDoc = await admin.firestore().collection("users").doc(hostId).get();
    if (!hostDoc.exists) {
      return res.status(404).json({ success: false, message: "Host not found" });
    }

    const hostData = hostDoc.data();
    const hostEmail = hostData.email;
    const paypalEmail = hostData.paypal;

    if (!paypalEmail) {
      return res.status(400).json({ success: false, message: "Host PayPal not linked" });
    }

    // 💸 Create PayPal payout
    const payoutRequest = {
      sender_batch_header: {
        sender_batch_id: Math.random().toString(36).substring(9),
        email_subject: "You have a payout!",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: amount,
            currency: "PHP",
          },
          receiver: paypalEmail,
          note: "KuboHub e-wallet withdrawal",
          sender_item_id: "item_1",
        },
      ],
    };

    paypal.payout.create(payoutRequest, async (error, payout) => {
      if (error) {
        console.error("❌ PayPal Error:", error);
        return res.status(500).json({
          success: false,
          message: error.response?.message || "PayPal payout failed",
          details: error.response,
        });
      }

      console.log("✅ PayPal Payout Successful:", payout);

      // --- 📧 Send Email Receipt via Brevo ---
      const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f5f7f2; padding:25px; border-radius:14px; max-width:550px; margin:auto;">
        <h2 style="color:#4a6b3f;">Cashout Successful 🌿</h2>
        <p>Hi <strong>${hostData.displayName || "Host"}</strong>,</p>
        <p>Your cashout has been successfully initiated.</p>
        <p><strong>Amount:</strong> ₱${amount}</p>
        <p><strong>Status:</strong> ${payout.batch_header.batch_status}</p>
        <p>Funds will appear in your PayPal account (${paypalEmail}) soon.</p>
        <hr style="border:none; border-top:1px solid #ddd; margin:20px 0;">
        <p style="font-size:13px; color:#555;">Thank you for using KuboHub 💚</p>
      </div>
      `;

      try {
        await transporter.sendMail({
          from: `"KuboHub" <${process.env.EMAIL_USER}>`,
          to: hostEmail,
          subject: "KuboHub Cashout Receipt 💸",
          html: htmlContent,
        });
        console.log(`📧 Receipt sent to ${hostEmail}`);
      } catch (emailError) {
        console.error("❌ Failed to send receipt email:", emailError);
      }

      return res.json({ success: true, payout });
    });
  } catch (err) {
    console.error("🔥 Server Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});


// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
