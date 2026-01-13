import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChefHat, LogOut, User, Menu, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const Header: React.FC<{ onToggleSidebar?: () => void }> = ({ onToggleSidebar }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <ChefHat className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-bold text-gray-800">Recipe Manager</span>
        </Link>

        {/* Desktop User Info */}
        <div className="hidden sm:flex items-center space-x-4">
          {user && (
            <>
              <div className="flex items-center space-x-2 text-gray-700">
                <User className="h-5 w-5" />
                <span>{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-red-600 hover:text-red-800 transition px-3 py-2 rounded-lg hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
                <span>Cerrar Sesión</span>
              </button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="sm:hidden flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100"
          onClick={() => {
            setMenuOpen(!menuOpen);
            onToggleSidebar?.();
          }}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
    </header>
  );
};

export default Header;
