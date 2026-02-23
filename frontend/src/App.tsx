import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useRecipeStore } from './store/recipeStore';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Recipes from './pages/Recipes';
import RecipeDetail from './pages/RecipeDetail';
import RecipeCreate from './pages/RecipeCreate';
import RecipeEdit from './pages/RecipeEdit';
import Calendar from './pages/CalendarPage.jsx';

// Layout
import Layout from './components/ui/Layout';

import { useTranslation } from 'react-i18next';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuthStore();
  
  // Show loading state while checking authentication
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

function App() {
  const { isAuthenticated, loading } = useAuthStore();
  const { fetchFavorites } = useRecipeStore();
  const [isInitialized] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Only fetch favorites after authentication is confirmed
    if (isAuthenticated && !loading) {
      fetchFavorites().catch(error => {
        console.error('Error fetching favorites:', error);
      });
    }
  }, [isAuthenticated, loading, fetchFavorites]);

  // If still loading auth state on initial app load
  if (loading && !isInitialized) {
    return <div className="flex items-center justify-center h-screen">{t("loadingApp")}</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Recipes />
            </ProtectedRoute>
          } />
          
          <Route path="/recipes" element={
            <ProtectedRoute>
              <Recipes />
            </ProtectedRoute>
          } />
          
          <Route path="/recipes/:id" element={
            <ProtectedRoute>
              <RecipeDetail />
            </ProtectedRoute>
          } />
          
          <Route path="/new-recipe" element={
            <ProtectedRoute>
              <RecipeCreate />
            </ProtectedRoute>
          } />
          
          <Route path="/recipes/:id/edit" element={
            <ProtectedRoute>
              <RecipeEdit />
            </ProtectedRoute>
          } />
          
          <Route path="/calendar" element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          } />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;