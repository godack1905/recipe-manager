import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Users, ChefHat, ArrowLeft, 
  Edit, Trash2, Heart, Globe, Lock,
  Calendar, Tag, ListOrdered, Package
} from 'lucide-react';
import { useRecipeStore } from '../store/recipeStore';
import type { Ingredient } from '../lib/recipesApi';
import { useAuthStore } from '../store/authStore';
import { useIngredients } from '../hooks/useIngredients';

import { t } from "i18next";

const RecipeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRecipe, loading, fetchRecipeById, deleteRecipe, toggleFavorite, isFavorite } = useRecipeStore();
  const { user } = useAuthStore();
  const { loading: ingredientsLoading } = useIngredients();


  useEffect(() => {
    if (id) {
      fetchRecipeById(id);
    }
  }, [id, fetchRecipeById]);

  const handleDelete = async () => {
    if (window.confirm(t("recipe.deleteConfirm"))) {
      await deleteRecipe(id!);
      navigate('/recipes');
    }
  };

  const handleToggleFavorite = async () => {
    await toggleFavorite(id!);
  };

  if (loading || ingredientsLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!currentRecipe) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full p-4 inline-flex">
            <ChefHat className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">{t("recipe.notFound.title")}</h3>
          <p className="mt-2 text-gray-600">{t("recipe.notFound.description")}</p>
          <div className="mt-6">
            <Link
              to="/recipes"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("recipe.backToRecipes")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === currentRecipe.createdBy?._id;
  const isFavoriteRecipe = isFavorite(currentRecipe.id);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header with navigation */}
      <div className="mb-6">
        <Link
          to="/recipes"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("recipe.backToRecipes")}
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{currentRecipe.title}</h1>
            <p className="text-gray-600 mt-2">
              {t("recipe.by")} {currentRecipe.createdBy.username} • 
              {t("recipe.createdAt")} {new Date(currentRecipe.createdAt).toLocaleDateString('es-ES')}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-full ${isFavoriteRecipe ? 'bg-red-50' : 'bg-gray-100'} hover:bg-gray-200`}
              title={isFavoriteRecipe ? t("recipe.deleteFromFavorites") : t("recipe.addToFavorites")}
            >
              <Heart className={`h-5 w-5 ${isFavoriteRecipe ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
            </button>
            
            {isOwner && (
              <>
                <Link
                  to={`/recipes/${currentRecipe.id}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {t("recipe.edit")}
                </Link>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("recipe.delete")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Principal info */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
        {/* Image placeholder */}
        <div className="h-64 bg-gradient-to-r from-blue-100 to-green-100 flex items-center justify-center relative">
          <ChefHat className="h-24 w-24 text-blue-600" />
          
          {/* Badges */}
          <div className="absolute top-4 left-4 flex space-x-2">
            {currentRecipe.isPublic ? (
              <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full flex items-center">
                <Globe className="h-4 w-4 mr-1" />
                {t("recipe.public")}
              </span>
            ) : (
              <span className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full flex items-center">
                <Lock className="h-4 w-4 mr-1" />
                {t("recipe.private")}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentRecipe.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
              currentRecipe.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {currentRecipe.difficulty}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center text-gray-500 mb-1">
                <Users className="h-5 w-5 mr-2" />
                <span className="font-medium">{t("recipe.servings")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{currentRecipe.servings}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center text-gray-500 mb-1">
                <Calendar className="h-5 w-5 mr-2" />
                <span className="font-medium">{t("recipe.prepTime")}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{currentRecipe.prepTime || '?'} min</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {currentRecipe.description && (
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("recipe.description")}</h2>
            <p className="text-gray-700">{currentRecipe.description}</p>
          </div>
        )}

        {/* Tags */}
        {currentRecipe.tags && currentRecipe.tags.length > 0 && (
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center">
              <Tag className="h-5 w-5 mr-2" />
              {t("recipe.tags")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {currentRecipe.tags.map((tag, index) => (
                <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {t(`tags.${tag}`)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Steps & indredients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ingredients */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            {t("recipe.ingredients")}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({currentRecipe.ingredients.length})
            </span>
          </h2>
          <ul className="space-y-3">
                  {currentRecipe.ingredients.map((ingredient: Ingredient, index: number) => {
                const displayName = t(`ingredient.names.${ingredient.ingredient}`);

                return (
                <li key={index} className="flex items-start p-3 rounded-lg hover:bg-gray-50">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium text-gray-900">
                          {displayName}
                        </span>
                        <span className="text-gray-600 ml-2">
                          {ingredient.quantity} {t(`ingredient.units.${ingredient.unit}`)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <ListOrdered className="h-5 w-5 mr-2" />
            {t("recipe.steps")}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({currentRecipe.steps.length})
            </span>
          </h2>
          <ol className="space-y-4">
            {currentRecipe.steps.map((step, index) => (
              <li key={index} className="flex p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center mr-4 font-bold text-green-800">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-gray-700">{step}</p>
                  {index === currentRecipe.steps.length - 1 && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-sm text-green-600 font-medium">{t("recipe.readyToServe")}</p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetail;