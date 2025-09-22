'use client';

import React from 'react';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { RiDeleteBin6Line } from 'react-icons/ri';

export default function PictureChoiceConfig({ config, updateConfig }) {
  const images = Array.isArray(config.images) ? config.images : [];

  const handleImageChange = (index, field, value) => {
    const newImages = [...images];
    newImages[index] = {
      ...newImages[index],
      [field]: value,
    };
    updateConfig('images', newImages);
  };

  const addImage = () => {
    updateConfig('images', [...images, { url: '', label: '', storagePath: '' }]);
  };

  const removeImage = async (index) => {
    const image = images[index];
    if (image.storagePath) {
      try {
        const storage = getStorage();
        const imageRef = ref(storage, image.storagePath);
        await deleteObject(imageRef);
      } catch (err) {
        console.warn('Image delete failed:', err.message);
      }
    }

    const newImages = images.filter((_, i) => i !== index);
    updateConfig('images', newImages);
  };

  const handleUpload = async (index, file) => {
    const storage = getStorage();
    const path = `pictureChoices/${uuidv4()}-${file.name}`;
    const storageRef = ref(storage, path);

    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      const newImages = [...images];
      newImages[index] = {
        ...newImages[index],
        url: downloadURL,
        storagePath: path,
      };
      updateConfig('images', newImages);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  return (
    <div className="space-y-6 dark:bg-[#1A1A1E]">
      <label className="block font-medium text-lg">Picture Choices</label>

      {images.map((img, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 p-4 border rounded-xl bg-white dark:bg-[#1A1A1E] shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {img.url ? (
              <img
                src={img.url}
                alt={`Uploaded preview ${i}`}
                className="w-32 h-32 rounded object-cover border"
              />
            ) : (
              <div className="w-32 h-32 flex items-center dark:bg-[#1A1A1E] justify-center text-sm text-gray-400 bg-gray-100 rounded border">
                No image
              </div>
            )}

            <div className="flex-1 space-y-2">
              <input
                type="text"
                className="w-full border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] p-2 rounded"
                placeholder="Image URL"
                value={img.url}
                onChange={(e) => handleImageChange(i, 'url', e.target.value)}
              />
              <input
                type="text"
                className="w-full border dark:bg-[#1A1A1E] dark:text-[#CBC9DE] p-2 rounded"
                placeholder="Label (optional)"
                value={img.label}
                onChange={(e) => handleImageChange(i, 'label', e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleUpload(i, e.target.files[0]);
                  }
                }}
                className="w-full text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => removeImage(i)}
              className="text-red-600 font-semibold text-sm hover:underline self-start"
            >
             <RiDeleteBin6Line size={22} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addImage}
        className="bg-[#D5D5D5] text-black text-sm px-4 py-2 rounded font-semibold"
      >
        + Add Picture Choice
      </button>
    </div>
  );
}
