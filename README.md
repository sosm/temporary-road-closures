# Temporary Road Closures Database and API

**Google Summer of Code Project for OpenStreetMap Foundation in [2025](https://wiki.openstreetmap.org/wiki/Google_Summer_of_Code/2025/Accepted_projects) and [2026](https://wiki.openstreetmap.org/wiki/Google_Summer_of_Code/2026/Accepted_projects)**

A comprehensive system for collecting and disseminating temporary road closure information, designed to enhance OSM-based navigation applications with real-time closure data and intelligent routing capabilities.

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.4.1-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.5+-blue.svg)](https://postgis.net/)
[![OpenLR](https://img.shields.io/badge/OpenLR-integrated-orange.svg)](https://www.openlr.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

---

## 🎯 Project Overview

OpenStreetMap provides excellent static map data, but temporary road closures (construction, accidents, events) are often not captured quickly enough for navigation apps. This project bridges that gap by creating an open platform where:

-   **Community members** can report temporary road closures in real-time through a user-friendly web interface
-   **Navigation applications** can query closure data and calculate closure-aware routes
-   **OpenLR integration** ensures cross-platform compatibility across different map providers
-   **OSM ecosystem** benefits from enhanced real-time data and intelligent routing

### 🌟 Key Features

-   **🗺️ Interactive Web Application**: Next.js-based frontend for easy closure reporting and visualization
-   **🚗 Closure-Aware Routing**: Intelligent route calculation that avoids temporary road closures
-   **🚴‍♀️ Multi-Modal Support**: Transportation-specific routing for cars, bicycles, and pedestrians
-   **📍 OpenLR Integration**: Map-agnostic location references for universal compatibility
-   **🔐 Secure Authentication**: OAuth2 + JWT with Google/GitHub integration
-   **📊 Real-time Analytics**: Live statistics and closure status tracking
-   **🎯 Geometry Support**: Both point closures (intersections) and road segment closures
-   **📱 Mobile Responsive**: Optimized interface for field reporting on any device

## 📁 Repository Structure

```
temporary-road-closures/
├── backend/                # FastAPI backend service ✅
│   ├── app/                # Application code with OpenLR integration
│   ├── docker-compose.yml  # Development environment
│   ├── requirements.txt    # Python dependencies
│   └── README.md           # Detailed backend documentation
├── frontend/               # Next.js web application ✅
│   ├── app/                # Next.js 15 App Router structure
│   ├── components/         # React components for UI
│   ├── services/           # API clients and utilities
│   ├── context/            # State management
│   ├── public/             # Static assets
│   ├── package.json        # Node.js dependencies
│   └── README.md           # Detailed frontend documentation
├── docs/                   # Project documentation
├── LICENSE                 # GNU AGPL v3.0 license
└── README.md               # This file
```

### 🛠️ Backend (Fully Implemented) ✅

**Complete FastAPI backend featuring:**

-   **Database**: PostgreSQL 15 + PostGIS 3.5 for advanced geospatial operations
-   **REST API**: Comprehensive endpoints with OpenAPI/Swagger documentation
-   **Authentication**: OAuth2 Password Bearer + JWT tokens with Google/GitHub integration
-   **OpenLR Service**: Complete encoding/decoding for cross-platform compatibility
-   **Spatial Queries**: Advanced geospatial filtering, bounding box searches, and route analysis
-   **Security**: Rate limiting, CORS, input validation, and role-based access control

[📖 **View Detailed Backend Documentation**](./backend/README.md)

### 🎨 Frontend (Fully Implemented) ✅

**Complete Next.js web application featuring:**

-   **Interactive Mapping**: Leaflet.js-based map interface with OpenStreetMap tiles
-   **Closure Reporting**: Multi-step guided forms for accurate closure submission
-   **Real-time Visualization**: Live closure status with color-coded indicators
-   **Mobile Responsive**: Touch-optimized interface for field reporting
-   **Authentication**: JWT-based login with demo mode for testing
-   **Edit Capabilities**: Update and delete your own closure reports
-   **Statistics Dashboard**: Real-time analytics and closure insights

[📖 **View Detailed Frontend Documentation**](./frontend/README.md)

### 🛣️ Closure-Aware Routing (Fully Implemented) ✅

**Advanced routing system featuring:**

-   **Transportation Modes**: Car, bicycle, and pedestrian routing with mode-specific closure filtering
-   **Valhalla Integration**: Open-source routing engine for accurate path calculation
-   **Smart Avoidance**: Automatically avoid closures relevant to your transportation mode
-   **Route Comparison**: Side-by-side comparison of direct vs. closure-aware routes
-   **Real-time Processing**: Live calculation of optimal routes considering current closures

[📖 **View Routing Documentation**](./frontend/README.md#closure-aware-routing)
[🔌 **Closure-Aware Routing API Reference**](./docs/CLOSURE_AWARE_ROUTING.md)

## 🚀 Quick Start

### Prerequisites

-   **Docker & Docker Compose** (recommended for full setup)
-   **Node.js 18+** (for frontend development)
-   **Python 3.11+** (for backend development)
-   **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/sosm/temporary-road-closures
cd temporary-road-closures
```

### 2. Start the Backend API

```bash
cd backend

# Copy environment configuration
cp .env.example .env

# Start all services with Docker
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 3. Start the Frontend Application

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local

# Start development server
npm run dev
```

### 4. Access the Applications

**Available Services:**

-   **🌐 Frontend Application**: http://localhost:3000
-   **📚 Interactive Documentation**: http://localhost:3000/docs
-   **🔗 Backend API**: http://localhost:8000
-   **📊 API Documentation**: http://localhost:8000/api/v1/docs
-   **🗄️ Database Admin**: http://localhost:8080 (Adminer)

### 5. Test the System

```bash
# Health check
curl http://localhost:8000/health

# Try the web application
open http://localhost:3000

# Explore closure-aware routing
open http://localhost:3000/closure-aware-routing
```

**For detailed setup instructions and development guides:**
👉 **[Backend Setup Guide](./backend/README.md)**
👉 **[Frontend Setup Guide](./frontend/README.md)**

## 🚀 Production Deployment

### Prerequisites for Production

-   **Server**: Ubuntu 20.04+ or similar Linux distribution
-   **Docker & Docker Compose**: Latest stable versions
-   **Domain Names**: DNS configured for your domains (e.g., closures.osm.ch)
-   **SSL Certificates**: Let's Encrypt (automated setup included)

### SSL Certificate Setup

The application includes automated SSL certificate management using Let's Encrypt:

1. **Initial Certificate Setup**:

   ```bash
   # Install certbot on the host system
   sudo apt-get update
   sudo apt-get install certbot

   # Obtain certificates for your domains
   sudo certbot certonly --standalone \
     -d closures.osm.ch \
     -d api.closures.osm.ch \
     --email your-email@example.com \
     --agree-tos
   ```

2. **Automated Renewal**:

   The `docker-compose.prod.yml` includes a certbot service that automatically renews certificates twice daily.

   Alternatively, use the provided renewal script:

   ```bash
   sudo ./scripts/renew_ssl.sh
   ```

3. **Troubleshooting Expired Certificates**:

   If you see `ERR_CERT_DATE_INVALID` or similar SSL errors:

   ```bash
   # Renew certificates immediately
   sudo ./scripts/renew_ssl.sh

   # Or manually with certbot
   sudo certbot renew
   docker exec osm_closures_nginx_prod nginx -s reload
   ```

📖 **[Complete SSL Certificate Setup Guide](./docs/SSL_CERTIFICATE_SETUP.md)**

### Production Deployment Steps

1. **Clone and Configure**:

   ```bash
   git clone https://github.com/sosm/temporary-road-closures
   cd temporary-road-closures
   cp .env.prod.example .env.prod
   # Edit .env.prod with your production settings
   ```

2. **Deploy Application**:

   ```bash
   ./scripts/deploy_prod.sh
   ```

3. **Verify Services**:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   curl https://closures.osm.ch
   curl https://api.closures.osm.ch/health
   ```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js Web   │    │  Closure-Aware  │    │   Navigation    │
│   Application   │◄──►│    Routing      │◄──►│     Apps        │
│   [Frontend]    │    │   [Frontend]    │    │  [Integration]  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                      ┌─────────────────┐
                      │   FastAPI API   │ ← ✅ **Complete**
                      │   + OpenLR      │
                      │   + OAuth2      │
                      └─────────────────┘
                              │
                      ┌─────────────────┐
                      │  PostgreSQL +   │ ← ✅ **Complete**
                      │    PostGIS      │
                      └─────────────────┘
```

### 🔧 Technology Stack

**Frontend (✅ Complete)**

-   **Framework**: Next.js 15 with TypeScript and App Router
-   **Mapping**: Leaflet.js with React-Leaflet integration
-   **Styling**: Tailwind CSS v4 with responsive design
-   **State Management**: React Context API with useReducer
-   **Forms**: React Hook Form with multi-step validation
-   **Icons**: Lucide React icon library
-   **HTTP Client**: Axios with interceptors

**Backend (✅ Complete)**

-   **API Framework**: FastAPI with async support and automatic documentation
-   **Database**: PostgreSQL 15 + PostGIS 3.5 for geospatial operations
-   **Authentication**: OAuth2 + JWT with Google/GitHub integration
-   **Geospatial**: PostGIS + GeoAlchemy2 for spatial queries
-   **Location Encoding**: OpenLR integration for cross-platform compatibility
-   **Caching**: Redis for performance optimization
-   **Containerization**: Docker + Docker Compose for easy deployment

**Routing Integration (✅ Complete)**

-   **Routing Engine**: Valhalla open-source routing service
-   **Transportation Modes**: Auto, bicycle, and pedestrian support
-   **Spatial Processing**: Automatic closure filtering based on transportation mode
-   **Route Optimization**: Point exclusion and intelligent path finding

## 🌍 Real-World Usage Examples

### 🚗 For Daily Commuters

**Scenario**: Morning commute to work during construction season

1. **Check Route**: Use closure-aware routing to plan your commute
2. **Select Mode**: Choose "Auto" for car-based routing
3. **Compare Options**: See direct route vs. closure-aware route
4. **Make Decision**: Choose route that avoids construction delays

### 🏗️ For City Departments

**Scenario**: Chicago Department of Transportation reporting water main repair

1. **Login**: Authenticate with city credentials
2. **Report Closure**: Use multi-step form to report road closure
3. **Set Details**: Specify location, duration, and closure type
4. **Monitor**: Track closure status and community feedback

### 🚴‍♀️ For Cyclists

**Scenario**: Bike commuter planning route through downtown

1. **Select Bicycle Mode**: Choose transportation type for relevant filtering
2. **Route Planning**: System automatically avoids car-only restrictions
3. **Bike Lane Awareness**: Get notified of bike lane closures
4. **Safe Routing**: Receive routes optimized for cycling safety

### 📱 For Community Members

**Scenario**: Local resident spotting unexpected road closure

1. **Open App**: Access the mobile-responsive web interface
2. **Quick Report**: Submit closure report with location and photo
3. **Help Others**: Contribute to community navigation knowledge
4. **Real-time Impact**: Immediate availability for other users

## 📈 Development Timeline

**Google Summer of Code 2025 - Completed Successfully:**

-   ✅ **Weeks 1-2**: Project setup, database design, and initial API structure
-   ✅ **Weeks 3-5**: Core API implementation with authentication and CRUD operations
-   ✅ **Weeks 6-7**: OpenLR integration and advanced spatial query capabilities
-   ✅ **Week 8**: Midterm evaluation - Backend API complete and documented
-   ✅ **Weeks 9-10**: Frontend web application with interactive mapping and reporting
-   ✅ **Weeks 11-12**: Closure-aware routing implementation with Valhalla integration
-   ✅ **Weeks 13-15**: Testing, documentation, deployment guides, and project finalization

## 📊 Project Statistics

### Backend Capabilities

-   **25+ API Endpoints** with comprehensive OpenAPI documentation
-   **Real-time Geospatial Queries** with PostGIS optimization
-   **OpenLR Integration** for cross-platform location referencing
-   **OAuth2 Authentication** with multiple provider support
-   **Rate Limiting** and security best practices
-   **Docker Containerization** for easy deployment

### Frontend Features

-   **Interactive Mapping** with Leaflet.js and OpenStreetMap tiles
-   **Multi-step Forms** with validation and progress tracking
-   **Responsive Design** optimized for mobile field reporting
-   **Real-time Updates** with live closure status calculation
-   **Demo Mode** with 25+ sample closures for testing
-   **Closure-Aware Routing** with transportation mode filtering

### Community Impact

-   **Open Source**: All code available under AGPL-3.0 license
-   **Standards Compliant**: OpenLR, GeoJSON, and OSM compatibility
-   **Scalable Architecture**: Designed for community growth
-   **Documentation**: Comprehensive guides for users and developers

## 🔗 Links & Resources

### 📚 Documentation

-   **[Frontend Documentation](./frontend/README.md)** - Complete web application guide
-   **[Backend Documentation](./backend/README.md)** - API and development documentation
-   **[Live Demo](http://closures.osm.ch)** - Try the application locally
-   **[API Interactive Docs](http://closures.osm.ch/api/v1/docs)** - Swagger UI documentation
-   **[Closure-Aware Routing](http://closures.osm.ch/closure-aware-routing)** - Advanced routing demo

### 🌐 Project Resources

-   **[GSoC Project Page 2025](https://summerofcode.withgoogle.com/programs/2025/projects/tF4ccCqZ)** - Official Google Summer of Code listing for 2025
-   **[OSM Diary Updates 2025](https://www.openstreetmap.org/user/Archit%20Rathod/diary/406815)** - Development blog and progress updates for 2025
-   **[GSoC Project Page 2026](https://summerofcode.withgoogle.com/organizations/openstreetmap/projects/details/6WS8O5PX)** - Official Google Summer of Code listing for 2026
-   **[OSM Diary Updates 2026](https://www.openstreetmap.org/user/Venetis%20Charalampidis/diary/408696)** - Development blog and progress updates for 2026
-   **[GitHub Repository](https://github.com/sosm/temporary-road-closures)** - Complete source code
-   **[OpenLR Specification](https://www.openlr.org/)** - Location referencing standard

### 🛠️ Technical Resources

-   **[Valhalla Routing](https://valhalla.readthedocs.io/)** - Open-source routing engine
-   **[PostGIS Documentation](https://postgis.net/documentation/)** - Spatial database capabilities
-   **[FastAPI Documentation](https://fastapi.tiangolo.com/)** - Modern Python web framework
-   **[Next.js Documentation](https://nextjs.org/docs)** - React-based frontend framework

## 🤝 Contributing

This project welcomes contributions from the OpenStreetMap community and developers worldwide!

### 🛠️ Development Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Setup Backend**: Follow instructions in [`./backend/README.md`](./backend/README.md)
4. **Setup Frontend**: Follow instructions in [`./frontend/README.md`](./frontend/README.md)
5. **Create** a feature branch: `git checkout -b feature/awesome-feature`
6. **Make** your changes and add comprehensive tests
7. **Document** your changes in relevant README files
8. **Submit** a pull request with detailed description

### 🐛 Reporting Issues

-   **Bug Reports**: [GitHub Issues](https://github.com/sosm/temporary-road-closures/issues)
-   **Feature Requests**: [GitHub Discussions](https://github.com/sosm/temporary-road-closures/discussions)
-   **Documentation**: Improvements and clarifications always welcome!
-   **Security Issues**: Email directly to closures@sosm.ch

### 💬 Community

-   **OSM Forum**: [community.openstreetmap.org](https://community.openstreetmap.org/)
-   **OSM Mailing Lists**: [lists.openstreetmap.org](https://lists.openstreetmap.org/)
-   **GitHub Discussions**: [Project Discussions](https://github.com/sosm/temporary-road-closures/discussions)
-   **Developer Contact**: closures@sosm.ch

### 🎯 Contribution Areas

-   **Backend Development**: API enhancements, performance optimization, new endpoints
-   **Frontend Development**: UI/UX improvements, new features, mobile optimization
-   **Documentation**: User guides, API documentation, setup instructions
-   **Testing**: Integration tests, performance testing, user acceptance testing
-   **Localization**: Multi-language support for international OSM community
-   **Integration**: Connections with other OSM tools and navigation applications

## 👥 Team

### 🎓 Google Summer of Code 2025

-   **🧑‍💻 Student Developer**: **Archit Rathod** ([University of Illinois Chicago](https://www.uic.edu/))

    -   Email: arath21@uic.edu
    -   GitHub: [@Archit1706](https://github.com/Archit1706)
    -   LinkedIn: [Archit Rathod](https://www.linkedin.com/in/archit-rathod/)
    -   Portfolio: [archit-rathod.vercel.app](https://archit-rathod.vercel.app)

-   **🧭 Primary Mentor**: **Simon Poole** ([OpenStreetMap Foundation](https://osmfoundation.org/))
-   **🗺️ Secondary Mentor**: **Ian Wagner** ([Stadia Maps](https://stadiamaps.com/))

### 🎓 Google Summer of Code 2026

-   **🧑‍💻 Student Developer**: **Venetis Charalampidis**

    -   GitHub: [@YatesMold](https://github.com/YatesMold)

-   **🧭 Primary Mentor**: **Simon Poole** ([OpenStreetMap Foundation](https://osmfoundation.org/))
-   **🗺️ Backup Mentor**: **David Haberthür** ([@habi](https://github.com/habi))

### 🏛️ Host Organization

**[OpenStreetMap Foundation](https://osmfoundation.org/)**

-   Supporting open geographic data and collaborative mapping
-   Enabling navigation innovation through open standards
-   Fostering community-driven geospatial solutions

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

**[View Full License](./LICENSE)**

### 🔓 Open Source Commitment

-   **Free Software**: Always free to use, modify, and distribute
-   **Copyleft**: Modifications must be shared under AGPL-3.0
-   **Network Use**: Server-side modifications must be disclosed
-   **Commercial Use**: Permitted with license compliance
-   **Community Driven**: Open development and transparent governance

## 🙏 Acknowledgments

### 🌟 Special Thanks

-   **[Google Summer of Code](https://summerofcode.withgoogle.com/)** for funding and program support
-   **[OpenStreetMap Foundation](https://osmfoundation.org/)** for hosting, mentorship, and community
-   **[University of Illinois Chicago](https://www.uic.edu/)** for academic support and research opportunities
-   **[PostGIS Team](https://postgis.net/)** for powerful geospatial database capabilities
-   **[FastAPI Team](https://fastapi.tiangolo.com/)** for the excellent Python web framework
-   **[Next.js Team](https://nextjs.org/)** for the outstanding React framework
-   **[Valhalla Project](https://valhalla.readthedocs.io/)** for open-source routing capabilities
-   **[TomTom](https://www.tomtom.com/)** for OpenLR specification and reference implementations

### 🌍 Community

-   **OSM Community Worldwide** for feedback, testing, and real-world validation
-   **OsmAnd Developers** for navigation integration discussions
-   **OpenLR Working Group** for location referencing standards
-   **Chicago Department of Transportation** for testing data and use cases
-   **React and TypeScript Communities** for development best practices
-   **Open Source Contributors** who made this project possible

## 🚀 Getting Started

Ready to explore the Temporary Road Closures system?

### 🔥 For Developers

1. **[Setup the Backend](./backend/README.md)** - Complete development environment
2. **[Setup the Frontend](./frontend/README.md)** - Web application development
3. **[Explore the API](https://closures.osm.ch/api/v1/docs)** - Interactive documentation
4. **[Join the Community](https://github.com/sosm/temporary-road-closures/discussions)** - Connect with other contributors

### 🗺️ For OSM Community

1. **[Try the Web App](https://closures.osm.ch)** - Experience the complete interface
2. **[Test Closure-Aware Routing](https://closures.osm.ch/closure-aware-routing)** - Advanced routing features
3. **[Provide Feedback](https://github.com/sosm/temporary-road-closures/issues)** - Help shape the future

### 🏢 For Organizations

1. **[Review Integration Examples](./backend/README.md#integration-examples)** - Connect your systems
2. **[Understand OpenLR](./backend/README.md#openlr-integration)** - Cross-platform compatibility
3. **[Explore API Capabilities](./backend/README.md#api-usage)** - Integration possibilities
4. **[Contact the Team](mailto:arath21@uic.edu)** - Discuss your specific use case

### 🚴‍♀️ For End Users

1. **[Visit the Application](https://closures.osm.ch)** - Start reporting closures
2. **[Try Demo Mode](https://closures.osm.ch)** - No login required for testing
3. **[Learn Closure-Aware Routing](https://closures.osm.ch/closure-aware-routing)** - Better route planning
4. **[Read User Guide](https://closures.osm.ch/docs)** - Comprehensive documentation

## 🏆 Project Success

This Google Summer of Code 2025 project has successfully delivered:

### ✅ **Complete Backend System**

-   Production-ready FastAPI with comprehensive documentation
-   PostgreSQL + PostGIS database with optimized spatial queries
-   OpenLR integration for cross-platform compatibility
-   OAuth2 authentication with multiple providers
-   Rate limiting, security, and monitoring capabilities

### ✅ **Full Frontend Application**

-   Next.js 15 web application with TypeScript
-   Interactive mapping with closure visualization
-   Multi-step closure reporting forms
-   Real-time status tracking and analytics
-   Mobile-responsive design for field use

### ✅ **Advanced Routing System**

-   Closure-aware route calculation
-   Transportation mode filtering (auto, bicycle, pedestrian)
-   Valhalla routing engine integration
-   Real-time route comparison and optimization

### 🎯 **Community Impact**

-   Open-source solution for the OSM ecosystem
-   Standards-compliant implementation (OpenLR, GeoJSON)
-   Comprehensive documentation for users and developers
-   Foundation for future navigation app integration

---

**🌟 Star this repository** if you find it useful for the OpenStreetMap ecosystem!

**📢 Follow development progress** in the [OSM diary entries for 2025](https://www.openstreetmap.org/user/Archit%20Rathod/diary), [2026](https://www.openstreetmap.org/user/Venetis%20Charalampidis/diary) and contribute in the [GitHub discussions](https://github.com/sosm/temporary-road-closures/discussions) here.

**🚀 Try the live demo** by following the [Quick Start guide](#-quick-start) above.

---

_Building the future of open navigation data, one closure at a time. 🗺️✨_

**"Temporary closures, permanent solutions"** - Making OSM navigation smarter for everyone.
