import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TelemetryDashboard from './TelemetryDashboard';

export default function AdminPage() {
  const { user } = useAuth();

  // Check if user is admin
  const isAdmin = user?.isAdmin || false;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <TelemetryDashboard />;
}
