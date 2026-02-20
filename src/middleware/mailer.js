const nodemailer = require("nodemailer");
const env = require("./env");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: `"Backoffice NG" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };
