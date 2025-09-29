
// components/tickets/CategorySelector.jsx
"use client";
import { useTicketCategories } from "@/providers/postGresPorviders/TicketCategoryProvider";
import { useState, useEffect } from "react";

export function CategorySelector({ orgId, value, onChange, onSubcategoryChange, onProductChange }) {
  const { listCategories, listSubcategories, listProducts } = useTicketCategories();
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(value?.category || "");
  const [selectedSubcategory, setSelectedSubcategory] = useState(value?.subcategory || "");
  const [selectedProduct, setSelectedProduct] = useState(value?.product || "");

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  useEffect(() => {
    if (selectedCategory) {
      loadSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory("");
    }
  }, [selectedCategory]);

  const loadData = async () => {
    try {
      const [cats, prods] = await Promise.all([
        listCategories(orgId),
        listProducts(orgId),
      ]);
      setCategories(cats);
      setProducts(prods);
    } catch (error) {
      console.error("Failed to load categories/products:", error);
    }
  };

  const loadSubcategories = async (categoryId) => {
    try {
      const subs = await listSubcategories(orgId, categoryId);
      setSubcategories(subs);
    } catch (error) {
      console.error("Failed to load subcategories:", error);
    }
  };

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    setSelectedCategory(catId);
    setSelectedSubcategory("");
    onChange?.(catId);
    onSubcategoryChange?.("");
  };

  const handleSubcategoryChange = (e) => {
    const subId = e.target.value;
    setSelectedSubcategory(subId);
    onSubcategoryChange?.(subId);
  };

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    setSelectedProduct(prodId);
    onProductChange?.(prodId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Category Dropdown */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Category
        </label>
        <select
          value={selectedCategory}
          onChange={handleCategoryChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a category...</option>
          {categories.map((cat) => (
            <option key={cat.categoryId} value={cat.categoryId}>
              {cat.icon && `${cat.icon} `}{cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Subcategory Dropdown */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Subcategory
        </label>
        <select
          value={selectedSubcategory}
          onChange={handleSubcategoryChange}
          disabled={!selectedCategory || subcategories.length === 0}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select a subcategory...</option>
          {subcategories.map((sub) => (
            <option key={sub.subcategoryId} value={sub.subcategoryId}>
              {sub.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product Dropdown */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Product
        </label>
        <select
          value={selectedProduct}
          onChange={handleProductChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a product...</option>
          {products.map((prod) => (
            <option key={prod.productId} value={prod.productId}>
              {prod.name} {prod.version && `(${prod.version})`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}