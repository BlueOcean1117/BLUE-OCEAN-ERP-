import React, {
  createContext,
  useContext,
  useState,
  useEffect
} from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API_URL =
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000/api/v1";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clear session function
  const clearSession = () => {
    setUser(null);
    setPermissions(null);

    localStorage.removeItem("erp_user");
    localStorage.removeItem("erp_permissions");
    localStorage.removeItem("erp_token");
  };

  // Restore session on app start
  useEffect(() => {
    const token = localStorage.getItem("erp_token");

    if (!token) {
      setLoading(false);
      return;
    }

    // Restore instantly from localStorage first
    const storedUser = localStorage.getItem("erp_user");
    const storedPermissions =
      localStorage.getItem("erp_permissions");

    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    if (storedPermissions) {
      setPermissions(JSON.parse(storedPermissions));
    }

    // Verify token with backend
    axios
      .get(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then((res) => {
        if (res.data.success) {
          setUser(res.data.employee);
          setPermissions(res.data.permissions);

          localStorage.setItem(
            "erp_user",
            JSON.stringify(res.data.employee)
          );

          localStorage.setItem(
            "erp_permissions",
            JSON.stringify(res.data.permissions)
          );
        } else {
          clearSession();
        }
      })
      .catch((error) => {
        console.log("Auth verification failed:", error);
        clearSession();
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Login function
  const login = (userData, perms, token) => {
    setUser(userData);
    setPermissions(perms);

    localStorage.setItem(
      "erp_user",
      JSON.stringify(userData)
    );

    localStorage.setItem(
      "erp_permissions",
      JSON.stringify(perms)
    );

    localStorage.setItem(
      "erp_token",
      token
    );
  };

  // Logout function
  const logout = () => {
    clearSession();
  };

  // Check admin
  const isAdmin = () => {
    return user?.role === "admin";
  };

  // Check module access
  const canAccess = (module) => {
    // IMPORTANT FIX: admin bypass first
    if (isAdmin()) {
      return true;
    }

    if (!permissions) {
      return false;
    }

    return permissions?.[module]?.visible === true;
  };

  // Check action access
  const canDo = (module, action) => {
    // IMPORTANT FIX: admin bypass first
    if (isAdmin()) {
      return true;
    }

    if (!permissions) {
      return false;
    }

    return (
      permissions?.[module]?.actions?.[action] === true
    );
  };

  // Get token helper
  const getToken = () => {
    return localStorage.getItem("erp_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        login,
        logout,
        isAdmin,
        canAccess,
        canDo,
        getToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
