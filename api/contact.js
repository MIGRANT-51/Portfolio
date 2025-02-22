// contact.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const { body, validationResult } = require('express-validator');

// POST /api/contact with input validation middleware
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('message').trim().notEmpty().withMessage('Message is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Return validation errors if found
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, message } = req.body;

    try {
      const sql = 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)';
      const [result] = await pool.execute(sql, [name, email, message]);
      res.status(200).json({ message: 'Message sent successfully!' });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ message: 'Failed to save message.' });
    }
  }
);

module.exports = router;    // Export the router object to be used in server.js or other files              
// In this example, we have a POST /api/contact route that validates the input data using the express-validator library. If the input data is valid, the route saves the contact message to the database using the pool object from db.js.
//  In this example, we have a POST /api/contact route that validates the input data using the express-validator library. If the input data is valid, the route saves the contact message to the database using the pool object from db.js.
//  The route returns a success message if the message is saved successfully, or an error message if there is a database error.
//  The contact.js file exports the router object, which can be used in server.js or other files to define the API routes.