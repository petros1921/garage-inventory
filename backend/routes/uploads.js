const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');

// Use memory storage so we can forward to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed (jpg, png, webp, gif, heic)'));
  },
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const folder = req.body.folder || 'general';
    const path = `${folder}/${filename}`;

    const { error } = await supabase.storage
      .from('uploads')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) throw error;

    const { data: pub } = supabase.storage.from('uploads').getPublicUrl(path);

    res.json({ success: true, url: pub.publicUrl, path });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;