import React from "react";

export interface Brand {
  id: number;
  name: string;
  logo?: string;
  color?: string;
}

interface BrandListProps {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
  onDelete: (id: number) => void;
}

const BrandList: React.FC<BrandListProps> = ({ brands, onEdit, onDelete }) => {
  return (
    <table className="table table-bordered">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Logo</th>
          <th>Color</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {brands.map((brand) => (
          <tr key={brand.id}>
            <td>{brand.id}</td>
            <td>{brand.name}</td>
            <td>
              {brand.logo && <img src={brand.logo} alt="logo" width={50} />}
            </td>
            <td>
              <div
                style={{
                  backgroundColor: brand.color ?? "#ffffff",
                  width: 50,
                  height: 20,
                }}
              />
            </td>
            <td>
              <button
                className="btn btn-sm btn-primary me-2"
                onClick={() => onEdit(brand)}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => onDelete(brand.id)}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default BrandList;
