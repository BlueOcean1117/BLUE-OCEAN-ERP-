import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Protect routes based on module permission
export function ModuleProtectedRoute({
  module,
  children
}) {
  const {
    canAccess,
    user,
    loading
  } = useAuth();

  if (loading) return null;

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // IMPORTANT FIX: Admin always bypasses
  if (user.role === "admin") {
    return children;
  }

  // Employee permission check
  if (!canAccess(module)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  return children;
}

// Only admin access
export function AdminRoute({
  children
}) {
  const {
    isAdmin,
    user,
    loading
  } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin()) {
    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  return children;
}

// Any authenticated user
export function AuthRoute({
  children
}) {
  const {
    user,
    loading
  } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Unauthorized page
export function UnauthorizedPage() {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>
        🔒
      </div>

      <h2 style={styles.title}>
        Access Denied
      </h2>

      <p style={styles.msg}>
        You don't have permission to access this module.
      </p>

      <p style={styles.hint}>
        Contact your administrator to request access.
      </p>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    textAlign: "center"
  },

  icon: {
    fontSize: 56,
    marginBottom: 16
  },

  title: {
    margin: "0 0 10px",
    fontSize: 28,
    fontWeight: 700,
    color: "#0f172a"
  },

  msg: {
    margin: "0 0 8px",
    color: "#64748b",
    fontSize: 16
  },

  hint: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 14
  }
};
