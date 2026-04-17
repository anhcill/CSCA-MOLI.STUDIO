const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all subjects
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, code, slug, description FROM subjects ORDER BY name'
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ message: 'Failed to fetch subjects' });
    }
});

module.exports = router;
