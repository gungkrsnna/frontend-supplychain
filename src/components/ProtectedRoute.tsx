// src/components/ProtectedRoute.tsx
import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

interface Props {
  children: JSX.Element;
  allowedRoles?: string[]; // optional - if omitted allow any logged-in user
}

const ProtectedRoute: React.FC<Props> = ({ children, allowedRoles = [] }) => {
  const { token, user } = useContext(AuthContext);
  const location = useLocation();

  // not logged in -> send to login, save attempted path in state
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // role restriction
  if (allowedRoles.length > 0) {
    const role = (user.role || '').toString().toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());
    if (!normalizedAllowed.includes(role)) {
      // optionally show Unauthorized page instead
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
