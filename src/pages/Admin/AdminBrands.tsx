import React, { useState, useEffect } from "react";
import axios from "axios";
import BrandList, { Brand } from "../../components/BrandList";
import BrandForm from "../../components/BrandForm";

const AdminBrands: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);

  const fetchBrands = async () => {
  try {
    const res = await axios.get("/api/brands"); // jangan pakai full URL
    console.log("API response:", res.data); // HARUS array JSON
    setBrands(res.data);
  } catch (err) {
    console.error(err);
  }
};



  useEffect(() => {
    fetchBrands();
  }, []);

  const handleAdd = async (brand: Omit<Brand, "id">) => {
    try {
      await axios.post("/api/brands", brand);
      fetchBrands();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (brandData: Omit<Brand, "id">) => {
    if (!editingBrand) return;
    try {
      await axios.put(`/api/brands/${editingBrand.id}`, brandData);
      setEditingBrand(null);
      fetchBrands();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure to delete this brand?")) return;
    try {
      await axios.delete(`/api/brands/${id}`);
      fetchBrands();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container mt-5">
      <h2>Manage Brands</h2>
      <div className="mb-4">
        <BrandForm
          onSubmit={editingBrand ? handleUpdate : handleAdd}
          initialData={editingBrand}
          onCancel={() => setEditingBrand(null)}
        />
      </div>
      <BrandList
        brands={brands}
        onEdit={setEditingBrand}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default AdminBrands;
