// generate_image_stub.js — simple Express stub to accept image generation requests
// Usage: node generate_image_stub.js
// This stub simply echoes back the uploaded image (simulate AI response).
// Replace with a proxy to real image-generation API (OpenAI/Replicate/StableDiffusion) on server-side.

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = process.env.PORT || 3000;

app.post('/api/generate-image', upload.single('image'), async (req, res) => {
  try {
    // Debug: log prompt and body fields to verify prompt arrives
    console.log('generate-image request body:', req.body);
    console.log('generate-image received prompt:', req.body && req.body.prompt);

    // For now, just return the uploaded file to simulate processing.
    if (!req.file) return res.status(400).send('No image');
    const filePath = req.file.path;
    // Optionally: perform server-side enhancements here, call remote API, etc.

    // Send file back as image/png (or original mimetype)
    res.setHeader('Content-Type', req.file.mimetype || 'image/jpeg');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    // cleanup after response
    stream.on('close', ()=> fs.unlink(filePath, ()=>{}));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.listen(PORT, ()=> console.log(`Image generation stub listening on http://localhost:${PORT}`));
