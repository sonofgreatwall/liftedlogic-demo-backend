const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const app = express();
require('dotenv').config();

app.use(cors()); // allow all origins
app.use(cors({ origin: '*' }));

// 1. Create a transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.USER_MAIL,
    pass: process.env.USER_PASSWORD // Use App Password, not your Gmail password
  }
});

const db = new sqlite3.Database('./mydb.sqlite');

// Make sure table exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS datas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE,
      data TEXT
    )
  `);

  db.run(`
  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT,
    lastName TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    data TEXT
  )
`);
});

// Middleware to parse JSON bodies
app.use(express.json());

// Example route
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// Save Progress
app.post('/save_progress', (req, res) => {
  var { token, saveEmail } = req.body
  delete req.body.token
  delete req.body.saveEmail

  const dataJson = JSON.stringify(req.body); // store as JSON string

  const stmt = db.prepare(`
    INSERT INTO datas (token, data)
    VALUES (?, ?)
    ON CONFLICT(token) DO UPDATE SET data = excluded.data
  `);

  stmt.run(token, dataJson, function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to save data' });
    }

    const mailOptions = {
      from: 'inhisfavor4ever@gmail.com',
      to: saveEmail,
      subject: 'Your Cost Calculator Link',
      text: `Thank you for saving Cost Calculator. Please use the unique link below to return to the form from any computer:\n\nhttp://localhost:3000/?gf_token=${token}`,
      html: `
      <p>Thank you for saving Cost Calculator. Please use the unique link below to return to the form from any computer:</p>
      <p><a href="http://localhost:3000/?gf_token=${token}">
      http://localhost:3000/?gf_token=${token}</a></p>
    `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log('Error:', error);
      }
      console.log('Email sent:', info.response);
      res.send({ ...req.body, result: "success" });
    });
  });
  stmt.finalize();
});

// Save Result
app.post('/save_result', (req, res) => {
  const { firstName, lastName, email, phone, website, data } = req.body;

  if (data.token) {
    db.run(`DELETE FROM datas WHERE token = ?`, [data.token], (err) => {
      if (err) {
        console.error('Error deleting token from datas:', err);
      } else {
        console.log(`Token ${data.token} removed from datas table`);
      }
    });
  }

  const dataJson = JSON.stringify(data); // store as JSON string

  const stmt = db.prepare(`
    INSERT INTO results (firstName, lastName, email, phone, website, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(firstName, lastName, email, phone, website, dataJson, function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to save result' });
    }
    const mailOptions = {
      from: 'inhisfavor4ever@gmail.com',
      to: email,
      subject: 'Lifted Logic Newsletter: Please Confirm Subscription',
      text: `
Please Confirm Subscription

Yes, subscribe me to this list.

If you received this email by mistake, simply delete it. 
You won't be subscribed if you don't click the confirmation button above.

For questions about this list, please contact:
info@liftedlogic.com
  `,
      html: `
    <p><strong>Please Confirm Subscription</strong></p>
    <p>
      <form action="http://localhost:5000/confirm_subscription?id=${this.lastID}" method="GET">
        <button type="submit" style="
          background-color: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
          border-radius: 4px;">
          Yes, subscribe me to this list
        </button>
      </form>
    </p>
    <p>If you received this email by mistake, simply delete it.<br>
    You won't be subscribed if you don't click the confirmation button above.</p>
    <p>For questions about this list, please contact:<br>
    <a href="mailto:info@liftedlogic.com">info@liftedlogic.com</a></p>
  `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return console.log('Error:', error);
      }
      console.log('Email sent:', info.response);
      res.json({ id: this.lastID, result: "success" }); // return new row ID
    });
  });

  stmt.finalize();
});

// Optional: retrieve by token
app.get('/get_progress/:token', (req, res) => {
  db.get("SELECT data FROM datas WHERE token = ?", [req.params.token], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch data' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(JSON.parse(row.data)); // parse JSON string back to object
  });
});

// Start server
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
