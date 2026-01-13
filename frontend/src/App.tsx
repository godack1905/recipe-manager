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

// Componente para rutas protegidas
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuthStore();
  
  // Muestra un loader mientras se verifica la autenticación
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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Solo ejecutar fetchFavorites si estamos autenticados
    if (isAuthenticated && !loading) {
      console.log('🔐 Usuario autenticado, cargando favoritos...');
      fetchFavorites().catch(error => {
        console.error('Error cargando favoritos:', error);
      });
    }
  }, [isAuthenticated, loading, fetchFavorites]);

  // Si estamos cargando inicialmente, mostrar loader
  if (loading && !isInitialized) {
    return <div className="flex items-center justify-center h-screen">Cargando aplicación...</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rutas protegidas */}
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