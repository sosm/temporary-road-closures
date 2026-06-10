import React from 'react';
import { Terminal, ExternalLink, Chrome, Globe, CheckCircle } from 'lucide-react';
import { InfoBox, StepCard, TechStackItem } from '../../Common';
import CodeBlock from '../../CodeBlock';

const Setup: React.FC = () => {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Local Setup</h1>
                <p className="text-lg text-gray-600">
                    Complete guide to setting up the Next.js frontend application locally for development.
                </p>
            </div>

            <InfoBox type="info" title="Development Environment" icon={Terminal}>
                <p>
                    This setup guide covers installing dependencies, configuring the environment,
                    and running the development server. Suitable for contributors and local testing.
                </p>
            </InfoBox>

            <div className="space-y-8">
                <StepCard stepNumber={1} title="Prerequisites">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Required Software</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Node.js 18+</h4>
                                    <p className="text-gray-600 text-sm mb-2">JavaScript runtime for running the development server</p>
                                    <a
                                        href="https://nodejs.org/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                                    >
                                        <span>Download Node.js</span>
                                        <ExternalLink className="w-3 h-3 ml-1" />
                                    </a>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Git</h4>
                                    <p className="text-gray-600 text-sm mb-2">Version control for cloning the repository</p>
                                    <a
                                        href="https://git-scm.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm"
                                    >
                                        <span>Download Git</span>
                                        <ExternalLink className="w-3 h-3 ml-1" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Package Managers (Choose One)</h3>
                            <div className="grid md:grid-cols-3 gap-4">
                                <TechStackItem
                                    title="npm (Recommended)"
                                    description="Comes with Node.js installation"
                                    items={[]}
                                    bgColor="bg-green-50 border border-green-200"
                                />
                                <TechStackItem
                                    title="yarn"
                                    description="Alternative package manager"
                                    items={[]}
                                    bgColor="bg-blue-50 border border-blue-200"
                                />
                                <TechStackItem
                                    title="pnpm"
                                    description="Fast, disk space efficient"
                                    items={[]}
                                    bgColor="bg-purple-50 border border-purple-200"
                                />
                            </div>
                        </div>

                        <InfoBox type="warning" title="Backend API (Optional)">
                            <p>
                                <strong>Note:</strong> The frontend works in demo mode without the backend.
                                For full functionality, set up the FastAPI backend first (see Backend API section).
                            </p>
                        </InfoBox>
                    </div>
                </StepCard>

                <StepCard stepNumber={2} title="Installation Steps">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                                <span>Clone the Repository</span>
                            </h3>
                            <CodeBlock
                                code={`# Clone the project repository
git clone https://github.com/sosm/temporary-road-closures.git

# Navigate to the frontend directory
cd temporary-road-closures/frontend`}
                                language="bash"
                            />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                <span>Install Dependencies</span>
                            </h3>
                            <p className="text-gray-600 mb-3">Choose your preferred package manager:</p>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Using npm (Recommended)</h4>
                                    <CodeBlock code="npm install" language="bash" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Using yarn</h4>
                                    <CodeBlock code="yarn install" language="bash" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Using pnpm</h4>
                                    <CodeBlock code="pnpm install" language="bash" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                <span>Environment Configuration</span>
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Create Environment File</h4>
                                    <CodeBlock
                                        code={`# Create .env.local file in the frontend directory
cp .env.example .env.local

# Or create manually
touch .env.local`}
                                        language="bash"
                                    />
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Configure Environment Variables</h4>
                                    <p className="text-gray-600 text-sm mb-2">
                                        Add the following variables to your <code className="bg-gray-100 px-1 py-0.5 rounded">.env.local</code> file:
                                    </p>
                                    <CodeBlock
                                        code={`# Backend API URL (adjust if your backend runs on different port)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: Enable debug mode for development
NEXT_PUBLIC_DEBUG=true

# Optional: Valhalla routing service URL (if different from backend)
NEXT_PUBLIC_VALHALLA_URL=http://localhost:8002`}
                                        language="env"
                                    />
                                </div>

                                <InfoBox type="warning" title="Environment Variables Explained">
                                    <ul className="space-y-1 text-sm">
                                        <li>• <code>NEXT_PUBLIC_API_URL</code>: Backend FastAPI server URL</li>
                                        <li>• <code>NEXT_PUBLIC_DEBUG</code>: Enables console logging for debugging</li>
                                        <li>• <code>NEXT_PUBLIC_VALHALLA_URL</code>: Valhalla routing service endpoint</li>
                                    </ul>
                                </InfoBox>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                                <span>Start Development Server</span>
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-gray-700 mb-2">Run the Development Server</h4>
                                    <CodeBlock
                                        code={`# Using npm
npm run dev

# Using yarn
yarn dev

# Using pnpm
pnpm dev`}
                                        language="bash"
                                    />
                                </div>

                                <InfoBox type="success" title="Success Indicators">
                                    <p className="mb-2">
                                        If everything is working correctly, you should see:
                                    </p>
                                    <ul className="space-y-1 text-sm">
                                        <li>• Server starting on <code>http://localhost:3000</code></li>
                                        <li>• No compilation errors in the terminal</li>
                                        <li>• Browser automatically opens to the application</li>
                                        <li>• Map loads and displays demo closures</li>
                                    </ul>
                                </InfoBox>
                            </div>
                        </div>
                    </div>
                </StepCard>

                <StepCard stepNumber={3} title="Verification and Testing">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Access the Application</h3>
                            <ol className="space-y-2 text-gray-600">
                                <li>1. Open your browser and navigate to <a href="http://localhost:3000" className="text-blue-600 hover:underline">http://localhost:3000</a></li>
                                <li>2. Wait for the map to load completely</li>
                                <li>3. Check that demo closures are visible on the map</li>
                                <li>4. Verify the sidebar shows closure statistics</li>
                                <li>5. Confirm the demo control panel appears in the bottom-right</li>
                            </ol>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Testing Core Features</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <InfoBox type="info" title="Demo Mode Testing">
                                    <ul className="space-y-1 text-sm">
                                        <li>• Map navigation (pan, zoom)</li>
                                        <li>• Closure visibility and clicking</li>
                                        <li>• Sidebar interaction</li>
                                        <li>• Demo closure creation</li>
                                    </ul>
                                </InfoBox>
                                <InfoBox type="success" title="Backend Integration Testing">
                                    <ul className="space-y-1 text-sm">
                                        <li>• Login functionality</li>
                                        <li>• Persistent closure creation</li>
                                        <li>• Edit/delete operations</li>
                                        <li>• OpenLR encoding display</li>
                                    </ul>
                                </InfoBox>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Common Issues and Solutions</h3>
                            <div className="space-y-3">
                                <InfoBox type="error" title="Port Already in Use">
                                    <p className="text-sm mb-2">Error: "Port 3000 is already in use"</p>
                                    <CodeBlock
                                        code={`# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or run on different port
npm run dev -- -p 3001`}
                                        language="bash"
                                    />
                                </InfoBox>

                                <InfoBox type="error" title="Map Not Loading">
                                    <p className="text-sm mb-2">Check browser console for errors</p>
                                    <ul className="space-y-1 text-sm">
                                        <li>• Ensure internet connection for map tiles</li>
                                        <li>• Check for JavaScript errors in console</li>
                                        <li>• Verify Leaflet CSS is loading properly</li>
                                        <li>• Try hard refresh (Ctrl+F5)</li>
                                    </ul>
                                </InfoBox>

                                <InfoBox type="error" title="Backend Connection Issues">
                                    <p className="text-sm mb-2">API calls failing or demo mode stuck</p>
                                    <ul className="space-y-1 text-sm">
                                        <li>• Verify NEXT_PUBLIC_API_URL in .env.local</li>
                                        <li>• Check if backend server is running</li>
                                        <li>• Test backend health: <code>http://localhost:8000/health</code></li>
                                        <li>• Check browser network tab for CORS errors</li>
                                    </ul>
                                </InfoBox>
                            </div>
                        </div>
                    </div>
                </StepCard>

                <StepCard stepNumber={4} title="Development Scripts">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Available Commands</h3>
                            <div className="space-y-3">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Development Server</h4>
                                    <CodeBlock code="npm run dev" language="bash" />
                                    <p className="text-gray-600 text-sm mt-2">Starts development server with hot reload at http://localhost:3000</p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Production Build</h4>
                                    <CodeBlock code="npm run build" language="bash" />
                                    <p className="text-gray-600 text-sm mt-2">Creates optimized production build in .next folder</p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Production Server</h4>
                                    <CodeBlock code="npm run start" language="bash" />
                                    <p className="text-gray-600 text-sm mt-2">Runs production server (requires build first)</p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Linting</h4>
                                    <CodeBlock code="npm run lint" language="bash" />
                                    <p className="text-gray-600 text-sm mt-2">Runs ESLint to check code quality and style</p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="font-medium text-gray-900 mb-2">Type Checking</h4>
                                    <CodeBlock code="npx tsc --noEmit" language="bash" />
                                    <p className="text-gray-600 text-sm mt-2">Checks TypeScript types without generating files</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Development Workflow</h3>
                            <ol className="space-y-2 text-gray-600">
                                <li>1. Start development server: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code></li>
                                <li>2. Make changes to source files</li>
                                <li>3. Check browser for hot-reloaded changes</li>
                                <li>4. Run linting: <code className="bg-gray-100 px-2 py-1 rounded">npm run lint</code></li>
                                <li>5. Test production build: <code className="bg-gray-100 px-2 py-1 rounded">npm run build</code></li>
                                <li>6. Commit changes to git</li>
                            </ol>
                        </div>
                    </div>
                </StepCard>

                <StepCard stepNumber={5} title="Browser Support & Requirements">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Supported Browsers</h3>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-3">
                                    <Chrome className="w-5 h-5 text-orange-500" />
                                    <span className="text-gray-700">Chrome 88+</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Globe className="w-5 h-5 text-orange-500" />
                                    <span className="text-gray-700">Firefox 85+</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Globe className="w-5 h-5 text-blue-500" />
                                    <span className="text-gray-700">Safari 14+</span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Globe className="w-5 h-5 text-blue-600" />
                                    <span className="text-gray-700">Edge 88+</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Requirements</h3>
                            <ul className="space-y-2 text-gray-600">
                                <li className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span>JavaScript enabled</span>
                                </li>
                                <li className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span>Internet connection for map tiles</span>
                                </li>
                                <li className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span>Local storage for demo mode</span>
                                </li>
                                <li className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span>Geolocation API (optional)</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </StepCard>
            </div>
        </div>
    );
};

export default Setup;