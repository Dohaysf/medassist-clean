// frontend/src/components/PrivateRoute.jsx
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');
  if (!token) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/login" />;
  return children;
};

export default PrivateRoute;