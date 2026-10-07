import React, { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../services/api';

/**
 * Reusable image upload component.
 * Props:
 *   - value: current image URL (controlled)
 *   - onChange: (url | null) => void
 *   - label: text above the drop zone
 *   - folder: Supabase storage folder (e.g. 'work-orders')
 *   - optional: if true, shows "(optional)" in the label
 */
function ImageUpload({ value, onChange, label = 'Image', folder = 'general', optional = true }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large (max 5MB)');
      return;
    }
    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        onChange(res.data.url);
      } else {
        setError(res.data.error || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleRemove = () => {
    onChange(null);
    setError('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {optional && <span className="text-xs text-gray-400">(optional)</span>}
      </label>

      {value ? (
        <div className="relative rounded-lg border-2 border-gray-200 overflow-hidden group">
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-40 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-lg transition"
            title="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition"
        >
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 size={28} className="text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-blue-600 font-medium">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="bg-gray-100 p-3 rounded-full mb-2">
                <Upload size={20} className="text-gray-500" />
              </div>
              <p className="text-sm text-gray-600 font-medium">
                Click to upload or drag & drop
              </p>
              <p className="text-xs text-gray-400 mt-1">
                <ImageIcon size={10} className="inline mr-1" />
                JPG, PNG, WEBP · Max 5MB
              </p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-600 mt-1">⚠ {error}</p>
      )}
    </div>
  );
}

export default ImageUpload;