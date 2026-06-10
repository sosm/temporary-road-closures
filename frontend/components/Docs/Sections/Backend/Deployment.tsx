import React from 'react';
import { InfoBox, StepCard } from '../../Common';
import CodeBlock from '../../CodeBlock';

const Deployment: React.FC = () => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Deployment</h1>
                <p className="text-lg text-gray-600">
                    Guide for deploying the OSM Road Closures API in production.
                </p>
            </div>

            <InfoBox type="info" title="Quick Start with Docker">
                <p className="mb-4">
                    The easiest way to deploy the API is using Docker Compose:
                </p>
                <CodeBlock
                    code={`# Clone the repository
git clone https://github.com/sosm/temporary-road-closures
cd temporary-road-closures/backend

# Start all services
docker-compose up -d

# Check status
docker-compose ps`}
                    language="bash"
                />
            </InfoBox>

            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Environment Variables</h2>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variable</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                <tr>
                                    <td className="px-6 py-4 text-sm font-mono text-gray-900">DATABASE_URL</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">PostgreSQL connection string</td>
                                    <td className="px-6 py-4 text-sm text-green-600">Yes</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 text-sm font-mono text-gray-900">SECRET_KEY</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">JWT signing key</td>
                                    <td className="px-6 py-4 text-sm text-green-600">Yes</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 text-sm font-mono text-gray-900">ENVIRONMENT</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">Environment (production/development)</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">No</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 text-sm font-mono text-gray-900">REDIS_URL</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">Redis connection for caching</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">No</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Production Configuration</h2>
                    <CodeBlock
                        code={`# Production environment settings
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING

# Database (use managed PostgreSQL in production)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/osm_closures

# Security (generate a secure secret key)
SECRET_KEY=your-production-secret-key-256-bits
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS (restrict to your domain)
ALLOWED_ORIGINS=["https://your-frontend-domain.com"]
ALLOWED_HOSTS=["your-api-domain.com"]

# Performance
RATE_LIMIT_REQUESTS=1000
DB_POOL_SIZE=20`}
                        language="env"
                    />
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Database Setup</h2>
                    <div className="space-y-4">
                        <StepCard stepNumber={1} title="PostgreSQL with PostGIS">
                            <CodeBlock
                                code={`# Create database and enable PostGIS
CREATE DATABASE osm_closures;
\\c osm_closures
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;`}
                                language="sql"
                            />
                        </StepCard>

                        <StepCard stepNumber={2} title="Run Database Migrations">
                            <CodeBlock
                                code={`# Initialize database tables
docker-compose exec api alembic upgrade head

# Or manually
python -m alembic upgrade head`}
                                language="bash"
                            />
                        </StepCard>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Monitoring & Logging</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h3 className="font-semibold text-gray-900 mb-3">Health Checks</h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• <code>/health</code> - Basic health check</li>
                                <li>• <code>/health/detailed</code> - System information</li>
                                <li>• Returns 200 when healthy</li>
                                <li>• Checks database connectivity</li>
                            </ul>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h3 className="font-semibold text-gray-900 mb-3">Logging</h3>
                            <ul className="space-y-2 text-sm text-gray-600">
                                <li>• Structured JSON logging</li>
                                <li>• Configurable log levels</li>
                                <li>• Request/response logging</li>
                                <li>• Error tracking and alerts</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Deployment;