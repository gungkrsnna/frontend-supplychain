import React, { useState, useEffect } from "react";
import { Brand } from "./BrandList";

interface BrandFormProps {
  onSubmit: (brand: Omit<Brand, "id">) => void;
  initialData?: Brand | null;
  onCancel?: () => void;
}

const BrandForm: React.FC<BrandFormProps> = ({ onSubmit, initialData, onCancel }) => {
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [color, setColor] = useState("#000000");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setLogo(initialData.logo || "");
      setColor(initialData.color || "#000000");
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit({ name, logo, color });
    setName("");
    setLogo("");
    setColor("#000000");
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label>Name</label>
        <input
          type="text"
          className="form-control"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="mb-3">
        <label>Logo URL</label>
        <input
          type="text"
          className="form-control"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label>Color</label>
        <input
          type="color"
          className="form-control form-control-color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-success me-2">
        {initialData ? "Update" : "Add"} Brand
      </button>
      {initialData && onCancel && (
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
};

export default BrandForm;
