// src/pages/Items/SfgManagePage.tsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import SfgBOMPage from "./SfgBOMPage"; // pastikan path benar

export default function SfgManagePage(): JSX.Element {
  const params = useParams();
  const navigate = useNavigate();
  const sfgId = params.id ? Number(params.id) : null;

  if (!sfgId) {
    return (
      <>
        <PageMeta title="Manage SFG" />
        <PageBreadcrumb pageTitle="Items / SFG / Manage" />
        <ComponentCard title="Manage SFG">
          <div className="text-sm text-gray-500">SFG id tidak ditemukan di URL.</div>
          <div className="mt-3">
            <button className="px-3 py-1 bg-gray-100 rounded" onClick={() => navigate(-1)}>Kembali</button>
          </div>
        </ComponentCard>
      </>
    );
  }

  return (
    <>
      <PageMeta title={`Manage SFG #${sfgId}`} description="Manage RM components for this SFG" />
      <PageBreadcrumb pageTitle={`Items / SFG / Manage (#${sfgId})`} />

      <div className="space-y-6">
        <ComponentCard title={`Manage SFG #${sfgId}`}>
          {/* SfgBOMPage akan fetch komponen berdasarkan initialSfgId */}
          {/* @ts-ignore */}
          <SfgBOMPage initialSfgId={sfgId} initialComponents={null} />
        </ComponentCard>
      </div>
    </>
  );
}
