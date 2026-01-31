// generate_image_stub.js — simple Express stub to accept image generation requests
// Usage: node generate_image_stub.js
// This stub simply echoes back the uploaded image (simulate AI response).
// Replace with a proxy to real image-generation API (OpenAI/Replicate/StableDiffusion) on server-side.

import OpenAI from "openai";
import fs from "fs";
import multer from "multer";
import express from "express";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const upload = multer({ dest: "uploads/" });
const app = express();

app.post("/api/generate-image", upload.single("image"), async (req, res) => {
  try {
    const prompt = req.body.prompt;

    if (!req.file || !prompt) {
      return res.status(400).send("Image and prompt required");
    }

    const response = await openai.images.edits({
      model: "gpt-image-1",
      image: fs.createReadStream(req.file.path),
      prompt: prompt,
      size: "1024x1024"
    });

    const imageBase64 = response.data[0].b64_json;
    const imageBuffer = Buffer.from(imageBase64, "base64");

    res.setHeader("Content-Type", "image/png");
    res.send(imageBuffer);

    fs.unlink(req.file.path, () => {});
  } catch (error) {
    console.error(error);
    res.status(500).send("AI image generation failed");
  }
});
