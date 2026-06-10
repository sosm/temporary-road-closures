# OSM Road Closures API

A FastAPI-based backend service for managing temporary road closures in OpenStreetMap, designed as part of Google Summer of Code 2025.

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.5+-blue.svg)](https://postgis.net/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## 🚀 Introduction

The OSM Road Closures API provides a centralized system for collecting and disseminating temporary road closure information, compatible with OSM-based navigation applications. It features:

-   **🗺️ Geospatial Support**: PostGIS-powered spatial queries and geometry storage
-   **📍 OpenLR Integration**: Location referencing for cross-platform compatibility
-   **🔐 Secure Authentication**: OAuth2 + JWT tokens with user management
-   **📊 Real-time Data**: REST API for submitting and querying closures
-   **🚀 High Performance**: Optimized for navigation app integration

### Key Features

-   **Temporal Road Closures**: Submit and query time-bound road closures
-   **Spatial Queries**: Find closures by bounding box, proximity, or route
-   **OpenLR Encoding**: Generate map-agnostic location references
-   **Multi-format Support**: GeoJSON, OpenLR, and standard coordinate formats
-   **OAuth Integration**: Google and GitHub authentication support
-   **Role-based Access**: User and moderator permission systems
-   **Real-time Updates**: Live closure status and validation
-   **Navigation Ready**: Designed for OsmAnd and other navigation apps

## 📚 API Documentation

### Interactive Documentation

Once running, explore the full API documentation:

-   **Swagger UI**: http://localhost:8000/api/v1/docs
<!-- -   **ReDoc**: http://localhost:8000/api/v1/redoc -->
-   **OpenAPI Schema**: http://localhost:8000/api/v1/openapi.json

### Main Endpoints

| Endpoint                | Description               | Authentication |
| ----------------------- | ------------------------- | -------------- |
| `POST /auth/register`   | Register new user         | None           |
| `POST /auth/login`      | User login (OAuth2)       | None           |
| `GET /auth/me`          | Get current user info     | Required       |
| `POST /closures/`       | Submit road closure       | Required       |
| `GET /closures/`        | Query closures            | Optional       |
| `GET /closures/{id}`    | Get specific closure      | Optional       |
| `PUT /closures/{id}`    | Update closure            | Required       |
| `DELETE /closures/{id}` | Delete closure            | Required       |
| `POST /openlr/encode`   | Encode geometry to OpenLR | Optional       |
| `POST /openlr/decode`   | Decode OpenLR to geometry | Optional       |
| `GET /users/{id}`       | Get user profile          | Optional       |
| `GET /health`           | Health check              | None           |

### Authentication

The API uses **OAuth2 Password Bearer** authentication:

1. Register or login to get a JWT token
2. Include token in requests: `Authorization: Bearer <token>`
3. Alternative: Use API key with `X-API-Key` header

## 🏃 Quick Start

### Prerequisites

-   Python 3.11+
-   Docker & Docker Compose
-   Git

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/sosm/temporary-road-closures
cd temporary-road-closures/backend

# Copy environment configuration
cp .env.example .env
```

### 2. Start with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f api
```

**Services Available:**

-   **API**: http://localhost:8000
-   **Database Admin**: http://localhost:8080 (Adminer)
-   **API Docs**: http://localhost:8000/api/v1/docs

### 3. Initialize Database

```bash
# Run database initialization
docker-compose exec api python scripts/init_db.py

# # Or run migrations manually
# docker-compose exec api alembic upgrade head
```

### 4. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Register a user
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "chicago_mapper",
    "email": "mapper@chicago.gov",
    "password": "SecurePass123",
    "full_name": "Chicago City Mapper"
  }'

# Login and get token
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=chicago_mapper&password=SecurePass123"
```

## 🛠️ Development Setup

### Local Development (without Docker)

```bash
# Install dependencies
pip install -r requirements.txt

# Setup PostgreSQL with PostGIS
# (Instructions vary by OS)

# Configure environment
export DATABASE_URL="postgresql://user:pass@localhost:5432/osm_closures_dev"
export SECRET_KEY="your-secret-key"

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

### Project Structure

```
app/
├── api/                # API endpoints
│   ├── auth.py         # Authentication endpoints
│   ├── closures.py     # Closure management
│   ├── users.py        # User management
│   ├── openlr.py       # OpenLR operations
│   └── deps.py         # Dependencies
├── core/               # Core functionality
│   ├── database.py     # DB configuration
│   ├── security.py     # Auth & security
│   ├── exceptions.py   # Custom exceptions
│   └── config.py       # Configuration
├── models/             # SQLAlchemy models
│   ├── user.py         # User model
│   ├── closure.py      # Closure model
│   ├── auth.py         # Auth models
│   └── base.py         # Base model
├── schemas/            # Pydantic schemas
│   ├── user.py         # User validation
│   ├── closure.py      # Closure validation
│   └── common.py       # Common schemas
├── services/           # Business logic
│   ├── user_service.py       # User operations
│   ├── closure_service.py    # Closure operations
│   ├── openlr_service.py     # OpenLR integration
│   ├── spatial_service.py    # Geospatial operations
│   └── oauth_service.py      # OAuth handling
├── utils/              # Utilities
├── main.py             # FastAPI app
└── config.py           # Configuration
```

## 🔧 API Usage

### Submit a Closure

```bash
export TOKEN="your-jwt-token-here"

curl -X POST "http://localhost:8000/api/v1/closures/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "LineString",
      "coordinates": [[-87.6298, 41.8781], [-87.6290, 41.8785]]
    },
    "description": "Water main repair blocking eastbound traffic",
    "closure_type": "construction",
    "start_time": "2025-07-09T08:00:00Z",
    "end_time": "2025-07-09T18:00:00Z",
    "source": "City of Chicago",
    "confidence_level": 9
  }'
```

### Query Closures

```bash
# Get active closures in Chicago area
curl "http://localhost:8000/api/v1/closures/?bbox=-87.7,41.8,-87.6,41.9&valid_only=true"

# Get closures by type
curl "http://localhost:8000/api/v1/closures/?closure_type=construction"

# Get specific closure
curl "http://localhost:8000/api/v1/closures/123"
```

### OpenLR Operations

```bash
# Encode geometry to OpenLR
curl -X POST "http://localhost:8000/api/v1/openlr/encode" \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "LineString",
      "coordinates": [[-87.6298, 41.8781], [-87.6290, 41.8785]]
    },
    "validate_roundtrip": true
  }'

# Decode OpenLR code
curl -X POST "http://localhost:8000/api/v1/openlr/decode" \
  -H "Content-Type: application/json" \
  -d '{"openlr_code": "CwRbWyNG/ztP"}'
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Navigation     │    │   OsmAnd        │
│   (React)       │◄──►│   Apps          │◄──►│   Plugin        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                      ┌─────────────────┐
                      │     FastAPI     │
                      │     Backend     │
                      └─────────────────┘
                              │
                      ┌─────────────────┐
                      │   PostgreSQL    │
                      │   + PostGIS     │
                      └─────────────────┘
```

### Technology Stack

-   **Backend**: FastAPI (Python 3.11+)
-   **Database**: PostgreSQL 15 + PostGIS 3.5
-   **Caching**: Redis 7
-   **Authentication**: OAuth2 + JWT
-   **Geospatial**: PostGIS + GeoAlchemy2
-   **Location Referencing**: OpenLR
-   **Container**: Docker + Docker Compose

### Key Components

1. **FastAPI Application**: High-performance async API server
2. **PostgreSQL + PostGIS**: Geospatial database for storing closures
3. **Redis**: Caching and rate limiting
4. **OpenLR Service**: Location encoding/decoding
5. **Authentication System**: JWT + OAuth2 with Google/GitHub
6. **Spatial Service**: Geospatial operations and queries

## 🗄️ Database Schema

### Core Tables

**users**

-   Primary user accounts with OAuth support
-   Authentication, roles, and permissions
-   API key management

**closures**

-   Road closure records with PostGIS geometry
-   Temporal bounds and status tracking
-   OpenLR location references

**auth_sessions**

-   Active user sessions
-   Session management and tracking

**auth_events**

-   Authentication audit log
-   Security event tracking

### Spatial Indexes

Optimized for:

-   Bounding box queries (`ST_Intersects`)
-   Distance queries (`ST_DWithin`)
-   Time-based filtering
-   OpenLR encoding efficiency

### Sample Schema

```sql
CREATE TABLE closures (
    id SERIAL PRIMARY KEY,
    geometry GEOMETRY(LINESTRING, 4326) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    description TEXT NOT NULL,
    closure_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    openlr_code TEXT,
    submitter_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_closures_geometry ON closures USING GIST (geometry);
CREATE INDEX idx_closures_temporal ON closures (start_time, end_time);
CREATE INDEX idx_closures_status ON closures (status);
```

## 📍 OpenLR Integration

OpenLR (Open Location Referencing) provides map-agnostic location encoding for cross-platform compatibility.

### Features

-   **Automatic Encoding**: Generate OpenLR codes for all closures
-   **Format Support**: Base64, Binary, XML formats
-   **Validation**: Roundtrip accuracy testing
-   **OSM Integration**: Direct OSM way encoding
-   **Decode Support**: Convert OpenLR back to coordinates

### Configuration

```env
# OpenLR Settings
OPENLR_ENABLED=true
OPENLR_FORMAT=base64
OPENLR_ACCURACY_TOLERANCE=50.0
OPENLR_VALIDATE_ROUNDTRIP=true
```

### Usage Example

```python
# Automatic OpenLR encoding on closure creation
closure = {
    "geometry": {"type": "LineString", "coordinates": [...]},
    # ... other fields
}
# System generates: "openlr_code": "CwRbWyNG/ztP"

# Navigation apps decode for their own maps
decoded_location = openlr_decoder.decode("CwRbWyNG/ztP")
```

This enables any OpenLR-compatible navigation system to use closure data regardless of their underlying map data.

## 📊 Monitoring and Analytics

### Health Checks

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed system information
curl http://localhost:8000/health/detailed
```

### Statistics and Analytics

```bash
# Closure statistics
curl http://localhost:8000/api/v1/closures/statistics/summary

# OpenLR statistics (moderators only)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/openlr/statistics

# User statistics
curl http://localhost:8000/api/v1/users/{user_id}/stats
```

### Metrics Tracked

-   Total closures by type and status
-   OpenLR encoding success rates
-   User activity and submissions
-   API response times and errors
-   Geospatial query performance

## 🧪 Testing

### Running Tests

```bash
# Run all tests
docker-compose exec api pytest

# Run with coverage
docker-compose exec api pytest --cov=app

# Run specific test file
docker-compose exec api pytest tests/test_closures.py

# Test OpenLR integration
docker-compose exec api pytest tests/test_openlr.py -v
```

### Test Structure

```
tests/
├── conftest.py              # Test configuration
├── test_auth.py             # Authentication tests
├── test_closures.py         # Closure operations
├── test_users.py            # User management
├── test_openlr.py           # OpenLR integration
├── test_spatial.py          # Geospatial operations
└── test_api_integration.py  # End-to-end tests
```

## 🔧 Troubleshooting

### Common Issues

**Database Connection Errors**

```bash
# Check database is running
docker-compose ps db

# Check connection
docker-compose exec api python -c "from app.core.database import db_manager; print(db_manager.health_check())"

# Reset database
docker-compose down -v
docker-compose up -d db
docker-compose exec api alembic upgrade head
```

**PostGIS Extension Missing**

```sql
-- Connect to database and run:
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

**OpenLR Encoding Failures**

-   OpenLR encoding is optional and won't prevent closure creation
-   Check logs for specific OpenLR library errors
-   Ensure geometry is valid LineString format
-   Verify coordinates are within valid ranges

**Permission Errors**

```bash
# Check user permissions
docker-compose exec api python -c "
from app.core.database import SessionLocal
from app.models.user import User
db = SessionLocal()
user = User.get_by_username(db, 'your-username')
print(f'Is moderator: {user.is_moderator if user else False}')
"
```

**Authentication Issues**

```bash
# Test OAuth configuration
curl http://localhost:8000/api/v1/auth/dev/test-oauth

# Check JWT token
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/auth/me
```

### Logs and Debugging

```bash
# View application logs
docker-compose logs -f api

# Database logs
docker-compose logs -f db

# Enable debug logging in .env
DEBUG=true
LOG_LEVEL=DEBUG
```

## ⚙️ Configuration

### Environment Variables

| Variable              | Description                  | Default            | Required |
| --------------------- | ---------------------------- | ------------------ | -------- |
| `DATABASE_URL`        | PostgreSQL connection string | `postgresql://...` | Yes      |
| `SECRET_KEY`          | JWT signing key              | -                  | Yes      |
| `DEBUG`               | Enable debug mode            | `false`            | No       |
| `ALLOWED_ORIGINS`     | CORS allowed origins         | `["*"]`            | No       |
| `OPENLR_ENABLED`      | Enable OpenLR encoding       | `true`             | No       |
| `RATE_LIMIT_REQUESTS` | Requests per hour            | `100`              | No       |

### OAuth Configuration

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/auth/github/callback
```

### OpenLR Configuration

```env
# OpenLR Settings
OPENLR_ENABLED=true
OPENLR_FORMAT=base64
OPENLR_ACCURACY_TOLERANCE=50.0
OPENLR_MAX_POINTS=15
OPENLR_MIN_DISTANCE=15.0
OPENLR_VALIDATE_ROUNDTRIP=true
OPENLR_TIMEOUT=10
```

### Production Configuration

```env
# Production settings
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING
ALLOWED_HOSTS=["your-domain.com"]
RATE_LIMIT_REQUESTS=1000

# Database
DATABASE_URL=postgresql://user:pass@db.example.com:5432/osm_closures_prod

# Security
SECRET_KEY=your-production-secret-key-256-bits
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
ALLOWED_ORIGINS=["https://your-frontend-domain.com"]
```

## 🤝 Contributing

This project is part of Google Summer of Code 2025. Contributions are welcome!

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make changes and add tests
4. Run tests: `docker-compose exec api pytest`
5. Check code style: `black app/ && isort app/`
6. Commit changes: `git commit -m "Add new feature"`
7. Push to branch: `git push origin feature/new-feature`
8. Create a Pull Request

### Code Style

-   **Python**: Black formatter, isort for imports
-   **Documentation**: Comprehensive docstrings
-   **Testing**: Pytest with good coverage
-   **Git**: Conventional commit messages

### Development Schedule

-   **Week 1-2**: Project setup and database design ✅
-   **Week 3-5**: Core API implementation ✅
-   **Week 6-7**: OpenLR integration ✅
-   **Week 8**: Midterm evaluation
-   **Week 9-10**: Web UI development
-   **Week 11-12**: OsmAnd integration
-   **Week 13-15**: Testing and documentation

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0).

**Key Points:**

-   Open source software with copyleft licensing
-   Network use triggers license obligations
-   Modifications must be shared under AGPL-3.0
-   Commercial use permitted with compliance

## 🙏 Acknowledgments

-   **Google Summer of Code 2025** for funding this project
-   **OpenStreetMap Foundation** for mentorship and platform
-   **Simon Poole** for project guidance and mentorship
-   **PostGIS Team** for excellent geospatial database capabilities
-   **FastAPI Team** for the outstanding web framework
-   **TomTom** for OpenLR specification and reference implementations
-   **University of Illinois Chicago** for academic support
-   **Chicago Department of Transportation** for real-world testing data

### Special Thanks

-   The **OSM Community** for feedback and testing
-   **OsmAnd Developers** for navigation integration support
-   **OpenLR Working Group** for location referencing standards

## 📞 Support and Contact

### Getting Help

-   **Issues**: [GitHub Issues](https://github.com/sosm/temporary-road-closures/issues)
-   **Discussions**: [GitHub Discussions](https://github.com/sosm/temporary-road-closures/discussions)
-   **Documentation**: [API Docs](http://closures.osm.ch/api/v1/docs)

### Project Information

-   **Repository**: [temporary-road-closures](https://github.com/sosm/temporary-road-closures)
-   **GSoC Project**: [Google Summer of Code 2025](https://summerofcode.withgoogle.com/programs/2025/projects/tF4ccCqZ)
-   **Developer**: **Archit Rathod** (architrathod77@gmail.com)
-   **Mentor**: **Simon Poole** (OpenStreetMap Foundation)
-   **Mentor**: **Ian Wagner** (Stadia Maps)
-   **Organization**: **OpenStreetMap Foundation**
-   **OSM Diary**: [OSM Diary Link](https://www.openstreetmap.org/user/Archit%20Rathod/diary/406815)

### Professional Contact

-   **Email**: arath21@uic.edu
-   **GitHub**: [@Archit1706](https://github.com/Archit1706)
-   **LinkedIn**: [Archit Rathod](https://www.linkedin.com/in/archit-rathod/)
-   **Portfolio**: [archit-rathod.vercel.app](https://archit-rathod.vercel.app)

### Community

-   **OpenStreetMap**: [OSM Wiki](https://wiki.openstreetmap.org/)
-   **OSM Mailing Lists**: [OpenStreetMap Lists](https://lists.openstreetmap.org/)
-   **OSM Forum**: [community.openstreetmap.org](https://community.openstreetmap.org/)

---

**Ready to get started?** Run `docker-compose up -d` and visit http://localhost:8000/api/v1/docs to explore the API! 🚀

_Built with ❤️ for the OpenStreetMap community as part of Google Summer of Code 2025_
