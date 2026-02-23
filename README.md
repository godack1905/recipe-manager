# AutoEats

**AI-Powered Recipe Management and Meal Planning Application**

AutoEats is a modern, full-stack web application designed to simplify meal planning and recipe management. With integrated AI capabilities, AutoEats intelligently generates personalized monthly meal plans tailored to your preferences, dietary requirements, and available ingredients.

---

## ✨ Features

- **Recipe Management**: Create, edit, and organize your favorite recipes with detailed ingredient lists and instructions
- **Ingredient Database**: Comprehensive ingredient catalog with nutritional information and unit conversions
- **AI-Powered Meal Planning**: Automatic generation of balanced monthly meal plans using artificial intelligence
- **Customizable Plans**: Adjust meal plans based on dietary preferences, restrictions, and available ingredients
- **User Authentication**: Secure user accounts with registration and login functionality
- **Ingredient Search**: Advanced search and filtering capabilities across the ingredient database
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Multi-language Support**: Built-in internationalization (English and Spanish)

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Localization**: i18next
- **UI Components**: Lucide React Icons

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **API Documentation**: RESTful architecture

### DevOps
- **Containerization**: Docker & Docker Compose
- **Environment Management**: Environment variables via `.env`

---

## 📋 Prerequisites

Before running AutoEats, ensure you have the following installed:

- **Docker** and **Docker Compose** ([Get Docker](https://docs.docker.com/get-docker/))
- **Node.js** 16+ (for local development without Docker)
- **npm** or **yarn** (for dependency management)

---

## 🚀 Quick Start

### Using Docker (Recommended)

Clone the repository and start the application with a single command:

```bash
docker-compose up --build
```

The application will be available at:
- **Frontend**: http://localhost/
- **Backend API**: http://localhost:5000/api/

### Local Development

For local development you will need MongoDB installed

#### 1. Backend Setup

```bash
cd backend
npm install
npm run dev
```

The backend server will start on `http://localhost:5000`

#### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will start on `http://localhost:5173`

---

## 📁 Project Structure

```
recipe-manager/
├── backend/                          # Express.js REST API
│   ├── src/
│   │   ├── controllers/             # Route handlers
│   │   ├── models/                  # MongoDB schemas
│   │   ├── routes/                  # API endpoints
│   │   ├── middlewares/             # Custom middleware (auth, error handling)
│   │   ├── messages/                # Response utilities
│   │   ├── data/                    # Static data (ingredients)
│   │   ├── app.js                   # Express app configuration
│   │   └── server.js                # Server entry point
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                         # React + TypeScript SPA
│   ├── src/
│   │   ├── components/              # Reusable React components
│   │   ├── pages/                   # Page components (routes)
│   │   ├── store/                   # Zustand state management
│   │   ├── lib/                     # API clients and utilities
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── constants/               # Application constants
│   │   ├── assets/                  # Static assets
│   │   ├── App.tsx                  # Root component
│   │   └── main.tsx                 # Application entry point
│   ├── public/
│   │   └── locales/                 # i18n translation files
│   ├── Dockerfile
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Continuous Integration pipeline
│       └── cd.yml                   # Continuous Deployment pipeline
│
├── docker-compose.yml               # Docker Compose configuration
├── .env.example                     # Environment variables template
└── README.md
```

---

## 🔐 Environment Variables

Create a `.env` file in the backend directory:

```env
# Backend Configuration
PORT=5000
MONGODB_URI=mongodb://mongo:27017/autoeats
JWT_SECRET=your_jwt_secret_key_here

# Frontend Configuration (if needed)
VITE_API_URL=http://localhost:5000
```

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Recipes
- `GET /api/recipes` - List all recipes
- `POST /api/recipes` - Create a new recipe
- `GET /api/recipes/:id` - Get recipe details
- `PUT /api/recipes/:id` - Update a recipe
- `DELETE /api/recipes/:id` - Delete a recipe

### Ingredients
- `GET /api/ingredients` - List all ingredients
- `GET /api/ingredients/:name` - Get ingredient by name

### Meal Plans
- `GET /api/meal-plans` - List user meal plans
- `POST /api/meal-plans` - Create a new meal plan
- `PUT /api/meal-plans/:id` - Update a meal plan
- `DELETE /api/meal-plans/:id` - Delete a meal plan

### AI Services
- `POST /api/ai/generate-plan` - Generate AI meal plan

---

## 🧑‍💻 Development

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests (if available)
npm test
```

---

## 🔄 CI/CD Pipeline

AutoEats uses **GitHub Actions** for continuous integration and continuous deployment, ensuring code quality and automated deployments.

### Continuous Integration (CI)

The CI pipeline runs on every push to `main` and `develop` branches, and on all pull requests.

**Workflow**: `.github/workflows/ci.yml`

#### Backend CI
- ✅ Node.js 18 setup with dependency caching
- ✅ Dependency installation (`npm ci`)
- ✅ Code linting with ESLint
- ✅ Unit and integration test execution
- ✅ Test coverage validation

#### Frontend CI
- ✅ Node.js 18 setup with dependency caching
- ✅ Dependency installation (`npm ci`)
- ✅ TypeScript linting and type checking
- ✅ Production build verification
- ✅ Build output validation

### Continuous Deployment (CD)

The CD pipeline automatically builds and publishes Docker images to **GitHub Container Registry (GHCR)** on every push to the `main` branch.

**Workflow**: `.github/workflows/cd.yml`

**Features**:
- 🐳 Automated Docker image building for backend and frontend
- 📦 Images pushed to GHCR with multiple tags:
  - `latest` - Latest stable version
  - `<commit-sha>` - Specific commit version for rollback capability
- 🔐 Secure credential management via GitHub Secrets
- 🚀 Multi-architecture image support

**Image Locations**:
- Backend: `ghcr.io/<owner>/autoeats/backend:latest`
- Frontend: `ghcr.io/<owner>/autoeats/frontend:latest`

### Required GitHub Secrets

For the CD pipeline to work, configure the following secrets in your GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `GHCR_USERNAME` | GitHub username for GHCR authentication |
| `GHCR_TOKEN` | GitHub Personal Access Token with `write:packages` scope |

**How to set up**:
1. Go to GitHub repository → Settings → Secrets and Variables → Actions
2. Add new repository secrets with the values above

### GitHub Actions Status

You can view the status of all workflows by:
1. Navigate to your repository on GitHub
2. Click **Actions** tab
3. View detailed logs and execution history

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Note**: All pull requests will automatically run through the CI pipeline to ensure code quality.

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📧 Support

For issues, questions, or suggestions, please open an issue on the repository or contact the development team.

---

**Happy meal planning! 🍽️**

