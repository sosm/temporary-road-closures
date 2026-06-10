# OSM Road Closures Frontend

A Next.js-based frontend application for the OpenStreetMap Temporary Road Closures Database and API project, designed as part of Google Summer of Code 2025.

[![Next.js 15](https://img.shields.io/badge/Next.js-15.4.1-black.svg)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.1.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC.svg)](https://tailwindcss.com/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## 🚀 Introduction

The OSM Road Closures Frontend provides an intuitive, responsive web interface for community-driven road closure reporting and management. Built with modern web technologies, it seamlessly integrates with the FastAPI backend to deliver real-time closure information to the OpenStreetMap ecosystem.

### Key Features

-   **🗺️ Interactive Mapping**: Leaflet.js-powered maps with OpenStreetMap tiles
-   **📱 Responsive Design**: Mobile-first approach with full desktop support
-   **🎯 Point & Segment Closures**: Support for both point locations and road segments
-   **🛣️ Intelligent Routing**: Valhalla API integration for automatic route calculation
-   **🔐 Secure Authentication**: JWT-based auth with session management
-   **📊 Real-time Analytics**: Comprehensive statistics and insights dashboard
-   **✏️ CRUD Operations**: Create, read, update, and delete closures with permissions
-   **🌐 Closure-Aware Routing**: Advanced routing that avoids relevant road closures
-   **📱 Progressive Enhancement**: Works offline with cached data
-   **🎨 Modern UI/UX**: Clean, accessible interface with smooth animations

### Core Capabilities

-   **Multi-step Closure Reporting**: Guided 3-step form for accurate closure submission
-   **Geometry Selection**: Interactive point selection and LineString creation with routing
-   **Bidirectional Support**: Proper handling of one-way vs. bidirectional closures
-   **Transportation Mode Filtering**: Smart filtering based on closure impact (auto, bicycle, pedestrian)
-   **Real-time Updates**: Live synchronization with backend API
-   **OpenLR Integration**: Universal location referencing for cross-platform compatibility
-   **Demo Mode**: Full-featured demo with mock data when backend unavailable
-   **Edit Permissions**: User-based edit controls with moderator capabilities
-   **Status Management**: Active, upcoming, expired, and cancelled closure states

## 📚 Application Structure

### Available Pages

| Route                    | Description                                 | Authentication |
| ------------------------ | ------------------------------------------- | -------------- |
| `/`                      | Landing page with project overview          | None           |
| `/closures`              | Main application - view and report closures | Optional\*     |
| `/closure-aware-routing` | Advanced routing demo avoiding closures     | None           |
| `/docs`                  | Interactive documentation and API guide     | None           |
| `/login`                 | User authentication                         | None           |
| `/register`              | User registration                           | None           |

\*Login required for creating, editing, and deleting closures

### Key Components

| Component         | Description                  | Features                                                            |
| ----------------- | ---------------------------- | ------------------------------------------------------------------- |
| `MapComponent`    | Interactive Leaflet map      | Point/LineString selection, Valhalla routing, closure visualization |
| `ClosureForm`     | Multi-step closure creation  | 3-step wizard, geometry selection, validation                       |
| `EditClosureForm` | Closure editing interface    | Permission-based editing, status updates                            |
| `Sidebar`         | Closures list and statistics | Real-time updates, filtering, edit controls                         |
| `RoutingForm`     | Closure-aware route planning | Transportation mode selection, route comparison                     |
| `StatsDashboard`  | Analytics and insights       | Closure statistics, OpenLR integration status                       |

## 🏃 Quick Start

### Prerequisites

-   Node.js 18.0 or higher
-   npm, yarn, or pnpm
-   Backend API running (see [backend README](../backend/README.md))

### 1. Clone and Setup

```bash
# Navigate to frontend directory
cd temporary-road-closures/frontend

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### 2. Configure Environment

Create a `.env.local` file in the frontend root:

```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# Valhalla Routing Service
NEXT_PUBLIC_VALHALLA_URL=https://valhalla1.openstreetmap.de/route

# Development Options
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_DEBUG_ROUTING=false
```

### 3. Start Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

### 4. Open Your Browser

Navigate to `http://localhost:3000`

**Available Services:**

-   **Frontend**: http://localhost:3000
-   **Backend API**: http://localhost:8000 (if running)
-   **Interactive Docs**: http://localhost:3000/docs

## 🛠️ Development Setup

### Local Development

```bash
# Install dependencies
npm install

# Run development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Test routing integration
npm run test:routing
```

### Docker Development (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run with Docker
docker build -t osm-closures-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000 osm-closures-frontend
```

### Project Structure

```
frontend/
├── app/                      # Next.js App Router directory
│   ├── globals.css          # Global styles and Tailwind imports
│   ├── layout.tsx           # Root layout component
│   ├── page.tsx             # Landing page
│   ├── closures/            # Main application pages
│   │   ├── layout.tsx       # Closures section layout
│   │   └── page.tsx         # Closures map and reporting interface
│   ├── closure-aware-routing/ # Advanced routing demo
│   │   ├── layout.tsx       # Routing demo layout
│   │   └── page.tsx         # Transportation-aware routing
│   ├── docs/                # Documentation pages
│   │   ├── layout.tsx       # Docs layout
│   │   └── page.tsx         # Interactive documentation
│   ├── login/               # Authentication pages
│   │   └── page.tsx         # Login form
│   └── register/            # User registration
│       └── page.tsx         # Registration form
├── components/              # React components
│   ├── Auth/                # Authentication components
│   │   └── Login.tsx        # Login modal component
│   ├── Demo/                # Demo and development components
│   │   ├── ClosuresList.tsx # Transportation-aware closures list
│   │   ├── DemoControlPanel.tsx # Development control panel
│   │   ├── RoutingForm.tsx  # Route planning form
│   │   └── RoutingMapComponent.tsx # Routing-specific map
│   ├── Docs/                # Documentation components
│   │   ├── Content.tsx      # Documentation content renderer
│   │   ├── Header.tsx       # Docs navigation header
│   │   └── Sidebar.tsx      # Docs navigation sidebar
│   ├── Forms/               # Form components
│   │   ├── ClosureForm.tsx  # Multi-step closure creation
│   │   └── EditClosureForm.tsx # Closure editing interface
│   ├── Home/                # Landing page components
│   │   ├── CTASection.tsx   # Call-to-action sections
│   │   ├── Features.tsx     # Features showcase
│   │   ├── Footer.tsx       # Site footer
│   │   ├── Header.tsx       # Site header
│   │   ├── Hero.tsx         # Hero section with animation
│   │   └── Navbar.tsx       # Navigation bar
│   ├── Layout/              # Layout components
│   │   ├── Header.tsx       # Application header
│   │   ├── Layout.tsx       # Main layout wrapper
│   │   ├── Sidebar.tsx      # Closures list sidebar
│   │   └── StatsDashboard.tsx # Statistics dashboard
│   ├── Map/                 # Map-related components
│   │   └── MapComponent.tsx # Interactive Leaflet map
│   └── ClientOnly.tsx       # Client-side only wrapper
├── context/                 # React Context providers
│   └── ClosuresContext.tsx  # Global state management
├── services/                # API and external services
│   ├── api.ts               # Main API client and types
│   ├── mockApi.ts           # Mock API for demo mode
│   └── valhallaApi.ts       # Valhalla routing integration
├── data/                    # Static data and constants
├── public/                  # Static assets
├── .env.local               # Environment variables (create this)
├── next.config.ts           # Next.js configuration
├── package.json             # Dependencies and scripts
├── tailwind.config.js       # Tailwind CSS configuration (v4)
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## 🔧 Application Usage

### Reporting a Road Closure

1. **Navigate to Closures**: Visit `/closures` or click "View Closures" from homepage
2. **Login** (if not already): Click "Login" in header and authenticate
3. **Start Reporting**: Click "Report Closure" button in header
4. **Step 1 - Closure Details**:
    - Enter detailed description
    - Select geometry type (Point or Road Segment)
    - Choose closure reason (construction, accident, event, etc.)
    - Set confidence level (1-10)
5. **Step 2 - Location & Timing**:
    - Click on map to select location(s)
    - For Road Segments: Select 2+ points for automatic Valhalla routing
    - Set start and end times
    - Configure bidirectional settings (for road segments)
    - Specify data source
6. **Step 3 - Review & Submit**:
    - Review all information
    - See route calculation results (if applicable)
    - Submit to backend with OpenLR encoding

### Viewing and Managing Closures

-   **Map View**: All closures displayed with status-based styling
    -   Red: Active closures currently blocking traffic
    -   Yellow: Upcoming scheduled closures
    -   Gray: Expired or inactive closures
-   **Sidebar List**: Comprehensive closure information with:
    -   Real-time status updates
    -   Geometry type indicators (📍 points, 🛣️ segments)
    -   Direction information (↔ bidirectional, → unidirectional)
    -   Edit/delete controls for your closures
-   **Click Interaction**: Click any closure for detailed popup information
-   **Permission-based Editing**: Edit your own closures or all closures (if moderator)

### Closure-Aware Routing

1. **Navigate to Routing**: Visit `/closure-aware-routing`
2. **Select Transportation Mode**:
    - 🚗 **Auto**: Affected by construction, accidents, events
    - 🚲 **Bicycle**: Affected by construction, accidents, bike lane closures
    - 🚶 **Pedestrian**: Affected by sidewalk repairs, emergencies
3. **Set Route Points**:
    - Enter addresses or click on map
    - Select start and destination locations
4. **Calculate Route**: System automatically:
    - Finds closures in route area
    - Filters by transportation mode relevance
    - Calculates closure-aware route with Valhalla
    - Shows comparison with direct route
5. **Review Results**:
    - Distance and time comparison
    - Number of closures avoided
    - Transportation-specific analysis

### Authentication & User Management

-   **Registration**: Create account with username, email, full name
-   **Login**: Authenticate to access creation/editing features
-   **Demo Mode**: Full read-only access without authentication
-   **Session Management**: Automatic token refresh and expiration handling
-   **Permission System**: Users can edit own closures, moderators edit all

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   React Pages   │    │   Components    │
│   (App Router)  │◄──►│   & Layouts     │◄──►│   & Contexts    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Services  │    │  Leaflet Maps   │    │  Form Handling  │
│   (Real + Mock) │    │  (React-Leaflet)│    │ (React Hook Form│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  FastAPI Backend│    │  Valhalla API   │    │  Browser APIs   │
│  + PostGIS DB   │    │  (Routing)      │    │ (LocalStorage)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

**Core Framework:**

-   **Next.js 15**: React framework with App Router, server-side rendering
-   **React 19**: Component library with latest features
-   **TypeScript 5**: Type safety and developer experience

**Styling & UI:**

-   **Tailwind CSS v4**: Utility-first CSS framework
-   **Lucide React**: Modern icon library
-   **React Hot Toast**: Notification system

**Mapping & Geospatial:**

-   **Leaflet.js**: Open-source interactive maps
-   **React-Leaflet**: React integration for Leaflet
-   **Valhalla API**: Open-source routing engine

**Forms & State:**

-   **React Hook Form**: Performant form handling with validation
-   **React Context API**: Global state management
-   **date-fns**: Date manipulation and formatting

**HTTP & API:**

-   **Axios**: HTTP client with interceptors
-   **JWT**: JSON Web Token authentication
-   **OpenLR**: Location referencing standard

### Component Architecture

**State Management Flow:**

```
ClosuresContext (Global State)
    ↓
Pages (Route Components)
    ↓
Layout Components
    ↓
Feature Components (Forms, Maps, Lists)
    ↓
UI Components (Buttons, Inputs, etc.)
```

**API Integration Pattern:**

```
Component → Service Layer → API Client → Backend/Mock
                ↓
        Error Handling & Loading States
                ↓
        Context State Updates
                ↓
        UI Re-render
```

## 📊 Data Flow & Integration

### Closure Creation Flow

1. **User Input**: Multi-step form with validation
2. **Geometry Selection**: Interactive map point/line selection
3. **Route Calculation**: Valhalla API integration for LineStrings
4. **Data Validation**: Client-side and server-side validation
5. **Backend Submission**: JWT-authenticated API call
6. **OpenLR Encoding**: Server-side location referencing
7. **Real-time Update**: Context state update and UI refresh

### Authentication Flow

1. **Login Request**: Username/password to backend OAuth2 endpoint
2. **Token Storage**: JWT token in localStorage with expiration tracking
3. **Request Interception**: Automatic token attachment to API requests
4. **Token Validation**: Client-side expiration checking
5. **Auto-logout**: Cleanup on token expiration or errors

### Routing Integration

1. **Point Selection**: User clicks on map to define waypoints
2. **Geometry Detection**: Distinguish between Point and LineString
3. **Valhalla Call**: Automatic routing for 2+ points
4. **Route Processing**: Decode polyline and calculate statistics
5. **Closure Submission**: Use routed coordinates for accurate closures

## ⚙️ Configuration

### Environment Variables

| Variable                    | Description               | Default                                    | Required |
| --------------------------- | ------------------------- | ------------------------------------------ | -------- |
| `NEXT_PUBLIC_API_URL`       | Backend FastAPI URL       | `http://localhost:8000`                    | Yes      |
| `NEXT_PUBLIC_VALHALLA_URL`  | Valhalla routing service  | `https://valhalla1.openstreetmap.de/route` | No       |
| `NEXT_PUBLIC_USE_MOCK_API`  | Force mock API usage      | `false`                                    | No       |
| `NEXT_PUBLIC_DEBUG_ROUTING` | Enable routing debug logs | `false`                                    | No       |

### Next.js Configuration

```typescript
// next.config.ts highlights
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_API_URL:
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
        NEXT_PUBLIC_VALHALLA_URL:
            process.env.NEXT_PUBLIC_VALHALLA_URL ||
            "https://valhalla1.openstreetmap.de/route",
    },
    experimental: {
        esmExternals: true,
        optimizeCss: true,
        swcMinify: true,
    },
    output: "standalone",
};
```

### Tailwind Configuration

```javascript
// tailwind.config.js (v4 setup)
module.exports = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                blue: {
                    50: "#eff6ff",
                    600: "#2563eb",
                    700: "#1d4ed8",
                },
            },
        },
    },
};
```

## 🧪 Testing & Development

### Available Scripts

```bash
# Development with Turbopack (faster builds)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Code linting
npm run lint

# Test Valhalla routing integration
npm run test:routing
```

### Development Features

-   **Hot Reload**: Instant updates during development
-   **TypeScript**: Full type checking and IntelliSense
-   **ESLint**: Code quality and consistency checking
-   **Auto Mock Detection**: Seamless fallback to demo data
-   **Debug Logging**: Comprehensive console logging for debugging
-   **Error Boundaries**: Graceful error handling and recovery

### Mock API Features

When backend is unavailable, the frontend automatically switches to mock mode:

-   **25+ Sample Closures**: Realistic demo data in Chicago area
-   **CRUD Operations**: Full create, read, update, delete simulation
-   **Permission System**: Simulated user permissions and ownership
-   **Statistics**: Calculated analytics from mock data
-   **Persistence**: Changes persist during session (localStorage)
-   **Auto-reset**: Fresh demo data on page refresh

## 🔧 Troubleshooting

### Common Issues

**Backend Connection Failed**

```bash
# Check if backend is running
curl http://localhost:8000/health

# Verify environment variable
echo $NEXT_PUBLIC_API_URL

# Check for CORS issues in browser console
```

**Map Not Loading**

```bash
# Verify Leaflet CSS is imported
# Check for JavaScript errors in console
# Ensure component is client-side rendered

# Common fix - dynamic import
const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false });
```

**Routing Not Working**

```bash
# Test Valhalla API connectivity
npm run test:routing

# Check network tab for CORS errors
# Verify coordinates are in valid ranges
```

**Authentication Issues**

```bash
# Clear localStorage data
localStorage.clear();

# Check token expiration
# Verify backend /auth endpoints are accessible
```

**Build Errors**

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npm run lint
```

### Debugging Tips

**Enable Debug Logging:**

```env
NEXT_PUBLIC_DEBUG_ROUTING=true
```

**Check API Status:**

```javascript
// In browser console
window.localStorage.getItem("auth_token");
```

**Verify Mock Mode:**

```javascript
// Check if using mock data
console.log("Using mock API:", !navigator.onLine || !authApi.isTokenValid());
```

## 📱 Mobile & Responsive Features

### Mobile Optimizations

-   **Touch-friendly Interface**: Large tap targets and gesture support
-   **Responsive Breakpoints**: Mobile-first design with tablet and desktop layouts
-   **Swipe Navigation**: Touch gestures for map and form interactions
-   **Offline Capability**: Service worker for basic offline functionality
-   **Performance**: Optimized bundle size and lazy loading

### Accessibility Features

-   **Keyboard Navigation**: Full keyboard accessibility for all interactions
-   **Screen Reader Support**: ARIA labels and semantic HTML
-   **High Contrast**: WCAG-compliant color ratios
-   **Focus Management**: Proper focus handling for modals and forms
-   **Alternative Text**: Comprehensive alt text for images and icons

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository**: Link GitHub repo to Vercel
2. **Configure Environment**: Set variables in Vercel dashboard
3. **Deploy**: Automatic deployment on git push
4. **Custom Domain**: Configure custom domain if needed

```bash
# Deploy with Vercel CLI
npm i -g vercel
vercel --prod
```

### Other Platforms

**Netlify:**

```bash
# Build command
npm run build

# Publish directory
.next
```

**Railway:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway deploy
```

**Docker Deployment:**

```bash
# Build image
docker build -t osm-closures-frontend .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://your-backend.com \
  osm-closures-frontend
```

### Production Considerations

-   **Environment Variables**: Set production API URLs
-   **HTTPS**: Ensure SSL certificates for security
-   **CDN**: Configure asset optimization and caching
-   **Monitoring**: Set up error tracking and analytics
-   **Performance**: Enable compression and caching headers

## 📈 Performance Optimization

### Implemented Optimizations

-   **Dynamic Imports**: Code splitting for map components
-   **Image Optimization**: Next.js automatic image optimization
-   **Bundle Splitting**: Automatic route-based code splitting
-   **Caching**: Smart API response caching
-   **Compression**: Gzip compression enabled
-   **Tree Shaking**: Unused code elimination

### Performance Metrics

-   **First Contentful Paint**: < 1.5s
-   **Largest Contentful Paint**: < 2.5s
-   **Cumulative Layout Shift**: < 0.1
-   **Time to Interactive**: < 3.5s

### Monitoring

Use built-in Next.js analytics or integrate with:

-   **Vercel Analytics**: Built-in performance monitoring
-   **Google Lighthouse**: Performance auditing
-   **Sentry**: Error tracking and performance monitoring

## 🤝 Contributing

### Development Workflow

1. **Fork Repository**: Create your own fork
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Follow Code Standards**: Use ESLint and Prettier
4. **Add Tests**: Write tests for new components
5. **Update Documentation**: Document new features
6. **Submit PR**: Create detailed pull request

### Code Style Guidelines

-   **TypeScript**: Use strict type checking
-   **Components**: Functional components with hooks
-   **Naming**: PascalCase for components, camelCase for variables
-   **Imports**: Group by external, internal, relative
-   **Comments**: Document complex logic and APIs

### Component Guidelines

```typescript
// Example component structure
interface ComponentProps {
    title: string;
    optional?: boolean;
}

const Component: React.FC<ComponentProps> = ({ title, optional = false }) => {
    const [state, setState] = useState<Type>(initialValue);

    useEffect(() => {
        // Effect logic
    }, [dependency]);

    return <div className="component-class">{/* JSX content */}</div>;
};

export default Component;
```

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

**Key Points:**

-   Open source with copyleft licensing
-   Network use triggers license obligations
-   Modifications must be shared under AGPL-3.0
-   Commercial use permitted with compliance

## 🙏 Acknowledgments

-   **Google Summer of Code 2025** for funding this project
-   **OpenStreetMap Foundation** for mentorship and platform
-   **Simon Poole** for project guidance and mentorship
-   **Ian Wagner** (Stadia Maps) for routing expertise
-   **Next.js Team** for the excellent React framework
-   **Leaflet Community** for open-source mapping capabilities
-   **Valhalla Project** for open-source routing services
-   **Tailwind CSS Team** for the utility-first CSS framework
-   **University of Illinois Chicago** for academic support

### Special Thanks

-   The **OSM Community** for feedback and testing
-   **React Community** for excellent documentation and patterns
-   **TypeScript Team** for improving development experience
-   **Vercel** for hosting and deployment platform

## 📞 Support and Contact

### Getting Help

-   **Issues**: [GitHub Issues](https://github.com/sosm/temporary-road-closures/issues)
-   **Discussions**: [GitHub Discussions](https://github.com/sosm/temporary-road-closures/discussions)
-   **Documentation**: [Live Docs](http://localhost:3000/docs)
-   **Backend API**: [API Documentation](http://localhost:8000/docs)

### Project Information

-   **Repository**: [temporary-road-closures](https://github.com/sosm/temporary-road-closures)
-   **GSoC Project**: [Google Summer of Code 2025](https://summerofcode.withgoogle.com/programs/2025/projects/tF4ccCqZ)
-   **Developer**: **Archit Rathod** (architrathod77@gmail.com)
-   **Mentor**: **Simon Poole** (OpenStreetMap Foundation)
-   **Mentor**: **Ian Wagner** (Stadia Maps)
-   **Organization**: **OpenStreetMap Foundation**

### Professional Contact

-   **Email**: arath21@uic.edu
-   **GitHub**: [@Archit1706](https://github.com/Archit1706)
-   **LinkedIn**: [Archit Rathod](https://www.linkedin.com/in/archit-rathod/)
-   **Portfolio**: [archit-rathod.vercel.app](https://archit-rathod.vercel.app)

### Community Resources

-   **OpenStreetMap**: [OSM Wiki](https://wiki.openstreetmap.org/)
-   **Next.js Documentation**: [nextjs.org/docs](https://nextjs.org/docs)
-   **React Documentation**: [reactjs.org/docs](https://reactjs.org/docs)
-   **Leaflet Documentation**: [leafletjs.com](https://leafletjs.com/)

## 🗺️ Browser Support

-   **Chrome**: 88+
-   **Firefox**: 85+
-   **Safari**: 14+
-   **Edge**: 88+
-   **Mobile Safari**: iOS 14+
-   **Chrome Mobile**: Android 10+

## 🔮 Roadmap

### Current Sprint (MVP)

-   [x] Basic map interface with closure display
-   [x] Multi-step closure reporting form
-   [x] Real-time status updates
-   [x] Statistics dashboard
-   [x] User authentication system
-   [x] Edit and delete functionality
-   [x] Closure-aware routing demo

### Next Sprint (Enhanced Features)

-   [ ] Advanced filtering and search
-   [ ] Bulk import/export functionality
-   [ ] Offline-first capabilities
-   [ ] Push notifications for nearby closures
-   [ ] Advanced analytics and reporting
-   [ ] Multi-language support

### Future Releases

-   [ ] Mobile app (React Native)
-   [ ] OsmAnd plugin integration
-   [ ] Real-time collaboration features
-   [ ] Machine learning for closure validation
-   [ ] Integration with traffic management systems

---

**Ready to get started?** Run `npm run dev` and visit http://localhost:3000 to explore the application! 🚀

_Built with ❤️ for the OpenStreetMap community as part of Google Summer of Code 2025_
