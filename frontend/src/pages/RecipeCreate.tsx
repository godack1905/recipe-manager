// @ts-expect-error: i18next import type issue
import { t } from 'i18next';
import AddRecipeForm from '../components/recipes/AddRecipeForm';

const RecipeCreate = () => {

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("recipe.create.title")}</h1>
        <p className="text-gray-600">{t("recipe.create.description")}</p>
      </div>
      
      <AddRecipeForm />
    </div>
  );
};

export default RecipeCreate;