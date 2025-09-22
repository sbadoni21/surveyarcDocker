"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react"; // Optional: for close icon

const Popup = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [loading, setLoading] = useState(false); // Loader state

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); // Start loader

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert("Message sent successfully!");
        onClose(); // Close popup
      } else {
        const data = await res.json();
        alert(data.message || "Something went wrong.");
      }
    } catch (err) {
      console.error("Submission error:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setLoading(false); // Stop loader
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="relative bg-[#fff7ed] dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8"
      >
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 text-[#111827] dark:text-[#fef3c7] hover:text-red-500 transition"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl md:text-3xl font-semibold text-center text-[#111827] dark:text-[#fef3c7] mb-2">
          Get in Touch
        </h2>
        <p className="text-center text-gray-700 dark:text-[#fef3c7] mb-6">
          We'd love to hear from you!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              name="name"
              placeholder="Your Name"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={handleChange}
            />
          </div>
          <div>
            <input
              type="email"
              name="email"
              placeholder="Your Email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={handleChange}
            />
          </div>
          <div>
            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={handleChange}
            />
          </div>
          <div>
            <textarea
              name="message"
              placeholder="Your Message"
              rows={4}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={handleChange}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f97316] hover:bg-[#fb923c] text-white py-3 rounded-lg transition font-semibold flex justify-center items-center"
          >
            {loading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                ></path>
              </svg>
            ) : (
              "Send Message"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Popup;
